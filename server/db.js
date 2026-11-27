// server/db.js
// SQLite database layer utilizing Node 22 native DatabaseSync
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME
);
const repoDbPath = path.join(__dirname, '..', 'data', 'healthcare.db');
const dbPath = isServerless ? path.join(os.tmpdir(), 'healthcare.db') : repoDbPath;
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
if (isServerless && !fs.existsSync(dbPath) && fs.existsSync(repoDbPath)) {
  try {
    fs.copyFileSync(repoDbPath, dbPath);
  } catch (e) {
    // Fallback to fresh SQLite database initialization in /tmp
  }
}

const db = new DatabaseSync(dbPath);

// Enable WAL mode for high performance and integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET.trim();
  try {
    const cfgPath = path.join(__dirname, '..', 'public', 'firebase-config.js');
    const raw = fs.readFileSync(cfgPath, 'utf8');
    const match = raw.match(/apiKey\s*:\s*["']([^"']+)["']/);
    if (match) {
      return crypto.createHash('sha256').update(match[1].trim() + '::tp-session-v2').digest('hex');
    }
  } catch (e) { /* ignore */ }
  return crypto.createHash('sha256').update('medicare-connect-fallback-secret-v2').digest('hex');
}

const SESSION_SECRET = getSessionSecret();

function signSessionToken(payload) {
  const bodyB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(bodyB64).digest('base64url');
  return `mc2.${bodyB64}.${sig}`;
}

function verifySignedSessionToken(token) {
  if (!token || typeof token !== 'string' || !token.startsWith('mc2.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, bodyB64, sigB64] = parts;
  if (!bodyB64 || !sigB64) return null;

  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(bodyB64).digest('base64url');
  const sigBuf = Buffer.from(sigB64, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8'));
    if (!payload || !payload.email || !payload.uid || typeof payload.exp !== 'number') return null;
    if (payload.exp <= Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function getLocalTodayStr(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseCalendarDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return dt;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getWeekdayName(dateObj) {
  return WEEKDAY_NAMES[dateObj.getDay()];
}

function isSlotElapsedToday(timeSlot, now = new Date()) {
  const [timePart, meridiem] = timeSlot.split(' ');
  let [hours, minutes] = timePart.split(':').map(Number);
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes <= now.getHours() * 60 + now.getMinutes() + 15;
}

const USER_PUBLIC_COLUMNS = 'id, google_id, email, name, avatar, auth_provider, phone, emergency_contact, allergies, role, created_at, updated_at';

function initDatabase() {
  const schemaVersion = db.prepare('PRAGMA user_version').get().user_version;
  if (schemaVersion >= 3) {
    seedInitialData();
    return;
  }

  // 1. Users table (Supports real email/password authentication & Google OAuth)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      password_salt TEXT,
      name TEXT NOT NULL,
      avatar TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'email',
      phone TEXT,
      emergency_contact TEXT,
      allergies TEXT,
      role TEXT DEFAULT 'patient',
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
  `);

  // Run column migrations for existing databases
  try { db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT;'); } catch (e) { }
  try { db.exec('ALTER TABLE users ADD COLUMN password_salt TEXT;'); } catch (e) { }
  try { db.exec("ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'email';"); } catch (e) { }
  try { db.exec('ALTER TABLE users ADD COLUMN phone TEXT;'); } catch (e) { }
  try { db.exec('ALTER TABLE users ADD COLUMN emergency_contact TEXT;'); } catch (e) { }
  try { db.exec('ALTER TABLE users ADD COLUMN allergies TEXT;'); } catch (e) { }
  try { db.exec('ALTER TABLE users ADD COLUMN updated_at TEXT;'); } catch (e) { }
  try {
    db.exec(`
      UPDATE users
      SET auth_provider = CASE WHEN google_id IS NOT NULL AND google_id != '' THEN 'google' ELSE 'email' END
      WHERE auth_provider IS NULL OR auth_provider = '';
    `);
  } catch (e) { }

  // 2. Sessions & Revoked Tokens tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      token TEXT PRIMARY KEY,
      revoked_at TEXT NOT NULL
    );
  `);

  // 3. Departments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      tagline TEXT NOT NULL,
      icon TEXT NOT NULL,
      description TEXT NOT NULL,
      color TEXT NOT NULL
    );
  `);

  // 4. Doctors table
  db.exec(`
    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      qualification TEXT NOT NULL,
      experience_years INTEGER NOT NULL,
      rating REAL NOT NULL,
      reviews_count INTEGER NOT NULL,
      avatar TEXT NOT NULL,
      room_number TEXT NOT NULL,
      consultation_fee INTEGER NOT NULL,
      bio TEXT NOT NULL,
      available_days TEXT NOT NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );
  `);

  // 5. Appointments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_code TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      patient_email TEXT NOT NULL,
      patient_phone TEXT,
      department_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      appointment_date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      medical_issue TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'Confirmed',
      cancellation_reason TEXT,
      cancelled_at TEXT,
      doctor_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );
  `);

  // Enforce atomic database-level uniqueness for active doctor slots and patient slots
  try {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_doctor_slot
      ON appointments (doctor_id, appointment_date, time_slot)
      WHERE status != 'Cancelled';
    `);
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_patient_slot
      ON appointments (user_id, appointment_date, time_slot)
      WHERE status != 'Cancelled';
    `);
  } catch (e) { }

  seedInitialData();
  try {
    db.exec('PRAGMA user_version = 3;');
  } catch (e) {}
}

const ALL_TIME_SLOTS = [
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
  '04:30 PM',
  '05:00 PM'
];

function seedInitialData() {
  const deptCount = db.prepare('SELECT COUNT(*) as count FROM departments').get().count;
  if (deptCount > 0) return;

  console.log('🌱 Seeding clinical departments and medical specialist directory...');

  // Departments
  const insertDept = db.prepare(`
    INSERT INTO departments (id, name, slug, tagline, icon, description, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const departments = [
    [1, 'Cardiology', 'cardiology', 'Heart, Blood Vessels & Cardiovascular Care', 'heart-pulse', 'Specialized diagnostics, treatment, and preventive care for cardiovascular diseases, coronary artery disease, arrhythmia, and hypertension.', '#ef4444'],
    [2, 'Dermatology', 'dermatology', 'Skin, Complexion, Hair & Aesthetics', 'sparkles', 'Comprehensive clinical and cosmetic dermatology covering skin allergies, acne, eczema, psoriasis, hair loss, and melanoma screening.', '#0284c7'],
    [3, 'Orthopedics', 'orthopedics', 'Joints, Spine, Bones & Sports Medicine', 'bone', 'Expert musculoskeletal surgical and non-surgical treatments for joint pain, arthritis, sports injuries, fractures, and spine disorders.', '#f59e0b'],
    [4, 'General Medicine', 'general-medicine', 'Primary Care, Preventative & Internal Health', 'stethoscope', 'Frontline primary care for acute illnesses, chronic disease management (diabetes, blood pressure), wellness checkups, and triage.', '#10b981'],
    [5, 'Neurology', 'neurology', 'Brain, Nervous System & Cognitive Health', 'brain', 'Advanced diagnosis and therapies for neurological conditions including migraines, neuropathies, seizure disorders, and memory issues.', '#8b5cf6'],
    [6, 'Pediatrics', 'pediatrics', 'Child Health, Development & Immunization', 'baby', 'Gentle, specialized healthcare for infants, toddlers, children, and adolescents, including development milestones and vaccination.', '#ec4899']
  ];

  for (const d of departments) {
    insertDept.run(...d);
  }

  // Doctors
  const insertDoc = db.prepare(`
    INSERT INTO doctors (id, name, title, department_id, qualification, experience_years, rating, reviews_count, avatar, room_number, consultation_fee, bio, available_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const doctors = [
    // Cardiology (dept 1)
    [1, 'Dr. Robert Harrison', 'Senior Consultant Cardiologist', 1, 'MD, FACC, Harvard Medical School', 18, 4.9, 342, 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&h=300&fit=crop&crop=face', 'Suite 301, Cardiovascular Wing', 150, 'Pioneering cardiologist specializing in preventive cardiology, coronary artery disease, and advanced cardiac echocardiography.', 'Monday, Tuesday, Wednesday, Thursday, Friday'],
    [2, 'Dr. Maya Lin-Carter', 'Interventional Heart Specialist', 1, 'MD, DM Cardiology, Johns Hopkins', 12, 4.8, 219, 'https://images.unsplash.com/photo-1594824813576-92c2a0466432?w=300&h=300&fit=crop&crop=face', 'Suite 304, Cardiovascular Wing', 140, 'Specialized in minimally invasive cardiovascular interventions, cardiac arrhythmias, and heart failure rehabilitation.', 'Monday, Wednesday, Friday, Saturday'],

    // Dermatology (dept 2)
    [3, 'Dr. Elena Rostova', 'Lead Dermatologist & Aesthetician', 2, 'MD (Dermatology), Stanford Fellowship', 14, 4.9, 415, 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=300&fit=crop&crop=face', 'Clinic Room 112, Wellness Plaza', 120, 'Renowned specialist in clinical dermatology, adult acne, autoimmune skin disorders, mole mapping, and laser therapeutics.', 'Monday, Tuesday, Thursday, Friday'],
    [4, 'Dr. Marcus Vance', 'Clinical Dermatology & Allergy Specialist', 2, 'MD, FAAD, Columbia University', 9, 4.7, 184, 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&h=300&fit=crop&crop=face', 'Clinic Room 114, Wellness Plaza', 110, 'Expertise in eczema, allergic contact dermatitis, fungal infections, and non-invasive skin rejuvenation procedures.', 'Tuesday, Wednesday, Thursday, Saturday'],

    // Orthopedics (dept 3)
    [5, 'Dr. James Thorne', 'Chief of Orthopedic Surgery', 3, 'MS Orthopedics, FRCS (Ortho)', 20, 4.9, 528, 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&h=300&fit=crop&crop=face', 'Surgical Pavilion, Suite 205', 160, 'Specialist in joint replacement surgery, advanced arthroscopic reconstruction, cartilage preservation, and complex spinal alignment.', 'Monday, Tuesday, Wednesday, Friday'],
    [6, 'Dr. Ananya Patel', 'Sports Medicine & Joint Specialist', 3, 'MD, Sports Fellowship Mayo Clinic', 11, 4.8, 267, 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=300&fit=crop&crop=face', 'Surgical Pavilion, Suite 208', 135, 'Focuses on athletic ligament tears (ACL/MCL), rotator cuff injuries, biomechanical gait analysis, and regenerative platelet-rich therapies.', 'Monday, Wednesday, Thursday, Saturday'],

    // General Medicine (dept 4)
    [7, 'Dr. William Chen', 'Senior Physician & Internal Medicine Head', 4, 'MD (Internal Medicine), Yale University', 16, 4.9, 480, 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=300&h=300&fit=crop&crop=face', 'Primary Care Center, Room 101', 95, 'Dedicated family and internal medicine doctor focusing on diagnostic puzzles, metabolic syndrome, diabetic control, and comprehensive health screenings.', 'Monday, Tuesday, Wednesday, Thursday, Friday'],
    [8, 'Dr. Sarah Al-Mansoor', 'Preventative Care & Family Physician', 4, 'MD, MPH, University of Michigan', 10, 4.8, 312, 'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=300&h=300&fit=crop&crop=face', 'Primary Care Center, Room 103', 90, 'Passionate advocate for lifestyle medicine, preventative screenings, infectious disease control, and holistic chronic illness support.', 'Tuesday, Wednesday, Thursday, Friday, Saturday'],

    // Neurology (dept 5)
    [9, 'Dr. Alexander Novak', 'Neurologist & Neuro-diagnostician', 5, 'MD, PhD Neuroscience, Oxford University', 17, 4.9, 390, 'https://images.unsplash.com/photo-1622902046580-2b47f47f5471?w=300&h=300&fit=crop&crop=face', 'Neuroscience Center, Floor 4', 175, 'Subspecialized in headache medicine, chronic refractory migraine management, peripheral nerve disorders, and epilepsy evaluation.', 'Monday, Tuesday, Thursday, Friday'],
    [10, 'Dr. Priya Sundaram', 'Cognitive & Movement Disorders Specialist', 5, 'MD, FAAN, Cleveland Clinic', 13, 4.8, 245, 'https://images.unsplash.com/photo-1594824813583-e18e6988891f?w=300&h=300&fit=crop&crop=face', 'Neuroscience Center, Floor 4', 165, 'Specialized in tremors, Parkinsonian syndromes, vertigo disorders, and cognitive neuro-rehabilitation therapies.', 'Tuesday, Wednesday, Thursday, Saturday'],

    // Pediatrics (dept 6)
    [11, 'Dr. Emily Thornton', 'Chief Pediatrician & Child Development', 6, 'MD Pediatrics, Boston Children’s Hospital', 15, 4.9, 560, 'https://images.unsplash.com/photo-1559839734-666352945d8b?w=300&h=300&fit=crop&crop=face', 'Pediatric Wing, Room 210', 110, 'Warm, empathetic pediatrician providing holistic healthcare from newborn infancy through adolescence with gentle patient-centered care.', 'Monday, Tuesday, Wednesday, Thursday, Friday'],
    [12, 'Dr. Daniel O’Connor', 'Adolescent Medicine & Pediatric Allergies', 6, 'MD, FAAP, Children’s National DC', 10, 4.8, 298, 'https://images.unsplash.com/photo-1637059824899-a441006a6875?w=300&h=300&fit=crop&crop=face', 'Pediatric Wing, Room 212', 105, 'Expert in childhood asthma, pediatric nutrition, food allergies, growth monitoring, and adolescent behavioral counseling.', 'Monday, Wednesday, Thursday, Saturday']
  ];

  for (const doc of doctors) {
    insertDoc.run(...doc);
  }

  console.log('✅ SQLite hospital directory initialized.');
}

// Initialize database schema
initDatabase();

// Database Query Helpers
module.exports = {
  db,
  ALL_TIME_SLOTS,
  hashPassword,

  // Users
  getUserById(id) {
    return db.prepare(`SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = ?`).get(id);
  },

  getUserByGoogleId(googleId) {
    return db.prepare(`SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE google_id = ?`).get(googleId);
  },

  getUserByEmail(email) {
    if (!email) return null;
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  },

  // Register a new patient account with real email & password
  registerUser({ name, email, password }) {
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    const existing = this.getUserByEmail(cleanEmail);
    if (existing) {
      if (existing.password_hash) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      } else {
        // User previously logged in with Google, attach password
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = hashPassword(password, salt);
        const now = new Date().toISOString();
        db.prepare('UPDATE users SET password_hash = ?, password_salt = ?, name = ?, updated_at = ? WHERE id = ?')
          .run(hash, salt, cleanName, now, existing.id);
        return this.getUserById(existing.id);
      }
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    const id = 'usr_' + crypto.randomBytes(8).toString('hex');
    const now = new Date().toISOString();
    const avatar = '/assets/icons/patient-avatar.svg';

    db.prepare(`
      INSERT INTO users (id, email, password_hash, password_salt, name, avatar, auth_provider, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'email', 'patient', ?, ?)
    `).run(id, cleanEmail, hash, salt, cleanName, avatar, now, now);

    return this.getUserById(id);
  },

  // Verify credentials for real email & password sign-in
  verifyUserPassword(email, password) {
    const cleanEmail = (email || '').toLowerCase().trim();
    const user = this.getUserByEmail(cleanEmail);
    if (!user) {
      throw new Error('No account found with this email. Please check your email or click "Create Account".');
    }

    if (!user.password_hash || !user.password_salt) {
      throw new Error('This account was created with Google Sign-In. Please sign in with Google or create a password.');
    }

    const computedHash = hashPassword(password, user.password_salt);
    if (computedHash !== user.password_hash) {
      throw new Error('Incorrect password. Please verify your password and try again.');
    }

    return this.getUserById(user.id);
  },

  // Real Google OAuth upsert
  upsertGoogleUser({ googleId, email, name, avatar }) {
    const cleanEmail = email.toLowerCase().trim();
    const now = new Date().toISOString();
    let user = this.getUserByGoogleId(googleId) || this.getUserByEmail(cleanEmail);
    if (user) {
      db.prepare(`
        UPDATE users SET name = ?, avatar = ?, google_id = ?, auth_provider = 'google', updated_at = ? WHERE id = ?
      `).run(name, avatar || user.avatar, googleId, now, user.id);
      return this.getUserById(user.id);
    } else {
      const id = 'usr_' + crypto.randomBytes(8).toString('hex');
      db.prepare(`
        INSERT INTO users (id, google_id, email, name, avatar, auth_provider, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'google', 'patient', ?, ?)
      `).run(id, googleId, cleanEmail, name, avatar || '/assets/icons/patient-avatar.svg', now, now);
      return this.getUserById(id);
    }
  },

  // Update persisted basic patient profile information
  updateUserProfile(userId, { name, phone, emergency_contact, allergies }) {
    const existing = this.getUserById(userId);
    if (!existing) {
      throw new Error('Patient account not found.');
    }

    const cleanName = typeof name === 'string' ? name.trim() : existing.name;
    if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
      throw new Error('Full name must be between 2 and 100 characters.');
    }

    const cleanPhone = phone != null ? String(phone).trim() : '';
    if (cleanPhone && !/^[+\d\s().-]{5,30}$/.test(cleanPhone)) {
      throw new Error('Please enter a valid phone number (5–30 digits/characters).');
    }

    const cleanEmergency = emergency_contact != null ? String(emergency_contact).trim() : '';
    if (cleanEmergency.length > 160) {
      throw new Error('Emergency contact must be 160 characters or fewer.');
    }

    const cleanAllergies = allergies != null ? String(allergies).trim() : '';
    if (cleanAllergies.length > 1000) {
      throw new Error('Medical notes / allergies must be 1000 characters or fewer.');
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE users
      SET name = ?, phone = ?, emergency_contact = ?, allergies = ?, updated_at = ?
      WHERE id = ?
    `).run(
      cleanName,
      cleanPhone || null,
      cleanEmergency || null,
      cleanAllergies || null,
      now,
      userId
    );

    return this.getUserById(userId);
  },

  // Sessions (DB-backed + HMAC-signed stateless cold-start resilience)
  createSession(userId, durationDays = 7) {
    const user = this.getUserById(userId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 86400000);
    const token = user
      ? signSessionToken({
          uid: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar || '/assets/icons/patient-avatar.svg',
          auth_provider: user.auth_provider || 'email',
          role: user.role || 'patient',
          jti: crypto.randomBytes(12).toString('hex'),
          exp: expiresAt.getTime()
        })
      : ('ses_' + crypto.randomBytes(32).toString('hex'));

    db.prepare(`
      INSERT INTO sessions (token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(token, userId, now.toISOString(), expiresAt.toISOString());

    return { token, expiresAt: expiresAt.toISOString() };
  },

  getSession(token) {
    if (!token) return null;
    try {
      const revoked = db.prepare('SELECT 1 FROM revoked_tokens WHERE token = ?').get(token);
      if (revoked) return null;
    } catch (e) { /* ignore if pre-init */ }

    const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
    if (session) {
      if (new Date(session.expires_at) < new Date()) {
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
        return null;
      }
      const user = this.getUserById(session.user_id);
      if (user) return { session, user };
    }

    // Serverless cold-start recovery for HMAC-signed returning-user tokens
    const payload = verifySignedSessionToken(token);
    if (!payload) return null;

    const cleanEmail = String(payload.email).toLowerCase().trim();
    const nowIso = new Date().toISOString();
    let user = this.getUserById(payload.uid) || this.getUserByEmail(cleanEmail);
    if (!user) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO users (id, email, name, avatar, auth_provider, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          payload.uid,
          cleanEmail,
          payload.name || cleanEmail.split('@')[0],
          payload.avatar || '/assets/icons/patient-avatar.svg',
          payload.auth_provider || 'email',
          payload.role || 'patient',
          nowIso,
          nowIso
        );
      } catch (e) { /* ignore duplicate constraint */ }
      user = this.getUserById(payload.uid) || this.getUserByEmail(cleanEmail);
    }
    if (!user) return null;

    const expiresIso = new Date(payload.exp).toISOString();
    try {
      db.prepare(`
        INSERT OR IGNORE INTO sessions (token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(token, user.id, nowIso, expiresIso);
    } catch (e) { /* ignore */ }

    return {
      session: { token, user_id: user.id, created_at: nowIso, expires_at: expiresIso },
      user
    };
  },

  deleteSession(token) {
    if (!token) return;
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    try {
      db.prepare('INSERT OR IGNORE INTO revoked_tokens (token, revoked_at) VALUES (?, ?)').run(token, new Date().toISOString());
    } catch (e) { /* ignore */ }
  },

  // Departments
  getDepartments() {
    return db.prepare(`
      SELECT d.*, 
        (SELECT COUNT(*) FROM doctors doc WHERE doc.department_id = d.id) AS doctor_count
      FROM departments d
      ORDER BY d.id ASC
    `).all();
  },

  getDepartmentById(id) {
    return db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
  },

  // Doctors
  getDoctors(departmentId = null) {
    let sql = `
      SELECT doc.*, d.name AS department_name, d.name AS specialization, d.slug AS department_slug, d.color AS department_color
      FROM doctors doc
      JOIN departments d ON doc.department_id = d.id
    `;
    const params = [];
    if (departmentId) {
      sql += ' WHERE doc.department_id = ?';
      params.push(departmentId);
    }
    sql += ' ORDER BY doc.rating DESC, doc.experience_years DESC';
    return db.prepare(sql).all(...params);
  },

  getDoctorById(id) {
    return db.prepare(`
      SELECT doc.*, d.name AS department_name, d.name AS specialization, d.slug AS department_slug, d.color AS department_color
      FROM doctors doc
      JOIN departments d ON doc.department_id = d.id
      WHERE doc.id = ?
    `).get(id);
  },

  // Availability & Slots
  getDoctorSlotAvailability(doctorId, dateStr) {
    const doctor = this.getDoctorById(doctorId);
    if (!doctor) {
      throw new Error('Doctor not found');
    }

    const parsedDate = parseCalendarDate(dateStr);
    if (!parsedDate) {
      throw new Error('Invalid calendar date. Expected a real date in YYYY-MM-DD format.');
    }

    const weekday = getWeekdayName(parsedDate);
    const availableDays = (doctor.available_days || '').split(',').map(s => s.trim()).filter(Boolean);
    const isDoctorOnDuty = availableDays.length === 0 || availableDays.includes(weekday);

    // Find active booked appointments for this doctor on this date
    const bookedAppointments = db.prepare(`
      SELECT id, time_slot, status, patient_name 
      FROM appointments 
      WHERE doctor_id = ? AND appointment_date = ? AND status != 'Cancelled'
    `).all(doctorId, dateStr);

    const bookedSlotMap = new Map();
    for (const b of bookedAppointments) {
      bookedSlotMap.set(b.time_slot, b);
    }

    const now = new Date();
    const todayStr = getLocalTodayStr(now);
    const isPastDate = dateStr < todayStr;
    const isToday = dateStr === todayStr;

    const slots = ALL_TIME_SLOTS.map(slot => {
      const isBooked = bookedSlotMap.has(slot);
      let isPast = isPastDate;

      if (!isPast && isToday) {
        isPast = isSlotElapsedToday(slot, now);
      }

      const isAvailable = isDoctorOnDuty && !isBooked && !isPast;
      let reason = 'Available';
      if (isPastDate) reason = 'Date Has Passed';
      else if (!isDoctorOnDuty) reason = 'Doctor Off Duty';
      else if (isBooked) reason = 'Already Booked';
      else if (isPast) reason = 'Slot Has Passed';

      return {
        slot,
        is_available: isAvailable,
        reason
      };
    });

    return {
      doctor,
      date: dateStr,
      weekday,
      is_doctor_available: isDoctorOnDuty,
      slots
    };
  },

  // Appointments (Strictly Scoped to Current Authenticated Patient)
  decorateAppointment(apt, now = new Date()) {
    if (!apt) return apt;
    const todayStr = getLocalTodayStr(now);
    const isPast =
      apt.appointment_date < todayStr ||
      (apt.appointment_date === todayStr && isSlotElapsedToday(apt.time_slot, now));
    const isUpcoming = (apt.status === 'Confirmed' || apt.status === 'Pending') && !isPast;
    return {
      ...apt,
      is_upcoming: isUpcoming,
      is_previous: !isUpcoming,
      is_cancellable: isUpcoming
    };
  },

  getUserAppointments(userId, statusFilter = null) {
    let sql = `
      SELECT 
        a.*,
        d.name AS department_name,
        d.color AS department_color,
        d.icon AS department_icon,
        doc.name AS doctor_name,
        doc.title AS doctor_title,
        doc.avatar AS doctor_avatar,
        doc.qualification AS doctor_qualification,
        doc.room_number AS doctor_room,
        doc.consultation_fee AS consultation_fee
      FROM appointments a
      JOIN departments d ON a.department_id = d.id
      JOIN doctors doc ON a.doctor_id = doc.id
      WHERE a.user_id = ?
    `;
    const params = [userId];

    if (statusFilter && statusFilter !== 'All') {
      sql += ' AND a.status = ?';
      params.push(statusFilter);
    }

    sql += ' ORDER BY a.appointment_date DESC, a.time_slot DESC';
    const now = new Date();
    return db.prepare(sql).all(...params).map(a => this.decorateAppointment(a, now));
  },

  getAppointmentById(id, userId) {
    const sql = `
      SELECT 
        a.*,
        d.name AS department_name,
        d.color AS department_color,
        d.icon AS department_icon,
        doc.name AS doctor_name,
        doc.title AS doctor_title,
        doc.avatar AS doctor_avatar,
        doc.qualification AS doctor_qualification,
        doc.room_number AS doctor_room,
        doc.consultation_fee AS consultation_fee,
        doc.bio AS doctor_bio
      FROM appointments a
      JOIN departments d ON a.department_id = d.id
      JOIN doctors doc ON a.doctor_id = doc.id
      WHERE a.id = ? AND a.user_id = ?
    `;
    const row = db.prepare(sql).get(id, userId);
    return row ? this.decorateAppointment(row) : row;
  },

  // Atomic Slot Booking with Collision & Schedule Checks
  createAppointment({
    userId,
    patientName,
    patientEmail,
    patientPhone,
    departmentId,
    doctorId,
    appointmentDate,
    timeSlot,
    medicalIssue,
    description
  }) {
    const doctor = this.getDoctorById(doctorId);
    if (!doctor) throw new Error('Selected doctor not found.');
    if (Number(doctor.department_id) !== Number(departmentId)) {
      throw new Error('Doctor does not belong to the selected department.');
    }

    if (!ALL_TIME_SLOTS.includes(timeSlot)) {
      throw new Error(`Invalid time slot: ${timeSlot}`);
    }

    const parsedDate = parseCalendarDate(appointmentDate);
    if (!parsedDate) {
      throw new Error('Invalid calendar date selected.');
    }

    const weekday = getWeekdayName(parsedDate);
    const availableDays = (doctor.available_days || '').split(',').map(s => s.trim()).filter(Boolean);
    if (availableDays.length > 0 && !availableDays.includes(weekday)) {
      throw new Error(`${doctor.name} is not available on ${weekday}s. Available days: ${doctor.available_days}.`);
    }

    const now = new Date();
    const todayStr = getLocalTodayStr(now);
    if (appointmentDate < todayStr) {
      throw new Error('Appointment date cannot be in the past.');
    }

    if (appointmentDate === todayStr && isSlotElapsedToday(timeSlot, now)) {
      throw new Error(`This time slot (${timeSlot}) has already passed for today. Please choose a later slot.`);
    }

    const existing = db.prepare(`
      SELECT id FROM appointments
      WHERE doctor_id = ? AND appointment_date = ? AND time_slot = ? AND status != 'Cancelled'
    `).get(doctorId, appointmentDate, timeSlot);

    if (existing) {
      throw new Error(`This time slot (${timeSlot}) with ${doctor.name} is already booked. Please choose another time.`);
    }

    const patientOverlap = db.prepare(`
      SELECT id FROM appointments
      WHERE user_id = ? AND appointment_date = ? AND time_slot = ? AND status != 'Cancelled'
    `).get(userId, appointmentDate, timeSlot);

    if (patientOverlap) {
      throw new Error(`You already have another appointment booked on ${appointmentDate} at ${timeSlot}. Please pick a different time.`);
    }

    const refCode = `MED-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = now.toISOString();

    const stmt = db.prepare(`
      INSERT INTO appointments (
        reference_code, user_id, patient_name, patient_email, patient_phone,
        department_id, doctor_id, appointment_date, time_slot,
        medical_issue, description, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?, ?)
    `);

    try {
      stmt.run(
        refCode,
        userId,
        patientName.trim(),
        patientEmail.trim(),
        patientPhone ? patientPhone.trim() : null,
        departmentId,
        doctorId,
        appointmentDate,
        timeSlot,
        medicalIssue.trim(),
        description ? description.trim() : null,
        nowIso,
        nowIso
      );
    } catch (err) {
      if (err && /UNIQUE constraint failed/i.test(err.message)) {
        throw new Error(`This time slot (${timeSlot}) on ${appointmentDate} is no longer available. Please choose another time.`);
      }
      throw err;
    }

    const created = db.prepare('SELECT * FROM appointments WHERE reference_code = ?').get(refCode);
    return this.getAppointmentById(created.id, userId);
  },

  // Cancel Appointment (Eligible Upcoming Visits Only)
  cancelAppointment(id, userId, cancellationReason = 'Cancelled by patient') {
    const apt = this.getAppointmentById(id, userId);
    if (!apt) {
      throw new Error('Appointment not found or you do not have permission to modify it.');
    }

    if (apt.status === 'Cancelled') {
      throw new Error('Appointment is already cancelled.');
    }

    if (apt.status === 'Completed') {
      throw new Error('Cannot cancel an appointment that has already been completed.');
    }

    const now = new Date();
    const todayStr = getLocalTodayStr(now);
    if (apt.appointment_date < todayStr || (apt.appointment_date === todayStr && isSlotElapsedToday(apt.time_slot, now))) {
      throw new Error('Cannot cancel an appointment whose scheduled time has already passed.');
    }

    const cleanReason = String(cancellationReason || '').trim().slice(0, 300) || 'Cancelled by patient';
    const nowIso = now.toISOString();
    db.prepare(`
      UPDATE appointments 
      SET status = 'Cancelled', cancellation_reason = ?, cancelled_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(cleanReason, nowIso, nowIso, id, userId);

    return this.getAppointmentById(id, userId);
  },

  // User Dashboard Stats
  getUserStats(userId) {
    const todayStr = getLocalTodayStr();
    const total = db.prepare('SELECT COUNT(*) as c FROM appointments WHERE user_id = ?').get(userId).c;
    const upcoming = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE user_id = ? AND status IN ('Confirmed', 'Pending') AND appointment_date >= ?").get(userId, todayStr).c;
    const pending = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE user_id = ? AND status = 'Pending'").get(userId).c;
    const completed = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE user_id = ? AND status = 'Completed'").get(userId).c;
    const cancelled = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE user_id = ? AND status = 'Cancelled'").get(userId).c;

    const nextUpcoming = db.prepare(`
      SELECT a.*, doc.name as doctor_name, doc.title as doctor_title, doc.avatar as doctor_avatar, doc.room_number as doctor_room, d.name as department_name, d.color as department_color
      FROM appointments a
      JOIN doctors doc ON a.doctor_id = doc.id
      JOIN departments d ON a.department_id = d.id
      WHERE a.user_id = ? AND a.status IN ('Confirmed', 'Pending') AND a.appointment_date >= ?
      ORDER BY a.appointment_date ASC, a.time_slot ASC
      LIMIT 1
    `).get(userId, todayStr);

    return {
      total,
      upcoming,
      pending,
      completed,
      cancelled,
      nextUpcoming
    };
  }
};
