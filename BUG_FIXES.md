# Bug Fixes Summary

## Issues Identified and Fixed

### 1. Console Error: TypeError - Cannot read properties of undefined (reading 'target')

**Location:** `script.js:546`

**Root Cause:**
The `showTab()` function was trying to access `event.target` without the `event` parameter being defined. When called programmatically from `acceptAppointment()` on line 516, no event object was passed.

**Fix Applied:**
- Modified `showTab()` to accept an optional `event` parameter
- Added conditional logic to handle both click events and programmatic calls
- When no event is provided, the function now searches for the appropriate tab button by matching the `onclick` attribute
- Updated HTML onclick handlers to explicitly pass the `event` parameter

**Files Modified:**
- `script.js` (lines 537-559)
- `index.html` (lines 168-169)

---

### 2. Stream.io Error: Users don't exist

**Location:** `server.js` - `generateVideoCallLink()` function

**Error Message:**
```
The following users are involved in call create operation, but don't exist: 
[doctor-4afa51c3-2d75-46e0-8def-55439cfb29c6 patient-4afa51c3-2d75-46e0-8def-55439cfb29c6]. 
Please create users before referencing them in a call.
```

**Root Cause:**
The code was attempting to create a Stream.io call with member user IDs that hadn't been created in the Stream.io system yet. Stream.io requires users to exist before they can be added to calls.

**Fix Applied:**
- Added `upsertUsers()` call before creating the call to register both doctor and patient users
- Users are now created with proper metadata (name, role) before being referenced in the call
- Changed `created_by_id` from static 'doctor' string to the actual doctor user ID

**Files Modified:**
- `server.js` (lines 626-687)

---

### 3. Email Error: ECONNREFUSED 127.0.0.1:587

**Location:** `server.js` - nodemailer configuration

**Error Message:**
```
Email send failed: connect ECONNREFUSED 127.0.0.1:587
```

**Root Cause:**
The nodemailer transporter was configured with `service: process.env.EMAIL_SERVICE`, but this environment variable was not set in the `.env` file. Without a proper service name, nodemailer defaulted to trying localhost (127.0.0.1) instead of Gmail's SMTP server.

**Fix Applied:**
- Changed nodemailer configuration to explicitly use Gmail's SMTP server
- Set `host: 'smtp.gmail.com'`
- Set `port: 587` (STARTTLS)
- Set `secure: false` to use TLS instead of SSL
- Removed dependency on `EMAIL_SERVICE` environment variable

**Files Modified:**
- `server.js` (lines 35-42)

---

## Environment Variables Used

The following environment variables from `.env` are being used:
- `EMAIL_USER`: Gmail address for sending emails
- `EMAIL_APP_PASSWORD`: Gmail app-specific password
- `STREAM_API_KEY`: Stream.io API key
- `STREAM_API_SECRET`: Stream.io API secret
- `SUPABASE_URL`: Supabase database URL
- `SUPABASE_SERVICE_KEY`: Supabase service role key

---

## Testing Recommendations

1. **Test the tab navigation:**
   - Login as a doctor
   - Accept an appointment
   - Verify that the "Appointments" tab activates properly without console errors

2. **Test Stream.io integration:**
   - Accept an appointment to trigger video call link generation
   - Check terminal logs to ensure no Stream.io errors
   - Verify the call is created successfully

3. **Test email delivery:**
   - Accept an appointment with a valid email address
   - Check that confirmation emails are sent successfully
   - Monitor terminal for any SMTP connection errors

---

## Additional Notes

- The Gmail app password in `.env` appears valid
- All fixes maintain backward compatibility
- Error handling has been preserved with fallbacks where appropriate
- The `showTab()` function now works both as an event handler and when called programmatically
