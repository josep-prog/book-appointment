// Description page functionality
class DescriptionPage {
    static init(doctor, patientData) {
        this.doctor = doctor;
        this.patientData = patientData;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        
        this.setupEventListeners();
    }

    static getHTML() {
        return `
            <div class="container">
                <h1 class="page-title">Describe Your Medical Concern</h1>
                <p class="text-center mb-3">You can describe your symptoms using text, audio, or both</p>
                
                <form id="description-form">
                    <!-- Text Description -->
                    <div class="form-group">
                        <label class="form-label" for="written-description">Written Description *</label>
                        <textarea 
                            id="written-description" 
                            class="form-textarea" 
                            required 
                            placeholder="Please describe your symptoms, concerns, or medical issues in detail. Include information about when it started, severity, and any other relevant details."
                            rows="6"
                        ></textarea>
                    </div>

                    <!-- Audio Description -->
                    <div class="form-group">
                        <label class="form-label">Audio Description (Optional)</label>
                        <p class="mb-2">You can record an audio message if you prefer to speak about your concerns.</p>
                        
                        <div class="audio-controls">
                            <button type="button" id="start-recording" class="btn btn-primary">
                                Start Recording
                            </button>
                            <button type="button" id="stop-recording" class="btn btn-danger" disabled>
                                Stop Recording
                            </button>
                            <button type="button" id="play-recording" class="btn btn-success" disabled>
                                Play Recording
                            </button>
                        </div>
                        
                        <div id="recording-status" class="recording-status"></div>
                        <audio id="audio-playback" controls class="mt-2" style="display: none;"></audio>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-primary" onclick="DescriptionPage.goBack()">Go Back</button>
                        <button type="submit" class="btn btn-success">Submit Appointment Request</button>
                    </div>
                </form>
            </div>
        `;
    }

    static setupEventListeners() {
        const form = document.getElementById('description-form');
        form.addEventListener('submit', this.handleFormSubmit.bind(this));
        
        // Audio recording functionality
        document.getElementById('start-recording').addEventListener('click', this.startRecording.bind(this));
        document.getElementById('stop-recording').addEventListener('click', this.stopRecording.bind(this));
        document.getElementById('play-recording').addEventListener('click', this.playRecording.bind(this));
    }

    static async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.audioUrl = URL.createObjectURL(audioBlob);
                
                document.getElementById('audio-playback').src = this.audioUrl;
                document.getElementById('audio-playback').style.display = 'block';
                document.getElementById('play-recording').disabled = false;
                
                this.updateRecordingStatus('Recording completed. Click "Play Recording" to review.');
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            
            // Update UI
            document.getElementById('start-recording').disabled = true;
            document.getElementById('stop-recording').disabled = false;
            this.updateRecordingStatus('Recording in progress... Click "Stop Recording" when finished.');
            
        } catch (error) {
            console.error('Error starting recording:', error);
            Utils.showMessage('Error accessing microphone. Please check your permissions.', 'error');
        }
    }

    static stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            // Stop all tracks
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            
            // Update UI
            document.getElementById('start-recording').disabled = false;
            document.getElementById('stop-recording').disabled = true;
        }
    }

    static playRecording() {
        const audioPlayback = document.getElementById('audio-playback');
        audioPlayback.play().catch(error => {
            console.error('Error playing recording:', error);
            Utils.showMessage('Error playing recording.', 'error');
        });
    }

    static updateRecordingStatus(message) {
        document.getElementById('recording-status').textContent = message;
    }

    static handleFormSubmit(e) {
        e.preventDefault();
        
        if (this.validateForm()) {
            const descriptionData = this.getFormData();
            window.App.submitAppointment(descriptionData);
        }
    }

    static validateForm() {
        const writtenDescription = document.getElementById('written-description').value.trim();
        
        if (!writtenDescription) {
            Utils.showMessage('Please provide a written description of your medical concern.', 'error');
            return false;
        }
        
        if (writtenDescription.length < 10) {
            Utils.showMessage('Please provide a more detailed description (at least 10 characters).', 'error');
            return false;
        }
        
        return true;
    }

    static getFormData() {
        return {
            writtenDescription: document.getElementById('written-description').value.trim(),
            hasAudio: !!this.audioUrl,
            audioUrl: this.audioUrl || null,
            submittedAt: new Date().toISOString()
        };
    }

    static goBack() {
        window.App.loadPatientDetailsPage();
    }
}
