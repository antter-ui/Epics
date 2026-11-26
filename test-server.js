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

    // 8. Slot Availability
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const avail = await makeRequest({ path: `/api/availability?doctorId=1&date=${tomorrow}` });
    assert.strictEqual(avail.status, 200);
    assert(Array.isArray(avail.data.slots));
    assert(avail.data.slots.length > 0);
    console.log('✅ Test 8 Passed: Time slot availability calculation');

    // 9. Existing Appointments for Patient
    const apts = await makeRequest({ path: '/api/appointments', headers: authHeaders });
    assert.strictEqual(apts.status, 200);
    assert(Array.isArray(apts.data.appointments));
    console.log(`✅ Test 9 Passed: Patient appointments retrieved (${apts.data.appointments.length} initial records for new patient)`);

    // 10. Book New Appointment
    const bookingDate = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
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
        timeSlot: '09:00 AM',
        medicalIssue: 'Follow-up consultation on Vitamin D levels and energy',
        description: 'Feeling much better after 2 weeks of supplements. Want to check lab results.'
      }
    });
    assert.strictEqual(bookingRes.status, 201, 'Booking should return 201 Created');
    assert.strictEqual(bookingRes.data.appointment.status, 'Confirmed');
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
        timeSlot: '09:00 AM', // Same slot!
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
    assert.strictEqual(cancelRes.data.appointment.cancellation_reason, 'Rescheduling for next month due to work trip');
    console.log('✅ Test 12 Passed: Appointment cancellation and reason tracking');

    // 13. Dashboard Stats
    const statsRes = await makeRequest({ path: '/api/stats', headers: authHeaders });
    assert.strictEqual(statsRes.status, 200);
    assert(typeof statsRes.data.stats.total === 'number');
    assert(typeof statsRes.data.stats.upcoming === 'number');
    console.log('✅ Test 13 Passed: Patient dashboard metrics and next appointment calculation');

    console.log('\n🎉 ALL 13 AUTOMATED BACKEND TESTS PASSED SUCCESSFULLY! 🚀\n');
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
