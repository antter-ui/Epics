// server/routes.js
// REST API Route Handlers for Medicare Connect
const url = require('node:url');
const db = require('./db.js');
const auth = require('./auth.js');

// Load Firebase Web API key from environment or public/firebase-config.js for server-side ID token verification
function getFirebaseApiKey() {
  if (process.env.FIREBASE_API_KEY) return process.env.FIREBASE_API_KEY.trim();
  try {
    const fs = require('node:fs');
    const path = require('node:path');
    const cfgPath = path.join(__dirname, '..', 'public', 'firebase-config.js');
    const raw = fs.readFileSync(cfgPath, 'utf8');
    const match = raw.match(/apiKey\s*:\s*["']([^"']+)["']/);
    return match ? match[1].trim() : '';
  } catch (e) {
    return '';
  }
}

async function verifyFirebaseIdToken(idToken) {
  const apiKey = getFirebaseApiKey();
  if (!apiKey) {
    throw new Error('Firebase API key is not configured on the server.');
  }
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(8000)
    }
  );
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !Array.isArray(data.users) || !data.users[0]) {
    const msg = (data && data.error && data.error.message) || 'Invalid or expired Firebase Google token.';
    throw new Error(msg);
  }
  return data.users[0];
}

// Helper to send JSON responses
function sendJson(res, statusCode, data, headers = {}) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    ...headers
  });
  res.end(json);
}

// Helper to parse incoming request body (supports raw streams and pre-parsed Vercel serverless bodies)
function parseBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      try {
        return Promise.resolve(req.body ? JSON.parse(req.body) : {});
      } catch (err) {
        return Promise.reject(new Error('Invalid JSON'));
      }
    }
    if (Buffer.isBuffer(req.body)) {
      try {
        const txt = req.body.toString('utf8');
        return Promise.resolve(txt ? JSON.parse(txt) : {});
      } catch (err) {
        return Promise.reject(new Error('Invalid JSON'));
      }
    }
    return Promise.resolve(req.body || {});
  }

  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Router dispatcher
async function handleApiRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();
  const query = parsedUrl.query;

  // Global CORS headers for API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // 1. Health check
    if (pathname === '/api/health' && method === 'GET') {
      return sendJson(res, 200, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }

    // 2. Real Patient Registration with Name, Email, and Password
    if (pathname === '/api/auth/register' && method === 'POST') {
      const body = await parseBody(req);
      try {
        const result = auth.handleRegister({
          name: body.name,
          email: body.email,
          password: body.password
        });

        return sendJson(res, 201, {
          success: true,
          message: `Account created successfully! Welcome, ${result.user.name}.`,
          user: result.user,
          token: result.token,
          expiresAt: result.expiresAt
        }, {
          'Set-Cookie': `mc_session=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
        });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // 3. Real Patient Sign-In with Email and Password
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await parseBody(req);
      try {
        const result = auth.handleLogin({
          email: body.email,
          password: body.password
        });

        return sendJson(res, 200, {
          success: true,
          message: `Welcome back, ${result.user.name}!`,
          user: result.user,
          token: result.token,
          expiresAt: result.expiresAt
        }, {
          'Set-Cookie': `mc_session=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
        });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // 4. Real Google OAuth Token Login
    if (pathname === '/api/auth/google' && method === 'POST') {
      const body = await parseBody(req);
      try {
        const result = auth.handleGoogleLogin({
          credential: body.credential
        });

        return sendJson(res, 200, {
          success: true,
          message: `Welcome, ${result.user.name}!`,
          user: result.user,
          token: result.token,
          expiresAt: result.expiresAt
        }, {
          'Set-Cookie': `mc_session=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
        });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // 4b. Real Verified Firebase Google Sign-In
    if (pathname === '/api/auth/firebase-login' && method === 'POST') {
      const body = await parseBody(req);
      try {
        if (!body.idToken || typeof body.idToken !== 'string') {
          return sendJson(res, 401, {
            error: 'Verified Firebase ID token is required for Google Sign-In.'
          });
        }

        const fbUser = await verifyFirebaseIdToken(body.idToken);
        if (!fbUser || !fbUser.email) {
          return sendJson(res, 401, { error: 'Verified Google account email not found in Firebase token.' });
        }

        const email = fbUser.email.toLowerCase().trim();
        const name = fbUser.displayName || email.split('@')[0];
        const avatar = fbUser.photoUrl || '/assets/icons/patient-avatar.svg';
        const googleId = fbUser.localId || `firebase_${email}`;

        const user = db.upsertGoogleUser({ googleId, email, name, avatar });
        const session = db.createSession(user.id);

        return sendJson(res, 200, {
          success: true,
          message: `Welcome, ${user.name}! Signed in with Google.`,
          user,
          token: session.token,
          expiresAt: session.expiresAt
        }, {
          'Set-Cookie': `mc_session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
        });
      } catch (err) {
        return sendJson(res, 401, { error: err.message });
      }
    }

    // 5. Google Client ID Config
    if (pathname === '/api/auth/config' && method === 'GET') {
      return sendJson(res, 200, {
        googleClientId: process.env.GOOGLE_CLIENT_ID || global.GOOGLE_CLIENT_ID || ''
      });
    }

    if (pathname === '/api/auth/config' && method === 'POST') {
      const body = await parseBody(req);
      if (body.googleClientId) {
        global.GOOGLE_CLIENT_ID = body.googleClientId.trim();
      }
      return sendJson(res, 200, {
        success: true,
        googleClientId: global.GOOGLE_CLIENT_ID || ''
      });
    }

    // 5. Auth Me (Current User)
    if (pathname === '/api/auth/me' && method === 'GET') {
      const authResult = auth.authenticate(req);
      if (!authResult) {
        return sendJson(res, 401, { error: 'Not authenticated' });
      }
      return sendJson(res, 200, { user: authResult.user });
    }

    // 6. Logout
    if (pathname === '/api/auth/logout' && method === 'POST') {
      const token = auth.extractToken(req);
      if (token) {
        db.deleteSession(token);
      }
      return sendJson(res, 200, {
        success: true,
        message: 'Logged out successfully'
      }, {
        'Set-Cookie': 'mc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
      });
    }

    // 7. Get Departments (Cacheable clinic directory)
    if (pathname === '/api/departments' && method === 'GET') {
      const departments = db.getDepartments();
      return sendJson(res, 200, { departments }, {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
      });
    }

    // 8. Get Doctors (Cacheable specialist directory)
    if (pathname === '/api/doctors' && method === 'GET') {
      const deptId = query.departmentId ? parseInt(query.departmentId, 10) : null;
      const doctors = db.getDoctors(deptId);
      return sendJson(res, 200, { doctors }, {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
      });
    }

    // 9. Get Single Doctor
    const doctorMatch = pathname.match(/^\/api\/doctors\/(\d+)$/);
    if (doctorMatch && method === 'GET') {
      const doctorId = parseInt(doctorMatch[1], 10);
      const doctor = db.getDoctorById(doctorId);
      if (!doctor) {
        return sendJson(res, 404, { error: 'Doctor not found' });
      }
      return sendJson(res, 200, { doctor }, {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
      });
    }

    // 10. Check Slot Availability
    if (pathname === '/api/availability' && method === 'GET') {
      const doctorId = query.doctorId ? parseInt(query.doctorId, 10) : null;
      const dateStr = query.date;

      if (!doctorId || !dateStr) {
        return sendJson(res, 400, { error: 'Both doctorId and date query parameters are required.' });
      }

      // Validate date format YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return sendJson(res, 400, { error: 'Invalid date format. Expected YYYY-MM-DD.' });
      }

      try {
        const availability = db.getDoctorSlotAvailability(doctorId, dateStr);
        return sendJson(res, 200, availability);
      } catch (err) {
        const status = err.message === 'Doctor not found' ? 404 : 400;
        return sendJson(res, status, { error: err.message });
      }
    }

    // --- PROTECTED ROUTES (Require Valid Patient Authentication) ---
    const authResult = auth.authenticate(req);

    // Guard all remaining patient-scoped endpoints
    if (
      pathname.startsWith('/api/appointments') ||
      pathname === '/api/stats' ||
      pathname === '/api/profile'
    ) {
      if (!authResult) {
        return sendJson(res, 401, {
          error: 'Authentication required. Please sign in to access your medical portal.'
        });
      }
    }

    const currentUserId = authResult ? authResult.user.id : null;

    // 10b. Patient Profile (View & Update persisted DB fields)
    if (pathname === '/api/profile' && method === 'GET') {
      return sendJson(res, 200, { user: authResult.user });
    }

    if (pathname === '/api/profile' && (method === 'PUT' || method === 'PATCH')) {
      const body = await parseBody(req);
      try {
        const updatedUser = db.updateUserProfile(currentUserId, {
          name: body.name,
          phone: body.phone,
          emergency_contact: body.emergency_contact,
          allergies: body.allergies
        });
        return sendJson(res, 200, {
          success: true,
          message: 'Patient profile updated successfully.',
          user: updatedUser
        });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // 11. Dashboard Stats
    if (pathname === '/api/stats' && method === 'GET') {
      const stats = db.getUserStats(currentUserId);
      return sendJson(res, 200, { stats });
    }

    // 12. List Appointments for Logged-In User Only
    if (pathname === '/api/appointments' && method === 'GET') {
      const statusFilter = query.status || null;
      const appointments = db.getUserAppointments(currentUserId, statusFilter);
      return sendJson(res, 200, { appointments });
    }

    // 13. Create New Appointment
    if (pathname === '/api/appointments' && method === 'POST') {
      const body = await parseBody(req);

      // Strict validation
      const errors = [];
      if (!body.patientName || body.patientName.trim().length < 2) {
        errors.push("Patient name must be at least 2 characters long.");
      }
      if (!body.medicalIssue || body.medicalIssue.trim().length < 3) {
        errors.push("Please provide a description of the medical issue or health concern (minimum 3 characters).");
      }
      if (!body.departmentId) {
        errors.push("Please select a medical department or specialization.");
      }
      if (!body.doctorId) {
        errors.push("Please select a doctor.");
      }
      if (!body.appointmentDate) {
        errors.push("Please select an appointment date.");
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(body.appointmentDate)) {
        errors.push("Appointment date must be in YYYY-MM-DD format.");
      }
      if (!body.timeSlot) {
        errors.push("Please select a preferred time slot.");
      }

      if (errors.length > 0) {
        return sendJson(res, 400, { error: errors.join(' ') });
      }

      try {
        const newAppointment = db.createAppointment({
          userId: currentUserId,
          patientName: body.patientName,
          patientEmail: body.patientEmail || authResult.user.email,
          patientPhone: body.patientPhone || null,
          departmentId: parseInt(body.departmentId, 10),
          doctorId: parseInt(body.doctorId, 10),
          appointmentDate: body.appointmentDate,
          timeSlot: body.timeSlot,
          medicalIssue: body.medicalIssue,
          description: body.description || ''
        });

        return sendJson(res, 201, {
          success: true,
          message: 'Appointment booked successfully!',
          appointment: newAppointment
        });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // 14. Get Single Appointment Details (Scoped to current user)
    const singleAptMatch = pathname.match(/^\/api\/appointments\/(\d+)$/);
    if (singleAptMatch && method === 'GET') {
      const aptId = parseInt(singleAptMatch[1], 10);
      const appointment = db.getAppointmentById(aptId, currentUserId);
      if (!appointment) {
        return sendJson(res, 404, { error: 'Appointment not found or you do not have permission to view it.' });
      }
      return sendJson(res, 200, { appointment });
    }

    // 15. Cancel Appointment (Scoped to current user)
    const cancelMatch = pathname.match(/^\/api\/appointments\/(\d+)\/cancel$/);
    if (cancelMatch && method === 'POST') {
      const aptId = parseInt(cancelMatch[1], 10);
      const body = await parseBody(req);
      const reason = body.reason || 'Cancelled by patient';

      try {
        const updated = db.cancelAppointment(aptId, currentUserId, reason);
        return sendJson(res, 200, {
          success: true,
          message: 'Appointment has been cancelled successfully.',
          appointment: updated
        });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // Fallthrough: 404 Not Found for API
    return sendJson(res, 404, { error: `Route not found: ${method} ${pathname}` });

  } catch (err) {
    if (err.message === 'Invalid JSON' || err.message === 'Payload too large') {
      return sendJson(res, 400, { error: err.message });
    }
    console.error('API Error:', err);
    return sendJson(res, 500, { error: 'Internal server error: ' + err.message });
  }
}

module.exports = {
  handleApiRequest
};
