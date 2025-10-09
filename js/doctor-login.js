// Doctor login functionality
class DoctorLogin {
    static init() {
        this.loadLoginForm();
    }

    static loadLoginForm() {
        const loginContainer = document.getElementById('doctor-login-page');
        loginContainer.innerHTML = this.getLoginFormHTML();
        this.setupFormValidation();
    }

    static getLoginFormHTML() {
        return `
            <form id="doctor-login-form">
                <div class="form-group">
                    <label class="form-label" for="doctor-email">Email Address</label>
                    <input type="email" id="doctor-email" class="form-input" required placeholder="Enter your professional email">
                </div>

                <div class="form-group">
                    <label class="form-label" for="doctor-password">Password</label>
                    <input type="password" id="doctor-password" class="form-input" required placeholder="Enter your password">
                </div>

                <button type="submit" class="btn btn-success btn-block">Login to Dashboard</button>
            </form>

            <div class="demo-credentials mt-3">
                <h3>Demo Credentials:</h3>
                <p><strong>Email:</strong> dr.alice@rwandahealth.rw</p>
                <p><strong>Password:</strong> demo123</p>
            </div>
        `;
    }

    static setupFormValidation() {
        const form = document.getElementById('doctor-login-form');
        form.addEventListener('submit', this.handleLogin.bind(this));
    }

    static handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('doctor-email').value.trim();
        const password = document.getElementById('doctor-password').value;
        
        if (this.authenticateDoctor(email, password)) {
            Utils.showMessage('Login successful! Redirecting to dashboard...', 'success');
            setTimeout(() => {
                this.redirectToDashboard(email);
            }, 1000);
        } else {
            Utils.showMessage('Invalid email or password. Please try again.', 'error');
        }
    }

    static authenticateDoctor(email, password) {
        // In a real app, this would verify against a secure database
        const doctors = [
            { email: 'dr.alice@rwandahealth.rw', password: 'demo123', name: 'Dr. Alice Uwase' },
            { email: 'dr.james@rwandahealth.rw', password: 'demo123', name: 'Dr. James Mugisha' },
            { email: 'dr.marie@rwandahealth.rw', password: 'demo123', name: 'Dr. Marie Kamali' },
            { email: 'dr.patrick@rwandahealth.rw', password: 'demo123', name: 'Dr. Patrick Habimana' }
        ];
        
        return doctors.some(doctor => doctor.email === email && doctor.password === password);
    }

    static redirectToDashboard(email) {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = DoctorDashboard.getHTML(email);
        DoctorDashboard.init(email);
    }
}
