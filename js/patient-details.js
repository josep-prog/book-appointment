// Patient details page functionality
class PatientDetailsPage {
    static init() {
        this.setupFormValidation();
    }

    static getHTML(doctor) {
        return `
            <div class="container">
                <h1 class="page-title">Patient Information</h1>
                <p class="text-center mb-3">You are booking with: <strong>${doctor.name}</strong> - ${doctor.specialization}</p>
                
                <form id="patient-details-form">
                    <div class="form-group">
                        <label class="form-label" for="patient-name">Full Name *</label>
                        <input type="text" id="patient-name" class="form-input" required placeholder="Enter your full name">
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="patient-gender">Gender *</label>
                        <select id="patient-gender" class="form-select" required>
                            <option value="">Select Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                            <option value="prefer-not-to-say">Prefer not to say</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="patient-age">Age *</label>
                        <input type="number" id="patient-age" class="form-input" required min="1" max="120" placeholder="Enter your age">
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="patient-email">Email Address *</label>
                        <input type="email" id="patient-email" class="form-input" required placeholder="Enter your email address">
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="patient-phone">Phone Number *</label>
                        <input type="tel" id="patient-phone" class="form-input" required placeholder="Enter your phone number (07X XXX XXXX)">
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="patient-address">Address (Optional)</label>
                        <textarea id="patient-address" class="form-textarea" placeholder="Enter your address"></textarea>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-primary" onclick="PatientDetailsPage.goBack()">Go Back</button>
                        <button type="submit" class="btn btn-success">Continue to Description</button>
                    </div>
                </form>
            </div>
        `;
    }

    static setupFormValidation() {
        const form = document.getElementById('patient-details-form');
        form.addEventListener('submit', this.handleFormSubmit.bind(this));
        
        // Real-time validation
        document.getElementById('patient-email').addEventListener('blur', this.validateEmail);
        document.getElementById('patient-phone').addEventListener('blur', this.validatePhone);
    }

    static handleFormSubmit(e) {
        e.preventDefault();
        
        if (this.validateForm()) {
            const patientData = this.getFormData();
            window.App.savePatientDetails(patientData);
        }
    }

    static validateForm() {
        let isValid = true;

        // Validate name
        const name = document.getElementById('patient-name').value.trim();
        if (!name) {
            this.showFieldError('patient-name', 'Please enter your full name');
            isValid = false;
        } else {
            this.clearFieldError('patient-name');
        }

        // Validate gender
        const gender = document.getElementById('patient-gender').value;
        if (!gender) {
            this.showFieldError('patient-gender', 'Please select your gender');
            isValid = false;
        } else {
            this.clearFieldError('patient-gender');
        }

        // Validate age
        const age = document.getElementById('patient-age').value;
        if (!age || age < 1 || age > 120) {
            this.showFieldError('patient-age', 'Please enter a valid age (1-120)');
            isValid = false;
        } else {
            this.clearFieldError('patient-age');
        }

        // Validate email
        if (!this.validateEmail()) {
            isValid = false;
        }

        // Validate phone
        if (!this.validatePhone()) {
            isValid = false;
        }

        return isValid;
    }

    static validateEmail() {
        const emailInput = document.getElementById('patient-email');
        const email = emailInput.value.trim();
        
        if (!email) {
            this.showFieldError('patient-email', 'Please enter your email address');
            return false;
        } else if (!Utils.isValidEmail(email)) {
            this.showFieldError('patient-email', 'Please enter a valid email address');
            return false;
        } else {
            this.clearFieldError('patient-email');
            return true;
        }
    }

    static validatePhone() {
        const phoneInput = document.getElementById('patient-phone');
        const phone = phoneInput.value.trim();
        
        if (!phone) {
            this.showFieldError('patient-phone', 'Please enter your phone number');
            return false;
        } else if (!Utils.isValidPhone(phone)) {
            this.showFieldError('patient-phone', 'Please enter a valid Rwanda phone number (07X XXX XXXX)');
            return false;
        } else {
            this.clearFieldError('patient-phone');
            return true;
        }
    }

    static showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const existingError = field.parentNode.querySelector('.field-error');
        
        if (existingError) {
            existingError.remove();
        }
        
        field.style.borderColor = '#e74c3c';
        
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.style.cssText = 'color: #e74c3c; font-size: 0.875rem; margin-top: 0.25rem;';
        errorElement.textContent = message;
        
        field.parentNode.appendChild(errorElement);
    }

    static clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        const existingError = field.parentNode.querySelector('.field-error');
        
        if (existingError) {
            existingError.remove();
        }
        
        field.style.borderColor = '#ddd';
    }

    static getFormData() {
        return {
            name: document.getElementById('patient-name').value.trim(),
            gender: document.getElementById('patient-gender').value,
            age: parseInt(document.getElementById('patient-age').value),
            email: document.getElementById('patient-email').value.trim(),
            phone: document.getElementById('patient-phone').value.trim(),
            address: document.getElementById('patient-address').value.trim(),
            submittedAt: new Date().toISOString()
        };
    }

    static goBack() {
        window.App.loadHomePage();
    }
}
