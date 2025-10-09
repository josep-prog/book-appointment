const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Temporary: fixed Meet link for all appointments (override dynamic generation)
const MEET_LINK = process.env.MEET_LINK || 'https://meet.google.com/kpe-qfki-pdb';

// Initialize nodemailer
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
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
app.use(express.static(path.join(__dirname)));

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

        const { data, error } = await supabase
            .from('doctors')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !data) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, data.password_hash);
        if (!isValidPassword) {
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
        const { doctorId, patientData, writtenDescription } = req.body;
        const audioFile = req.file;

        // Parse patient data if it's a string
        const patient = typeof patientData === 'string' ? JSON.parse(patientData) : patientData;

        // Insert patient
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

        if (patientError) throw patientError;

        let audioFileUrl = null;
        
        // Upload audio file if provided
        if (audioFile) {
            const fileName = `${uuidv4()}.wav`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('audio-recordings')
                .upload(fileName, audioFile.buffer, {
                    contentType: 'audio/wav'
                });

            if (!uploadError) {
                const { data: urlData } = supabase.storage
                    .from('audio-recordings')
                    .getPublicUrl(fileName);
                audioFileUrl = urlData.publicUrl;
            }
        }

        // Create appointment
        const { data: appointmentResult, error: appointmentError } = await supabase
            .from('appointments')
            .insert({
                doctor_id: doctorId,
                patient_id: patientResult.id,
                written_description: writtenDescription,
                audio_file_url: audioFileUrl,
                status: 'pending'
            })
            .select()
            .single();

        if (appointmentError) throw appointmentError;

        // Send confirmation email
        await sendPatientConfirmationEmail(patient.email, patient.name, appointmentResult.id);

        res.json({ success: true, appointmentId: appointmentResult.id });
    } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ success: false, error: 'Failed to create appointment' });
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

        const meetLink = generateGoogleMeetLink();

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
                    <a href="${meetLink}" style="background-color: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Join Google Meet</a>
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

// Generate Google Meet link
function generateGoogleMeetLink() {
    // Temporary override: always use a fixed Meet link to avoid Google integration issues
    return MEET_LINK;
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
