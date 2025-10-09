// Main application controller
class HospitalBookingApp {
    constructor() {
        this.currentPage = 'home';
        this.selectedDoctor = null;
        this.patientData = null;
        this.init();
    }

    init() {
        // Initialize event listeners
        this.setupEventListeners();
        
        // Load home page by default
        this.loadHomePage();
    }

    setupEventListeners() {
        // Navigation links
        document.getElementById('home-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.loadHomePage();
        });

        document.getElementById('doctor-login-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.loadDoctorLoginPage();
        });
    }

    loadHomePage() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = this.getHomePageHTML();
        
        // Initialize doctors page functionality
        DoctorsPage.init();
    }

    loadDoctorLoginPage() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = this.getDoctorLoginPageHTML();
        
        // Initialize doctor login functionality
        DoctorLogin.init();
    }

    getHomePageHTML() {
        return `
            <div class="container">
                <h1 class="page-title">Welcome to Rwanda Health</h1>
                <p class="text-center mb-3">Book your medical appointment easily without creating an account</p>
                
                <div id="doctors-page" class="page">
                    <!-- Doctors list will be loaded here by doctors.js -->
                </div>
            </div>
        `;
    }

    getDoctorLoginPageHTML() {
        return `
            <div class="container">
                <h1 class="page-title">Doctor Login</h1>
                <div id="doctor-login-page" class="page">
                    <!-- Doctor login form will be loaded here by doctor-login.js -->
                </div>
            </div>
        `;
    }

    // Method to select a doctor and proceed to patient details
    selectDoctor(doctor) {
        this.selectedDoctor = doctor;
        this.loadPatientDetailsPage();
    }

    loadPatientDetailsPage() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = PatientDetailsPage.getHTML(this.selectedDoctor);
        PatientDetailsPage.init();
    }

    // Method to save patient details and proceed to description
    savePatientDetails(patientData) {
        this.patientData = patientData;
        this.loadDescriptionPage();
    }

    loadDescriptionPage() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = DescriptionPage.getHTML();
        DescriptionPage.init(this.selectedDoctor, this.patientData);
    }

    // Method to submit final appointment
    submitAppointment(descriptionData) {
        // In a real app, this would send data to a server
        const appointment = {
            id: Utils.generateId(),
            doctor: this.selectedDoctor,
            patient: this.patientData,
            description: descriptionData,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // Save to localStorage (in real app, this would be a database)
        this.saveAppointmentToStorage(appointment);
        
        Utils.showMessage('Appointment request submitted successfully! The doctor will contact you soon.', 'success');
        
        // Return to home page after 3 seconds
        setTimeout(() => {
            this.loadHomePage();
        }, 3000);
    }

    saveAppointmentToStorage(appointment) {
        let appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
        appointments.push(appointment);
        localStorage.setItem('appointments', JSON.stringify(appointments));
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.App = new HospitalBookingApp();
});
