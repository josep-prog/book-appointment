const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const { StreamClient } = require('@stream-io/node-sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Initialize Stream.io client
let streamClient = null;
if (process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET) {
    streamClient = new StreamClient(process.env.STREAM_API_KEY, process.env.STREAM_API_SECRET);
    console.log('Stream.io client initialized successfully');
} else {
    console.warn('Stream.io credentials not found. Video calling will use fallback method.');
}

// Fallback video call link if Stream.io is not configured
const FALLBACK_MEET_LINK = process.env.MEET_LINK || 'https://meet.google.com/kpe-qfki-pdb';

// Initialize nodemailer
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use TLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files with proper MIME types
app.use(express.static(path.join(__dirname), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Security middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Hospital Booking System is running',
        timestamp: new Date().toISOString()
    });
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('doctors')
            .select('count')
            .limit(1);
        
        if (error) throw error;
        
        res.json({ 
            success: true, 
            message: 'Database connection successful',
            hasData: data && data.length > 0
        });
    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database connection failed',
            message: error.message
        });
    }
});

// Generate password hash (for development only)
app.post('/api/generate-hash', async (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ error: 'Password required' });
    }
    
    const hash = await bcrypt.hash(password, 10);
    res.json({ password, hash });
});

// Update all doctor passwords (for development only)
app.post('/api/update-doctor-passwords', async (req, res) => {
    try {
        const hash = await bcrypt.hash('password123', 10);
        
        const { data, error } = await supabase
            .from('doctors')
            .update({ password_hash: hash })
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all
        
        if (error) throw error;
        
        res.json({ 
            success: true, 
            message: 'All doctor passwords updated to "password123"'
        });
    } catch (error) {
        console.error('Password update error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update passwords',
            message: error.message
        });
    }
});

// Get all doctors
app.get('/api/doctors', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('doctors')
            .select('id, name, specialty, availability, phone')
            .order('name');

        if (error) throw error;

        res.json({ success: true, doctors: data });
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch doctors' });
    }
});

// Doctor login
app.post('/api/doctor/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt for email:', email);

        if (!email || !password) {
            console.error('Login failed: Missing email or password');
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        const { data, error } = await supabase
            .from('doctors')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !data) {
            console.error('Login failed: Doctor not found for email:', email);
            console.error('Database error:', error);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        console.log('Doctor found:', data.name);
        console.log('Password hash from DB:', data.password_hash.substring(0, 20) + '...');

        const isValidPassword = await bcrypt.compare(password, data.password_hash);
        console.log('Password validation result:', isValidPassword);
        
        if (!isValidPassword) {
            console.error('Login failed: Invalid password for email:', email);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: data.id, email: data.email, name: data.name },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ 
            success: true, 
            doctor: { 
                id: data.id, 
                name: data.name, 
                email: data.email,
                specialty: data.specialty 
            },
            token 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// Create appointment
app.post('/api/appointments', upload.single('audioFile'), async (req, res) => {
    try {
        console.log('Appointment request received');
        console.log('Body:', { 
            doctorId: req.body.doctorId, 
            hasPatientData: !!req.body.patientData,
            hasWrittenDescription: !!req.body.writtenDescription,
            writtenDescriptionLength: req.body.writtenDescription?.length || 0
        });
        console.log('File:', req.file ? 'Audio file present' : 'No audio file');
        
        const { doctorId, patientData, writtenDescription } = req.body;
        const audioFile = req.file;

        // Validate required fields
        if (!doctorId) {
            console.error('Validation failed: Missing doctorId');
            return res.status(400).json({ success: false, error: 'Doctor ID is required' });
        }

        if (!patientData) {
            console.error('Validation failed: Missing patientData');
            return res.status(400).json({ success: false, error: 'Patient data is required' });
        }

        // Parse patient data if it's a string
        let patient;
        try {
            patient = typeof patientData === 'string' ? JSON.parse(patientData) : patientData;
        } catch (parseError) {
            console.error('Patient data parse error:', parseError);
            return res.status(400).json({ success: false, error: 'Invalid patient data format' });
        }

        // Validate patient data
        if (!patient.name || !patient.email || !patient.phone || !patient.age || !patient.sex) {
            console.error('Validation failed: Missing patient fields', patient);
            return res.status(400).json({ success: false, error: 'All patient fields are required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(patient.email)) {
            console.error('Validation failed: Invalid email format');
            return res.status(400).json({ success: false, error: 'Invalid email format' });
        }

        // Validate age
        const age = parseInt(patient.age);
        if (isNaN(age) || age < 1 || age > 150) {
            console.error('Validation failed: Invalid age');
            return res.status(400).json({ success: false, error: 'Invalid age. Must be between 1 and 150' });
        }

        // Validate that at least description or audio is provided
        const hasDescription = writtenDescription && writtenDescription.trim().length > 0;
        const hasAudio = audioFile && audioFile.buffer;
        
        if (!hasDescription && !hasAudio) {
            console.error('Validation failed: No description or audio provided');
            return res.status(400).json({ 
                success: false, 
                error: 'Please provide either a written description or voice recording' 
            });
        }

        // Insert patient
        console.log('Inserting patient into database...');
        const { data: patientResult, error: patientError } = await supabase
            .from('patients')
            .insert({
                name: patient.name,
                email: patient.email,
                phone: patient.phone,
                age: parseInt(patient.age),
                sex: patient.sex
            })
            .select()
            .single();

        if (patientError) {
            console.error('Database error inserting patient:', patientError);
            throw patientError;
        }
        console.log('Patient inserted successfully:', patientResult.id);

        let audioFileUrl = null;
        
        // Upload audio file if provided
        if (audioFile) {
            console.log('Uploading audio file to storage...');
            const fileName = `${uuidv4()}.wav`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('audio-recordings')
                .upload(fileName, audioFile.buffer, {
                    contentType: 'audio/wav'
                });

            if (uploadError) {
                console.error('Audio upload error:', uploadError);
                // Don't fail the whole request if audio upload fails
            } else {
                const { data: urlData } = supabase.storage
                    .from('audio-recordings')
                    .getPublicUrl(fileName);
                audioFileUrl = urlData.publicUrl;
                console.log('Audio file uploaded successfully:', audioFileUrl);
            }
        }

        // Create appointment
        console.log('Creating appointment in database...');
        const { data: appointmentResult, error: appointmentError } = await supabase
            .from('appointments')
            .insert({
                doctor_id: doctorId,
                patient_id: patientResult.id,
                written_description: writtenDescription || null,
                audio_file_url: audioFileUrl,
                status: 'pending'
            })
            .select()
            .single();

        if (appointmentError) {
            console.error('Database error creating appointment:', appointmentError);
            throw appointmentError;
        }
        
        console.log('Appointment created successfully:', appointmentResult.id);

        // Send confirmation email
        try {
            console.log('Sending confirmation email...');
            await sendPatientConfirmationEmail(patient.email, patient.name, appointmentResult.id);
            console.log('Confirmation email sent successfully');
        } catch (emailError) {
            console.error('Email sending failed (non-critical):', emailError.message);
            // Don't fail the request if email fails
        }

        res.json({ success: true, appointmentId: appointmentResult.id });
    } catch (error) {
        console.error('Error creating appointment:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create appointment',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get doctor's appointments
app.get('/api/doctor/:doctorId/appointments', async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { status } = req.query;

        let query = supabase
            .from('appointments')
            .select(`
                *,
                patients (
                    id, name, email, phone, age, sex
                ),
                doctors (
                    id, name, specialty
                )
            `)
            .eq('doctor_id', doctorId)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, appointments: data });
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch appointments' });
    }
});

// Generate Stream.io user token
app.post('/api/stream/token', async (req, res) => {
    try {
        const { userId, userName, role } = req.body;

        if (!streamClient) {
            return res.status(503).json({ 
                success: false, 
                error: 'Video calling service not configured' 
            });
        }

        // Create or update user
        await streamClient.upsertUsers({
            users: {
                [userId]: {
                    id: userId,
                    name: userName,
                    role: role || 'user'
                }
            }
        });

        // Generate user token
        const token = streamClient.generateUserToken({ user_id: userId });

        res.json({ 
            success: true, 
            token,
            apiKey: process.env.STREAM_API_KEY
        });
    } catch (error) {
        console.error('Error generating Stream token:', error);
        res.status(500).json({ success: false, error: 'Failed to generate video token' });
    }
});

// Get Stream.io call details
app.get('/api/stream/call/:callId', async (req, res) => {
    try {
        const { callId } = req.params;

        if (!streamClient) {
            return res.status(503).json({ 
                success: false, 
                error: 'Video calling service not configured' 
            });
        }

        const call = streamClient.video.call('default', callId);
        const callData = await call.get();

        res.json({ 
            success: true, 
            call: callData
        });
    } catch (error) {
        console.error('Error fetching call details:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch call details' });
    }
});

// Confirm appointment
app.put('/api/appointments/:id/confirm', async (req, res) => {
    try {
        const { id } = req.params;
        const { scheduledTime } = req.body;

        if (!scheduledTime) {
            return res.status(400).json({ success: false, error: 'scheduledTime is required' });
        }

        // Normalize and validate the provided time
        const parsed = new Date(scheduledTime);
        if (isNaN(parsed.getTime())) {
            return res.status(400).json({ success: false, error: 'Invalid scheduledTime format. Use YYYY-MM-DD HH:MM or ISO format.' });
        }
        const scheduledISO = parsed.toISOString();

        // First, get appointment details to access doctor and patient info
        const { data: appointmentData, error: fetchError } = await supabase
            .from('appointments')
            .select(`
                *,
                patients (
                    name, email
                ),
                doctors (
                    name
                )
            `)
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        const meetLink = await generateVideoCallLink(
            id,
            appointmentData.doctors.name,
            appointmentData.patients.name
        );

        const { data, error } = await supabase
            .from('appointments')
            .update({
                status: 'confirmed',
                scheduled_time: scheduledISO,
                google_meet_link: meetLink,
                confirmed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select(`
                *,
                patients (
                    name, email
                ),
                doctors (
                    name
                )
            `)
            .single();

        if (error) throw error;

        // Try to send confirmation email to patient
        try {
            await sendAppointmentConfirmationEmail(
                data.patients.email,
                data.patients.name,
                data.doctors.name,
                scheduledISO,
                meetLink
            );
        } catch (mailErr) {
            console.error('Email send failed:', mailErr?.message || mailErr);
            // Do not fail the confirmation if email fails; return flag to client
            return res.json({ success: true, appointment: data, emailSent: false });
        }

        res.json({ success: true, appointment: data, emailSent: true });
    } catch (error) {
        console.error('Error confirming appointment:', error);
        res.status(500).json({ success: false, error: 'Failed to confirm appointment' });
    }
});

// Send patient confirmation email
async function sendPatientConfirmationEmail(email, patientName, appointmentId) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: ' Appointment Request Received - Rwanda Medical Connect',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">Appointment Request Received</h2>
                <p>Dear ${patientName},</p>
                <p>Your appointment request has been successfully submitted to Rwanda Medical Connect.</p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #27ae60;">What's Next?</h3>
                    <ul>
                        <li>Your doctor will review your request shortly</li>
                        <li>You'll receive another email once the appointment is confirmed</li>
                        <li>The confirmation will include your scheduled time and Google Meet link</li>
                    </ul>
                </div>
                <p style="color: #7f8c8d;">Appointment Reference: ${appointmentId}</p>
                <p>Thank you for choosing Rwanda Medical Connect!</p>
                <hr style="border: none; height: 1px; background-color: #e1e8ed; margin: 20px 0;">
                <p style="font-size: 12px; color: #95a5a6;">This is an automated message. Please do not reply to this email.</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
}

// Send appointment confirmation email
async function sendAppointmentConfirmationEmail(email, patientName, doctorName, scheduledTime, meetLink) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: ' Appointment Confirmed - Rwanda Medical Connect',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #27ae60;">Appointment Confirmed!</h2>
                <p>Dear ${patientName},</p>
                <p>Great news! Your appointment has been confirmed.</p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #2c3e50;">Appointment Details</h3>
                    <ul style="list-style: none; padding: 0;">
                        <li style="margin: 10px 0;"><strong>Doctor:</strong> ${doctorName}</li>
                        <li style="margin: 10px 0;"><strong>Date & Time:</strong> ${new Date(scheduledTime).toLocaleString()}</li>
                        <li style="margin: 10px 0;"><strong>Type:</strong> Virtual Consultation</li>
                    </ul>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${meetLink}" style="background-color: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Join Video Consultation</a>
                </div>
                <p><strong>Important Notes:</strong></p>
                <ul>
                    <li>Please join the meeting 5 minutes before your scheduled time</li>
                    <li>Ensure you have a stable internet connection</li>
                    <li>Have your ID ready for verification</li>
                </ul>
                <p>We look forward to serving you!</p>
                <hr style="border: none; height: 1px; background-color: #e1e8ed; margin: 20px 0;">
                <p style="font-size: 12px; color: #95a5a6;">For any questions, please contact us. This is an automated message.</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
}

// Generate Stream.io video call link
async function generateVideoCallLink(appointmentId, doctorName, patientName) {
    try {
        if (!streamClient) {
            console.log('Stream.io not configured, using fallback link');
            return FALLBACK_MEET_LINK;
        }

        // Create user IDs
        const doctorUserId = `doctor-${appointmentId}`;
        const patientUserId = `patient-${appointmentId}`;

        // First, create the users in Stream.io
        await streamClient.upsertUsers({
            users: {
                [doctorUserId]: {
                    id: doctorUserId,
                    name: doctorName,
                    role: 'host'
                },
                [patientUserId]: {
                    id: patientUserId,
                    name: patientName,
                    role: 'guest'
                }
            }
        });

        // Create a unique call ID based on appointment
        const callId = `appointment-${appointmentId}`;
        const callType = 'default';

        // Create a call
        const call = streamClient.video.call(callType, callId);
        
        // Get or create the call with settings to allow direct join
        await call.getOrCreate({
            data: {
                created_by_id: doctorUserId,
                members: [
                    { user_id: doctorUserId, role: 'host' },
                    { user_id: patientUserId, role: 'guest' }
                ],
                custom: {
                    doctor_name: doctorName,
                    patient_name: patientName,
                    appointment_id: appointmentId
                },
                settings_override: {
                    ring: {
                        auto_cancel_timeout_ms: 30000,
                        incoming_call_timeout_ms: 30000
                    },
                    audio: { mic_default_on: true, speaker_default_on: true },
                    video: { camera_default_on: true },
                    screensharing: { enabled: true },
                    recording: { mode: 'disabled' },
                    broadcasting: { enabled: false },
                    transcription: { mode: 'disabled' },
                    geofencing: { names: [] },
                    limits: {
                        max_duration_seconds: 3600,
                        max_participants: 10
                    }
                }
            },
            ring: false,
            notify: false
        });

        // Return the call URL
        const callUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/video-call/${callId}`;
        return callUrl;

    } catch (error) {
        console.error('Error creating Stream.io call:', error);
        // Fallback to basic link
        return FALLBACK_MEET_LINK;
    }
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        success: false,
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Hospital Booking System running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Access the app: http://localhost:${PORT}`);
    console.log(`Database: ${process.env.SUPABASE_URL}`);
});

module.exports = app;
