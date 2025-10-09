-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Doctors table
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    specialty VARCHAR(255) NOT NULL,
    availability TEXT,
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patients table
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    age INTEGER NOT NULL CHECK (age > 0 AND age <= 150),
    sex VARCHAR(10) NOT NULL CHECK (sex IN ('male', 'female', 'other')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Appointments table
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    written_description TEXT,
    audio_file_url TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    scheduled_time TIMESTAMP WITH TIME ZONE,
    google_meet_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_scheduled_time ON appointments(scheduled_time);
CREATE INDEX idx_doctors_email ON doctors(email);
CREATE INDEX idx_appointments_created_at ON appointments(created_at);

-- Insert sample doctors data
INSERT INTO doctors (name, email, password_hash, specialty, availability, phone) VALUES
('Dr. Alice Mukamana', 'dr.alice@hospital.rw', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Cardiologist', 'Monday-Friday: 9:00 AM - 5:00 PM', '+250-788-123-456'),
('Dr. James Nkusi', 'dr.james@hospital.rw', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Pediatrician', 'Monday-Saturday: 8:00 AM - 4:00 PM', '+250-788-234-567'),
('Dr. Marie Uwase', 'dr.marie@hospital.rw', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dermatologist', 'Tuesday-Thursday: 10:00 AM - 6:00 PM', '+250-788-345-678'),
('Dr. Jean Uwimana', 'dr.jean@hospital.rw', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'General Practitioner', 'Monday-Friday: 7:00 AM - 3:00 PM', '+250-788-456-789'),
('Dr. Grace Nyirahabimana', 'dr.grace@hospital.rw', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Gynecologist', 'Monday-Friday: 9:00 AM - 5:00 PM', '+250-788-567-890');

-- Enable Row Level Security (RLS)
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Doctors can view and update their own records
CREATE POLICY "Doctors can view own profile" ON doctors
    FOR SELECT USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Doctors can update own profile" ON doctors
    FOR UPDATE USING (auth.jwt() ->> 'email' = email);

-- Anyone can view doctor profiles (for patient booking)
CREATE POLICY "Anyone can view doctor profiles" ON doctors
    FOR SELECT USING (true);

-- Patients policies
CREATE POLICY "Anyone can insert patients" ON patients
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Patients can view own records" ON patients
    FOR SELECT USING (true);

-- Appointments policies
CREATE POLICY "Anyone can insert appointments" ON appointments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Doctors can view their appointments" ON appointments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM doctors 
            WHERE doctors.id = appointments.doctor_id 
            AND doctors.email = auth.jwt() ->> 'email'
        )
    );

CREATE POLICY "Doctors can update their appointments" ON appointments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM doctors 
            WHERE doctors.id = appointments.doctor_id 
            AND doctors.email = auth.jwt() ->> 'email'
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions for the anon role (for public access)
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON doctors TO anon;
GRANT INSERT ON patients TO anon;
GRANT INSERT ON appointments TO anon;
GRANT SELECT ON appointments TO anon;
GRANT UPDATE ON appointments TO anon;
