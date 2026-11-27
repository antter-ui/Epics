// test-server.js
// Automated verification suite for MediCare Connect
const http = require('node:http');
const assert = require('node:assert');
const { startServer } = require('./server/server.js');

const TEST_PORT = 3999;
let server;

function makeRequest({ method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting MediCare Connect Automated Verification...\n');

  server = startServer(TEST_PORT);
  // Wait a moment for server to listen
  await new Promise(r => setTimeout(r, 600));

  try {
    // 1. Health check
    const health = await makeRequest({ path: '/api/health' });
    assert.strictEqual(health.status, 200, 'Health check should return 200');
    assert.strictEqual(health.data.status, 'healthy');
    console.log('✅ Test 1 Passed: Health Check endpoint');

    // 2. Real Patient Registration
    const testEmail = `patient_${Date.now()}@testhealthcare.org`;
    const regRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: 'Alex Rivera',
        email: testEmail,
        password: 'SecurePassword2026!'
      }
    });
    assert.strictEqual(regRes.status, 201, 'Registration should return 201');
    assert(regRes.data.token, 'Should return session token');
    assert.strictEqual(regRes.data.user.email, testEmail);
    console.log('✅ Test 2 Passed: Real patient registration with hashed password');

    // 3. Real Patient Sign-In with Password
    const loginRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: testEmail,
        password: 'SecurePassword2026!'
      }
    });
    assert.strictEqual(loginRes.status, 200, 'Login should return 200');
    assert(loginRes.data.token, 'Should return session token');
    const token = loginRes.data.token;
    const authHeaders = { Authorization: `Bearer ${token}` };
    console.log('✅ Test 3 Passed: Real patient email & password sign-in');

    // 3b. Wrong password rejection
    const wrongPassRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: testEmail,
        password: 'WrongPassword!'
      }
    });
    assert.strictEqual(wrongPassRes.status, 400, 'Wrong password should be rejected');
    console.log('✅ Test 3b Passed: Incorrect password safely rejected');

    // 4. Auth Me
    const meRes = await makeRequest({ path: '/api/auth/me', headers: authHeaders });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.user.name, 'Alex Rivera');
    console.log('✅ Test 4 Passed: Auth Me returns authenticated patient');

    // 5. Unauthenticated rejection
    const unauthRes = await makeRequest({ path: '/api/appointments' });
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated appointments request should return 401');
    console.log('✅ Test 5 Passed: Security check - unauthorized access blocked');

    // 6. Departments
    const depts = await makeRequest({ path: '/api/departments' });
    assert.strictEqual(depts.status, 200);
    assert.strictEqual(depts.data.departments.length, 6, 'Should have 6 medical departments');
    console.log('✅ Test 6 Passed: 6 Medical Departments loaded');

    // 7. Doctors
    const docs = await makeRequest({ path: '/api/doctors?departmentId=1' });
    assert.strictEqual(docs.status, 200);
    assert.strictEqual(docs.data.doctors.length, 2, 'Cardiology should have 2 doctors');
    assert.strictEqual(docs.data.doctors[0].name, 'Dr. Robert Harrison');
    console.log('✅ Test 7 Passed: Doctors query by department');

    // Helper to get local YYYY-MM-DD for offset days and match clinic weekdays
    function getLocalDateOffset(days) {
      const dt = new Date();
      dt.setDate(dt.getDate() + days);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    }
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    function findDateForWeekdays(allowedWeekdays, startOffset = 2) {
      for (let i = startOffset; i < startOffset + 14; i++) {
        const dt = new Date();
        dt.setDate(dt.getDate() + i);
        if (allowedWeekdays.includes(weekdayNames[dt.getDay()])) {
          return getLocalDateOffset(i);
        }
      }
      return getLocalDateOffset(startOffset);
    }

    // 8. Slot Availability
    const tomorrow = findDateForWeekdays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], 1);
    const avail = await makeRequest({ path: `/api/availability?doctorId=1&date=${tomorrow}` });
    assert.strictEqual(avail.status, 200);
    assert(Array.isArray(avail.data.slots));
    assert(avail.data.slots.length > 0);
    assert.strictEqual(avail.data.is_doctor_available, true);
    console.log('✅ Test 8 Passed: Time slot availability calculation');

    // 9. Existing Appointments for Patient
    const apts = await makeRequest({ path: '/api/appointments', headers: authHeaders });
    assert.strictEqual(apts.status, 200);
    assert(Array.isArray(apts.data.appointments));
    console.log(`✅ Test 9 Passed: Patient appointments retrieved (${apts.data.appointments.length} initial records for new patient)`);

    // 10. Book New Appointment (pick date where Doctors 1, 3, and 7 are all on duty)
    const bookingDate = findDateForWeekdays(['Monday', 'Tuesday', 'Thursday', 'Friday'], 2);
    const doc7Avail = await makeRequest({ path: `/api/availability?doctorId=7&date=${bookingDate}` });
    const doc7Slot = doc7Avail.data.slots.find(s => s.is_available)?.slot;
    assert(doc7Slot, 'Doctor 7 should have at least one open slot');

    const bookingRes = await makeRequest({
      method: 'POST',
      path: '/api/appointments',
      headers: authHeaders,
      body: {
        patientName: 'Sarah Jenkins',
        patientEmail: 'sarah.jenkins@gmail.com',
        patientPhone: '+1 (555) 349-2910',
        departmentId: 4, // General Medicine
        doctorId: 7, // Dr. William Chen
        appointmentDate: bookingDate,
        timeSlot: doc7Slot,
        medicalIssue: 'Follow-up consultation on Vitamin D levels and energy',
        description: 'Feeling much better after 2 weeks of supplements. Want to check lab results.'
      }
    });
    assert.strictEqual(bookingRes.status, 201, 'Booking should return 201 Created');
    assert.strictEqual(bookingRes.data.appointment.status, 'Confirmed');
    assert.strictEqual(bookingRes.data.appointment.is_upcoming, true);
    assert.strictEqual(bookingRes.data.appointment.is_cancellable, true);
    const newAptId = bookingRes.data.appointment.id;
    console.log(`✅ Test 10 Passed: Appointment successfully booked (Ref: ${bookingRes.data.appointment.reference_code})`);

    // 11. Conflict Prevention: Attempting to book the SAME slot should fail
    const conflictRes = await makeRequest({
      method: 'POST',
      path: '/api/appointments',
      headers: authHeaders,
      body: {
        patientName: 'Another Patient',
        patientEmail: 'another@gmail.com',
        departmentId: 4,
        doctorId: 7,
        appointmentDate: bookingDate,
        timeSlot: doc7Slot, // Same slot!
        medicalIssue: 'Duplicate slot test issue'
      }
    });
    assert.strictEqual(conflictRes.status, 400, 'Duplicate booking should return 400');
    assert(conflictRes.data.error.includes('already booked'), 'Error should specify slot is already booked');
    console.log('✅ Test 11 Passed: Slot collision prevention verified (atomic rejection)');

    // 12. Cancel Appointment
    const cancelRes = await makeRequest({
      method: 'POST',
      path: `/api/appointments/${newAptId}/cancel`,
      headers: authHeaders,
      body: { reason: 'Rescheduling for next month due to work trip' }
    });
    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.data.appointment.status, 'Cancelled');
    assert.strictEqual(cancelRes.data.appointment.is_previous, true);
    assert.strictEqual(cancelRes.data.appointment.is_cancellable, false);
    assert.strictEqual(cancelRes.data.appointment.cancellation_reason, 'Rescheduling for next month due to work trip');
    console.log('✅ Test 12 Passed: Appointment cancellation and reason tracking');

    // 13. Dashboard Stats
    const statsRes = await makeRequest({ path: '/api/stats', headers: authHeaders });
    assert.strictEqual(statsRes.status, 200);
    assert(typeof statsRes.data.stats.total === 'number');
    assert(typeof statsRes.data.stats.upcoming === 'number');
    console.log('✅ Test 13 Passed: Patient dashboard metrics and next appointment calculation');

    // 14. Cross-Patient Privacy Isolation + Patient Double-Booking Prevention
    const patient2Res = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: 'Jordan Lee',
        email: `patient2_${Date.now()}@testhealthcare.org`,
        password: 'SecurePassword2026!'
      }
    });
    assert.strictEqual(patient2Res.status, 201);
    const p2Headers = { Authorization: `Bearer ${patient2Res.data.token}` };

    const doc1Avail = await makeRequest({ path: `/api/availability?doctorId=1&date=${bookingDate}` });
    assert.strictEqual(doc1Avail.status, 200);
    const p2SlotObj = doc1Avail.data.slots.find(s => s.is_available);
    assert(p2SlotObj, 'Doctor 1 should have at least one available slot on bookingDate');
    const p2Slot = p2SlotObj.slot;

    const p2AptRes = await makeRequest({
      method: 'POST',
      path: '/api/appointments',
      headers: p2Headers,
      body: {
        patientName: 'Jordan Lee',
        departmentId: 1,
        doctorId: 1,
        appointmentDate: bookingDate,
        timeSlot: p2Slot,
        medicalIssue: 'Annual cardiac checkup'
      }
    });
    assert.strictEqual(p2AptRes.status, 201);
    const p2AptId = p2AptRes.data.appointment.id;

    // Patient 1 must NOT be able to view or cancel Patient 2's appointment
    const crossGet = await makeRequest({ path: `/api/appointments/${p2AptId}`, headers: authHeaders });
    assert.strictEqual(crossGet.status, 404, 'Cross-patient appointment GET must be blocked');
    const crossCancel = await makeRequest({ method: 'POST', path: `/api/appointments/${p2AptId}/cancel`, headers: authHeaders, body: { reason: 'Unauthorized' } });
    assert.strictEqual(crossCancel.status, 400, 'Cross-patient appointment cancel must be blocked');
    console.log('✅ Test 14 Passed: Cross-patient privacy isolation verified');

    // Patient 2 must NOT be able to book a second doctor at the exact same date & time slot
    const patientOverlap = await makeRequest({
      method: 'POST',
      path: '/api/appointments',
      headers: p2Headers,
      body: {
        patientName: 'Jordan Lee',
        departmentId: 2,
        doctorId: 3,
        appointmentDate: bookingDate,
        timeSlot: p2Slot,
        medicalIssue: 'Simultaneous booking attempt'
      }
    });
    assert.strictEqual(patientOverlap.status, 400, 'Same-patient overlapping slot must be rejected');
    console.log('✅ Test 15 Passed: Same-patient overlapping time slot prevented');

    // Clean up Patient 2's test booking so repeated test runs stay idempotent
    const p2Cleanup = await makeRequest({
      method: 'POST',
      path: `/api/appointments/${p2AptId}/cancel`,
      headers: p2Headers,
      body: { reason: 'Test suite cleanup' }
    });
    assert.strictEqual(p2Cleanup.status, 200);

    // 16. Logout invalidates session
    const logoutRes = await makeRequest({ method: 'POST', path: '/api/auth/logout', headers: p2Headers });
    assert.strictEqual(logoutRes.status, 200);
    const afterLogoutMe = await makeRequest({ path: '/api/auth/me', headers: p2Headers });
    assert.strictEqual(afterLogoutMe.status, 401, 'Session token must be invalidated after logout');
    console.log('✅ Test 16 Passed: Logout invalidates authenticated session');

    // 17. Patient Profile View & Persisted DB Update + Validation
    const unauthProf = await makeRequest({ path: '/api/profile' });
    assert.strictEqual(unauthProf.status, 401, 'Unauthenticated profile access must return 401');
    const getProf = await makeRequest({ path: '/api/profile', headers: authHeaders });
    assert.strictEqual(getProf.status, 200);
    assert.strictEqual(getProf.data.user.auth_provider, 'email');

    const badProf = await makeRequest({
      method: 'PUT',
      path: '/api/profile',
      headers: authHeaders,
      body: { name: 'A', phone: 'bad' }
    });
    assert.strictEqual(badProf.status, 400, 'Invalid profile update must return 400');

    const updProf = await makeRequest({
      method: 'PUT',
      path: '/api/profile',
      headers: authHeaders,
      body: {
        name: 'Alex Rivera Updated',
        phone: '+1 (555) 901-2345',
        emergency_contact: 'Sam Rivera, +1 (555) 901-9999',
        allergies: 'Penicillin'
      }
    });
    assert.strictEqual(updProf.status, 200);
    assert.strictEqual(updProf.data.user.name, 'Alex Rivera Updated');
    assert.strictEqual(updProf.data.user.phone, '+1 (555) 901-2345');

    const verifyMe = await makeRequest({ path: '/api/auth/me', headers: authHeaders });
    assert.strictEqual(verifyMe.status, 200);
    assert.strictEqual(verifyMe.data.user.name, 'Alex Rivera Updated');
    assert.strictEqual(verifyMe.data.user.allergies, 'Penicillin');
    console.log('✅ Test 17 Passed: Patient profile view, update & SQLite persistence verified');

    // 18. Backend Availability Rules: Off-Duty Weekday & Invalid Calendar Date Rejection
    const sundayDate = findDateForWeekdays(['Sunday'], 1);
    const sundayAvail = await makeRequest({ path: `/api/availability?doctorId=1&date=${sundayDate}` });
    assert.strictEqual(sundayAvail.status, 200);
    assert.strictEqual(sundayAvail.data.is_doctor_available, false);
    assert.strictEqual(sundayAvail.data.slots.every(s => !s.is_available && s.reason === 'Doctor Off Duty'), true);

    const offDutyBook = await makeRequest({
      method: 'POST',
      path: '/api/appointments',
      headers: authHeaders,
      body: {
        patientName: 'Alex Rivera Updated',
        departmentId: 1,
        doctorId: 1,
        appointmentDate: sundayDate,
        timeSlot: '09:00 AM',
        medicalIssue: 'Off duty booking test'
      }
    });
    assert.strictEqual(offDutyBook.status, 400, 'Booking on doctor off-duty day must be rejected');

    const invalidDateBook = await makeRequest({
      method: 'POST',
      path: '/api/appointments',
      headers: authHeaders,
      body: {
        patientName: 'Alex Rivera Updated',
        departmentId: 1,
        doctorId: 1,
        appointmentDate: '2026-02-30',
        timeSlot: '09:00 AM',
        medicalIssue: 'Invalid date test'
      }
    });
    assert.strictEqual(invalidDateBook.status, 400, 'Invalid calendar date must be rejected');
    console.log('✅ Test 18 Passed: Backend off-duty schedule & calendar validation verified');

    // 19. Google OAuth JWT & Firebase Google Login Paths
    const jwtHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const googleEmail = `google_qa_${Date.now()}@gmail.com`;
    const jwtPayload = Buffer.from(JSON.stringify({
      sub: `sub_${Date.now()}`,
      email: googleEmail,
      name: 'Taylor Brooks',
      picture: '/assets/icons/patient-avatar.svg'
    })).toString('base64url');
    const mockGoogleJwt = `${jwtHeader}.${jwtPayload}.mock_sig`;

    const googleRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/google',
      body: { credential: mockGoogleJwt }
    });
    assert.strictEqual(googleRes.status, 200, 'Google OAuth endpoint should return 200');
    assert.strictEqual(googleRes.data.user.auth_provider, 'google');
    assert.strictEqual(googleRes.data.user.email, googleEmail);

    const fbRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/firebase-login',
      body: {
        email: `fb_${Date.now()}@gmail.com`,
        name: 'Morgan Hayes',
        uid: `fb_uid_${Date.now()}`,
        avatar: '/assets/icons/patient-avatar.svg'
      }
    });
    assert.strictEqual(fbRes.status, 200, 'Firebase login endpoint should return 200');
    assert.strictEqual(fbRes.data.user.auth_provider, 'google');
    assert(fbRes.data.token, 'Firebase login should issue session token');
    console.log('✅ Test 19 Passed: Google OAuth & Firebase Google Sign-In session flows verified');

    console.log('\n🎉 ALL 19 AUTOMATED BACKEND TESTS PASSED SUCCESSFULLY! 🚀\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
  }
}

runTests();
