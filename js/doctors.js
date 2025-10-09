// Doctors page functionality
class DoctorsPage {
    static init() {
        this.loadDoctors();
        this.setupSearch();
    }

    static loadDoctors() {
        const doctorsContainer = document.getElementById('doctors-page');
        doctorsContainer.innerHTML = this.getDoctorsHTML();
        
        // Add event listeners to book buttons
        document.querySelectorAll('.book-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const doctorId = e.target.dataset.doctorId;
                const doctor = this.getDoctorById(doctorId);
                if (doctor) {
                    window.App.selectDoctor(doctor);
                }
            });
        });
    }

    static getDoctorsHTML() {
        const doctors = this.getDoctorsList();
        
        return `
            <div class="doctors-header">
                <h2>Available Doctors in Rwanda</h2>
                <div class="search-box">
                    <input type="text" id="doctor-search" placeholder="Search doctors by name or specialization..." class="form-input">
                </div>
            </div>
            
            <div class="doctors-list" id="doctors-list">
                ${doctors.map(doctor => `
                    <div class="doctor-card" data-doctor-id="${doctor.id}">
                        <div class="doctor-name">${doctor.name}</div>
                        <div class="doctor-specialization">Specialization: ${doctor.specialization}</div>
                        <div class="doctor-experience">Experience: ${doctor.experience}</div>
                        <div class="doctor-availability">Available: ${doctor.availability}</div>
                        <div class="doctor-location">Location: ${doctor.location}</div>
                        <div class="doctor-bio">${doctor.bio}</div>
                        <button class="btn btn-primary book-btn mt-2" data-doctor-id="${doctor.id}">
                            Book Appointment
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    static setupSearch() {
        const searchInput = document.getElementById('doctor-search');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.filterDoctors(e.target.value);
            }, 300));
        }
    }

    static filterDoctors(searchTerm) {
        const doctors = this.getDoctorsList();
        const filteredDoctors = doctors.filter(doctor => 
            doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doctor.specialization.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doctor.location.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const doctorsList = document.getElementById('doctors-list');
        doctorsList.innerHTML = filteredDoctors.map(doctor => `
            <div class="doctor-card" data-doctor-id="${doctor.id}">
                <div class="doctor-name">${doctor.name}</div>
                <div class="doctor-specialization">Specialization: ${doctor.specialization}</div>
                <div class="doctor-experience">Experience: ${doctor.experience}</div>
                <div class="doctor-availability">Available: ${doctor.availability}</div>
                <div class="doctor-location">Location: ${doctor.location}</div>
                <div class="doctor-bio">${doctor.bio}</div>
                <button class="btn btn-primary book-btn mt-2" data-doctor-id="${doctor.id}">
                    Book Appointment
                </button>
            </div>
        `).join('');

        // Re-attach event listeners
        document.querySelectorAll('.book-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const doctorId = e.target.dataset.doctorId;
                const doctor = this.getDoctorById(doctorId);
                if (doctor) {
                    window.App.selectDoctor(doctor);
                }
            });
        });
    }

    static getDoctorsList() {
        // In a real app, this would come from an API
        return [
            {
                id: 'doc_1',
                name: 'Dr. Alice Uwase',
                specialization: 'Cardiologist',
                experience: '10 years',
                availability: 'Monday - Friday, 8:00 AM - 4:00 PM',
                location: 'Kigali, Rwanda',
                bio: 'Specialized in heart diseases and cardiovascular health. Provides comprehensive cardiac care.',
                email: 'dr.alice@rwandahealth.rw'
            },
            {
                id: 'doc_2',
                name: 'Dr. James Mugisha',
                specialization: 'Pediatrician',
                experience: '8 years',
                availability: 'Tuesday - Saturday, 9:00 AM - 5:00 PM',
                location: 'Kigali, Rwanda',
                bio: 'Expert in child healthcare and development. Passionate about children\'s wellbeing.',
                email: 'dr.james@rwandahealth.rw'
            },
            {
                id: 'doc_3',
                name: 'Dr. Marie Kamali',
                specialization: 'Dermatologist',
                experience: '12 years',
                availability: 'Monday - Thursday, 10:00 AM - 6:00 PM',
                location: 'Kigali, Rwanda',
                bio: 'Specialized in skin conditions and cosmetic dermatology. Committed to skin health.',
                email: 'dr.marie@rwandahealth.rw'
            },
            {
                id: 'doc_4',
                name: 'Dr. Patrick Habimana',
                specialization: 'General Practitioner',
                experience: '15 years',
                availability: 'Monday - Friday, 8:00 AM - 6:00 PM',
                location: 'Kigali, Rwanda',
                bio: 'Provides comprehensive primary healthcare services for all ages.',
                email: 'dr.patrick@rwandahealth.rw'
            }
        ];
    }

    static getDoctorById(doctorId) {
        return this.getDoctorsList().find(doctor => doctor.id === doctorId);
    }
}
