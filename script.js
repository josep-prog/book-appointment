// Global variables to store application state
let currentDoctor = null;
let currentPatient = null;
let mediaRecorder = null;
let audioChunks = [];
let currentAppointment = null;
let doctors = [];
let doctorToken = null;

// API Configuration
const API_BASE = '';

// Utility function to make API calls
async function apiCall(endpoint, options = {}) {
    const url = endpoint.startsWith('/') ? `${API_BASE}${endpoint}` : endpoint;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(doctorToken && { 'Authorization': `Bearer ${doctorToken}` })
        },
        ...options
    };
    
    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.body = JSON.stringify(config.body);
    }
    
    const response = await fetch(url, config);
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return await response.json();
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadDoctors();
    setupEventListeners();
    checkUrlParams();
});

// Load doctors from API
async function loadDoctors() {
    const doctorsList = document.getElementById('doctorsList');
    doctorsList.innerHTML = '<div class="loading">Loading doctors...</div>';
    
    try {
        const response = await apiCall('/api/doctors');
        doctors = response.doctors;
        
        doctorsList.innerHTML = '';
        
        if (doctors.length === 0) {
            doctorsList.innerHTML = '<p class="text-center">No doctors available at the moment.</p>';
            return;
        }
        
        doctors.forEach(doctor => {
            const doctorCard = createDoctorCard(doctor);
            doctorsList.appendChild(doctorCard);
        });
    } catch (error) {
        console.error('Error loading doctors:', error);
        doctorsList.innerHTML = `
            <div class="error-message">
                <p>Unable to load doctors. Please try again later.</p>
                <button onclick="loadDoctors()" class="btn-primary">Retry</button>
            </div>
        `;
    }
}

// Create doctor card element with new row layout
function createDoctorCard(doctor) {
    const doctorCard = document.createElement('div');
    doctorCard.className = 'doctor-card';
    
    const initials = doctor.name.split(' ').map(n => n[0]).join('').slice(0, 2);
    
    doctorCard.innerHTML = `
        <div class="doctor-info">
            <div class="doctor-avatar">${initials}</div>
            <div class="doctor-details">
                <h3>${doctor.name}</h3>
                <div class="specialty">${doctor.specialty}</div>
                <div class="availability">${doctor.availability}</div>
                ${doctor.phone ? `<div class="phone">${doctor.phone}</div>` : ''}
            </div>
        </div>
        <div class="doctor-actions">
            <div class="online-indicator"></div>
            <button class="select-doctor-btn" onclick="selectDoctor('${doctor.id}')">
                Book Appointment
            </button>
        </div>
    `;
    
    return doctorCard;
}

// Set up all event listeners
function setupEventListeners() {
    // Patient form submission
    document.getElementById('patientForm').addEventListener('submit', function(e) {
        e.preventDefault();
        savePatientDetails();
    });

    // Description form submission
    document.getElementById('descriptionForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitAppointment();
    });

    // Doctor login form submission
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        doctorLogin();
    });

    // Voice recording setup
    setupVoiceRecording();
}

// Setup voice recording functionality
function setupVoiceRecording() {
    const startBtn = document.getElementById('startRecording');
    const stopBtn = document.getElementById('stopRecording');
    const audioPreview = document.getElementById('audioPreview');

    startBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);
}

// Start voice recording
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            document.getElementById('audioPreview').src = audioUrl;
            document.getElementById('audioPreview').style.display = 'block';
            
            // Store audio blob for submission
            currentAppointment = {
                ...currentAppointment,
                audioBlob: audioBlob,
                audioUrl: audioUrl
            };
        };

        mediaRecorder.start();
        document.getElementById('startRecording').disabled = true;
        document.getElementById('stopRecording').disabled = false;
    } catch (error) {
        alert('Error accessing microphone: ' + error.message);
    }
}

// Stop voice recording
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        document.getElementById('startRecording').disabled = false;
        document.getElementById('stopRecording').disabled = true;
    }
}

// Doctor selection handler
function selectDoctor(doctorId) {
    currentDoctor = doctors.find(d => d.id === doctorId);
    if (!currentDoctor) {
        alert('Doctor not found. Please try again.');
        return;
    }
    currentAppointment = { doctor: currentDoctor };
    showPage('patientDetails');
}

// Save patient details and move to description page
function savePatientDetails() {
    const formData = new FormData(document.getElementById('patientForm'));
    
    currentPatient = {
        name: formData.get('name'),
        sex: formData.get('sex'),
        age: formData.get('age'),
        email: formData.get('email'),
        phone: formData.get('phone')
    };

    currentAppointment = {
        ...currentAppointment,
        patient: currentPatient,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    showPage('descriptionPage');
}

// Submit complete appointment
async function submitAppointment() {
    const submitButton = document.querySelector('#descriptionForm button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
    
    try {
        const writtenDescription = document.getElementById('writtenDescription').value;
        
        if (!writtenDescription && !currentAppointment.audioBlob) {
            throw new Error('Please provide either a written description or voice recording.');
        }
        
        const formData = new FormData();
        formData.append('doctorId', currentDoctor.id);
        formData.append('patientData', JSON.stringify(currentPatient));
        formData.append('writtenDescription', writtenDescription);
        
        if (currentAppointment.audioBlob) {
            formData.append('audioFile', currentAppointment.audioBlob, 'recording.wav');
        }
        
        const response = await fetch('/api/appointments', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to submit appointment');
        }
        
        const result = await response.json();
        currentAppointment.id = result.appointmentId;
        
        showPage('confirmationPage');
    } catch (error) {
        console.error('Error submitting appointment:', error);
        alert('Error submitting appointment: ' + error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Appointment';
    }
}


// Doctor login handler
async function doctorLogin() {
    const submitButton = document.querySelector('#loginForm button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Signing In...';
    
    try {
        const email = document.getElementById('doctorEmail').value;
        const password = document.getElementById('doctorPassword').value;
        
        const response = await apiCall('/api/doctor/login', {
            method: 'POST',
            body: { email, password }
        });
        
        currentDoctor = response.doctor;
        doctorToken = response.token;
        
        document.getElementById('doctorWelcome').textContent = `Welcome, ${currentDoctor.name}`;
        showPage('doctorDashboard');
        await loadDoctorDashboard();
    } catch (error) {
        console.error('Login error:', error);
        alert('Invalid email or password. Please try again.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Login';
    }
}

// Load doctor dashboard data
async function loadDoctorDashboard() {
    await Promise.all([
        loadAppRequests(),
        loadConfirmedAppointments()
    ]);
}

// Load appointment requests for doctor
async function loadAppRequests() {
    const requestsList = document.getElementById('requestsList');
    requestsList.innerHTML = '<div class="loading">Loading requests...</div>';
    
    try {
        const response = await apiCall(`/api/doctor/${currentDoctor.id}/appointments?status=pending`);
        const doctorRequests = response.appointments;
        
        requestsList.innerHTML = '';
        
        if (doctorRequests.length === 0) {
            requestsList.innerHTML = '<p class="text-center">No pending appointment requests</p>';
            return;
        }
        
        doctorRequests.forEach(request => {
            const requestCard = createRequestCard(request);
            requestsList.appendChild(requestCard);
        });
    } catch (error) {
        console.error('Error loading requests:', error);
        requestsList.innerHTML = '<p class="text-center error">Failed to load requests. Please try again.</p>';
    }
}

// Load confirmed appointments for doctor
async function loadConfirmedAppointments() {
    const appointmentsList = document.getElementById('appointmentsList');
    appointmentsList.innerHTML = '<div class="loading">Loading appointments...</div>';
    
    try {
        const response = await apiCall(`/api/doctor/${currentDoctor.id}/appointments?status=confirmed`);
        const confirmedAppointments = response.appointments;
        
        appointmentsList.innerHTML = '';
        
        if (confirmedAppointments.length === 0) {
            appointmentsList.innerHTML = '<p class="text-center">No confirmed appointments</p>';
            return;
        }
        
        confirmedAppointments.forEach(appointment => {
            const appointmentCard = createAppointmentCard(appointment);
            appointmentsList.appendChild(appointmentCard);
        });
    } catch (error) {
        console.error('Error loading appointments:', error);
        appointmentsList.innerHTML = '<p class="text-center error">Failed to load appointments. Please try again.</p>';
    }
}

// Create request card for appointment requests
function createRequestCard(request) {
    const card = document.createElement('div');
    card.className = 'request-card';
    
    card.innerHTML = `
        <h3>Appointment Request from ${request.patients.name}</h3>
        <div class="patient-info">
            <div class="info-item">
                <span class="info-label">Age/Sex:</span>
                <span class="info-value">${request.patients.age} / ${request.patients.sex}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Contact:</span>
                <span class="info-value">${request.patients.phone}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Email:</span>
                <span class="info-value">${request.patients.email}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Submitted:</span>
                <span class="info-value">${new Date(request.created_at).toLocaleDateString()}</span>
            </div>
        </div>
        
        ${request.written_description ? `
            <div class="info-item mt-2">
                <span class="info-label">Description:</span>
                <div class="info-value description-text">${request.written_description}</div>
            </div>
        ` : ''}
        
        ${request.audio_file_url ? `
            <div class="info-item mt-2">
                <span class="info-label">Voice Recording:</span>
                <audio controls src="${request.audio_file_url}" style="width: 100%;"></audio>
            </div>
        ` : ''}
        
        <div class="button-group mt-2">
            <button onclick="acceptAppointment('${request.id}')" class="btn-primary">Accept & Schedule</button>
        </div>
    `;
    
    return card;
}

// Create appointment card for confirmed appointments
function createAppointmentCard(appointment) {
    const card = document.createElement('div');
    card.className = 'appointment-card';
    
    const scheduledDate = appointment.scheduled_time ? 
        new Date(appointment.scheduled_time).toLocaleString() : 'Not scheduled';
    
    card.innerHTML = `
        <h3>Appointment with ${appointment.patients.name}</h3>
        <div class="patient-info">
            <div class="info-item">
                <span class="info-label">Age/Sex:</span>
                <span class="info-value">${appointment.patients.age} / ${appointment.patients.sex}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Scheduled Time:</span>
                <span class="info-value">${scheduledDate}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Contact:</span>
                <span class="info-value">${appointment.patients.phone}</span>
            </div>
        </div>
        
        <div class="button-group mt-2">
            <a href="${appointment.google_meet_link || 'https://meet.google.com/kpe-qfki-pdb'}" target="_blank" class="btn-primary">Join Google Meet</a>
            <button onclick="sendReminder('${appointment.id}')" class="btn-secondary">Send Reminder</button>
        </div>
    `;
    
    return card;
}

// Accept and schedule an appointment
async function acceptAppointment(appointmentId) {
    const scheduledTime = prompt('Enter appointment date and time (YYYY-MM-DD HH:MM format):\nExample: 2024-12-25 14:30');
    
    if (!scheduledTime) return;
    
    try {
        const response = await apiCall(`/api/appointments/${appointmentId}/confirm`, {
            method: 'PUT',
            body: { scheduledTime }
        });
        
        alert('Appointment confirmed! Patient has been notified via email.');
        
        // Reload dashboard
        await loadDoctorDashboard();
        showTab('appointments');
    } catch (error) {
        console.error('Error confirming appointment:', error);
        alert('Error confirming appointment: ' + error.message);
    }
}

// Send reminder to patient
function sendReminder(appointmentId) {
    alert('Reminder functionality would be implemented here. In a full system, this would send an email reminder to the patient.');
    console.log('Reminder requested for appointment:', appointmentId);
}

// Navigation functions
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
}

function goBackToDoctors() {
    showPage('doctorSelection');
}

function goBackToPatientDetails() {
    showPage('patientDetails');
}

function startNewBooking() {
    currentDoctor = null;
    currentPatient = null;
    currentAppointment = null;
    document.getElementById('patientForm').reset();
    document.getElementById('descriptionForm').reset();
    document.getElementById('audioPreview').style.display = 'none';
    showPage('doctorSelection');
}

function logout() {
    currentDoctor = null;
    doctorToken = null;
    document.getElementById('loginForm').reset();
    showPage('doctorLogin');
}

// Check URL parameters for direct doctor login
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('doctor') === 'login') {
        showPage('doctorLogin');
    }
}
