// Doctor dashboard functionality
class DoctorDashboard {
    static init(doctorEmail) {
        this.doctorEmail = doctorEmail;
        this.currentSection = 'app-request';
        this.setupEventListeners();
        this.loadAppRequests();
    }

    static getHTML(doctorEmail) {
        const doctor = this.getDoctorByEmail(doctorEmail);
        
        return `
            <div class="dashboard">
                <div class="sidebar">
                    <h3>Doctor Dashboard</h3>
                    <p>Welcome, <strong>${doctor ? doctor.name : 'Doctor'}</strong></p>
                    
                    <ul class="sidebar-menu">
                        <li><a href="#" class="nav-link active" data-section="app-request">Appointment Requests</a></li>
                        <li><a href="#" class="nav-link" data-section="appointment">Confirmed Appointments</a></li>
                        <li><a href="#" class="nav-link" onclick="DoctorDashboard.logout()">Logout</a></li>
                    </ul>
                </div>
                
                <div class="dashboard-content">
                    <div id="app-request-section" class="dashboard-section">
                        <h2>Appointment Requests</h2>
                        <div id="app-requests-list">
                            <!-- Appointment requests will be loaded here -->
                        </div>
                    </div>
                    
                    <div id="appointment-section" class="dashboard-section hidden">
                        <h2>Confirmed Appointments</h2>
                        <div id="appointments-list">
                            <!-- Confirmed appointments will be loaded here -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    static setupEventListeners() {
        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.dataset.section;
                if (section) {
                    this.switchSection(section);
                }
            });
        });
    }

    static switchSection(section) {
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Show/hide sections
        document.getElementById('app-request-section').classList.toggle('hidden', section !== 'app-request');
        document.getElementById('appointment-section').classList.toggle('hidden', section !== 'appointment');
        
        this.currentSection = section;
        
        // Load appropriate data
        if (section === 'app-request') {
            this.loadAppRequests();
        } else if (section === 'appointment') {
            this.loadConfirmedAppointments();
        }
    }

    static loadAppRequests() {
        const appointments = this.getAppointments();
        const doctorAppointments = appointments.filter(app => 
            app.doctor.email === this.doctorEmail && app.status === 'pending'
        );
        
        const requestsList = document.getElementById('app-requests-list');
        
        if (doctorAppointments.length === 0) {
            requestsList.innerHTML = '<p>No pending appointment requests.</p>';
            return;
        }
        
        requestsList.innerHTML = doctorAppointments.map(app => `
            <div class="appointment-card" data-appointment-id="${app.id}">
                <div class="appointment-header">
                    <div class="patient-name">${app.patient.name}</div>
                    <div class="appointment-status status-pending">Pending</div>
                </div>
                
                <div class="patient-details">
                    <p><strong>Gender:</strong> ${app.patient.gender}</p>
                    <p><strong>Age:</strong> ${app.patient.age}</p>
                    <p><strong>Email:</strong> ${app.patient.email}</p>
                    <p><strong>Phone:</strong> ${app.patient.phone}</p>
                    ${app.patient.address ? `<p><strong>Address:</strong> ${app.patient.address}</p>` : ''}
                </div>
                
                <div class="description-section">
                    <h4>Medical Description:</h4>
                    <p>${app.description.writtenDescription}</p>
                    
                    ${app.description.hasAudio ? `
                        <div class="audio-section">
                            <h5>Audio Description:</h5>
                            <audio controls src="${app.description.audioUrl}">
                                Your browser does not support the audio element.
                            </audio>
                        </div>
                    ` : ''}
                </div>
                
                <div class="appointment-actions">
                    <button class="btn btn-success" onclick="DoctorDashboard.acceptAppointment('${app.id}')">
                        Accept Appointment
                    </button>
                    <button class="btn btn-danger" onclick="DoctorDashboard.rejectAppointment('${app.id}')">
                        Reject
                    </button>
                </div>
            </div>
        `).join('');
    }

    static loadConfirmedAppointments() {
        const appointments = this.getAppointments();
        const confirmedAppointments = appointments.filter(app => 
            app.doctor.email === this.doctorEmail && app.status === 'confirmed'
        );
        
        const appointmentsList = document.getElementById('appointments-list');
        
        if (confirmedAppointments.length === 0) {
            appointmentsList.innerHTML = '<p>No confirmed appointments.</p>';
            return;
        }
        
        appointmentsList.innerHTML = confirmedAppointments.map(app => `
            <div class="appointment-card" data-appointment-id="${app.id}">
                <div class="appointment-header">
                    <div class="patient-name">${app.patient.name}</div>
                    <div class="appointment-status status-confirmed">Confirmed</div>
                </div>
                
                <div class="appointment-details">
                    <p><strong>Appointment Time:</strong> ${Utils.formatDate(app.scheduledTime)}</p>
                    <p><strong>Patient:</strong> ${app.patient.name} (${app.patient.age} years, ${app.patient.gender})</p>
                    <p><strong>Contact:</strong> ${app.patient.email} | ${app.patient.phone}</p>
                </div>
                
                <div class="video-call-section">
                    <h4>Video Consultation</h4>
                    <p>Join the Google Meet session using the link below:</p>
                    <a href="${app.meetLink}" target="_blank" class="btn btn-primary">
                        Join Google Meet Session
                    </a>
                </div>
                
                <div class="appointment-notes">
                    <h5>Patient's Description:</h5>
                    <p>${app.description.writtenDescription}</p>
                </div>
            </div>
        `).join('');
    }

    static acceptAppointment(appointmentId) {
        const appointments = this.getAppointments();
        const appointment = appointments.find(app => app.id === appointmentId);
        
        if (appointment) {
            // Schedule for next available time (in real app, doctor would choose time)
            const scheduledTime = new Date();
            scheduledTime.setDate(scheduledTime.getDate() + 1); // Tomorrow
            scheduledTime.setHours(10, 0, 0, 0); // 10:00 AM
            
            appointment.status = 'confirmed';
            appointment.scheduledTime = scheduledTime.toISOString();
            appointment.meetLink = this.generateMeetLink();
            appointment.confirmedAt = new Date().toISOString();
            
            // Save updated appointments
            localStorage.setItem('appointments', JSON.stringify(appointments));
            
            // Send email notification (in real app, this would be a server call)
            this.sendAppointmentConfirmationEmail(appointment);
            
            Utils.showMessage('Appointment accepted! Patient has been notified.', 'success');
            
            // Reload the lists
            this.loadAppRequests();
        }
    }

    static rejectAppointment(appointmentId) {
        const appointments = this.getAppointments();
        const appointmentIndex = appointments.findIndex(app => app.id === appointmentId);
        
        if (appointmentIndex !== -1) {
            appointments.splice(appointmentIndex, 1);
            localStorage.setItem('appointments', JSON.stringify(appointments));
            
            Utils.showMessage('Appointment request rejected.', 'success');
            this.loadAppRequests();
        }
    }

    static generateMeetLink() {
        // In real app, this would generate actual Google Meet links
        const randomId = Math.random().toString(36).substring(2, 15);
        return `https://meet.google.com/${randomId}`;
    }

    static sendAppointmentConfirmationEmail(appointment) {
        // In real app, this would send actual emails
        console.log('Email sent to:', appointment.patient.email);
        console.log('Appointment confirmed for:', Utils.formatDate(appointment.scheduledTime));
        console.log('Meet link:', appointment.meetLink);
        
        // Simulate email sending
        const emailData = {
            to: appointment.patient.email,
            subject: 'Appointment Confirmation - Rwanda Health',
            body: `
                Dear ${appointment.patient.name},
                
                Your appointment has been confirmed!
                
                Doctor: ${appointment.doctor.name}
                Date & Time: ${Utils.formatDate(appointment.scheduledTime)}
                Consultation: Video Call
                
                Join your appointment using this link:
                ${appointment.meetLink}
                
                Please join 5 minutes before your scheduled time.
                
                Best regards,
                Rwanda Health Team
            `
        };
        
        console.log('Email content:', emailData);
        Utils.showMessage('Confirmation email sent to patient.', 'success');
    }

    static getAppointments() {
        return JSON.parse(localStorage.getItem('appointments') || '[]');
    }

    static getDoctorByEmail(email) {
        const doctors = [
            { email: 'dr.alice@rwandahealth.rw', name: 'Dr. Alice Uwase' },
            { email: 'dr.james@rwandahealth.rw', name: 'Dr. James Mugisha' },
            { email: 'dr.marie@rwandahealth.rw', name: 'Dr. Marie Kamali' },
            { email: 'dr.patrick@rwandahealth.rw', name: 'Dr. Patrick Habimana' }
        ];
        
        return doctors.find(doctor => doctor.email === email);
    }

    static logout() {
        if (confirm('Are you sure you want to logout?')) {
            window.App.loadHomePage();
        }
    }
}
