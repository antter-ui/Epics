// server/db.js
// SQLite database layer utilizing Node 22 native DatabaseSync
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const dbPath = path.join(__dirname, '..', 'data', 'healthcare.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Enable WAL mode for high performance and integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function initDatabase() {
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
      role TEXT DEFAULT 'patient',
      created_at TEXT NOT NULL
    );
  `);

  // Run column migrations for existing databases
  try { db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT;'); } catch (e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN password_salt TEXT;'); } catch (e) {}

  // 2. Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

  seedInitialData();
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
    return db.prepare('SELECT id, google_id, email, name, avatar, role, created_at FROM users WHERE id = ?').get(id);
  },

  getUserByGoogleId(googleId) {
    return db.prepare('SELECT id, google_id, email, name, avatar, role, created_at FROM users WHERE google_id = ?').get(googleId);
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
        db.prepare('UPDATE users SET password_hash = ?, password_salt = ?, name = ? WHERE id = ?')
          .run(hash, salt, cleanName, existing.id);
        return this.getUserById(existing.id);
      }
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    const id = 'usr_' + crypto.randomBytes(8).toString('hex');
    const now = new Date().toISOString();
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=0284c7`;

    db.prepare(`
      INSERT INTO users (id, email, password_hash, password_salt, name, avatar, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'patient', ?)
    `).run(id, cleanEmail, hash, salt, cleanName, avatar, now);

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
    let user = this.getUserByGoogleId(googleId) || this.getUserByEmail(cleanEmail);
    if (user) {
      db.prepare(`
        UPDATE users SET name = ?, avatar = ?, google_id = ? WHERE id = ?
      `).run(name, avatar || user.avatar, googleId, user.id);
      return this.getUserById(user.id);
    } else {
      const id = 'usr_' + crypto.randomBytes(8).toString('hex');
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO users (id, google_id, email, name, avatar, role, created_at)
        VALUES (?, ?, ?, ?, ?, 'patient', ?)
      `).run(id, googleId, cleanEmail, name, avatar, now);
      return this.getUserById(id);
    }
  },

  // Sessions
  createSession(userId, durationDays = 7) {
    const token = 'ses_' + crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 86400000);

    db.prepare(`
      INSERT INTO sessions (token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(token, userId, now.toISOString(), expiresAt.toISOString());

    return { token, expiresAt: expiresAt.toISOString() };
  },

  getSession(token) {
    if (!token) return null;
    const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
    if (!session) return null;

    if (new Date(session.expires_at) < new Date()) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      return null;
    }

    const user = this.getUserById(session.user_id);
    if (!user) return null;

    return { session, user };
  },

  deleteSession(token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
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
      SELECT doc.*, d.name AS department_name, d.slug AS department_slug, d.color AS department_color
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
      SELECT doc.*, d.name AS department_name, d.slug AS department_slug, d.color AS department_color
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

    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = (dateStr === todayStr);

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const slots = ALL_TIME_SLOTS.map(slot => {
      const isBooked = bookedSlotMap.has(slot);
      let isPast = false;

      if (isToday) {
        const [timePart, meridiem] = slot.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        if (meridiem === 'PM' && hours !== 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
        const slotMinutes = hours * 60 + minutes;

        if (slotMinutes <= currentMinutes + 15) {
          isPast = true;
        }
      }

      const isAvailable = !isBooked && !isPast;
      let reason = 'Available';
      if (isBooked) reason = 'Already Booked';
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
      slots
    };
  },

  // Appointments (Strictly Scoped to Current Authenticated Patient)
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
    return db.prepare(sql).all(...params);
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
    return db.prepare(sql).get(id, userId);
  },

  // Atomic Slot Booking with Collision Check
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

    const todayStr = new Date().toISOString().split('T')[0];
    if (appointmentDate < todayStr) {
      throw new Error('Appointment date cannot be in the past.');
    }

    const existing = db.prepare(`
      SELECT id FROM appointments
      WHERE doctor_id = ? AND appointment_date = ? AND time_slot = ? AND status != 'Cancelled'
    `).get(doctorId, appointmentDate, timeSlot);

    if (existing) {
      throw new Error(`This time slot (${timeSlot}) with ${doctor.name} is already booked. Please choose another time.`);
    }

    const refCode = `MED-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO appointments (
        reference_code, user_id, patient_name, patient_email, patient_phone,
        department_id, doctor_id, appointment_date, time_slot,
        medical_issue, description, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?, ?)
    `);

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

    const created = db.prepare('SELECT * FROM appointments WHERE reference_code = ?').get(refCode);
    return this.getAppointmentById(created.id, userId);
  },

  // Cancel Appointment
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

    const nowIso = new Date().toISOString();
    db.prepare(`
      UPDATE appointments 
      SET status = 'Cancelled', cancellation_reason = ?, cancelled_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(cancellationReason, nowIso, nowIso, id, userId);

    return this.getAppointmentById(id, userId);
  },

  // User Dashboard Stats
  getUserStats(userId) {
    const total = db.prepare('SELECT COUNT(*) as c FROM appointments WHERE user_id = ?').get(userId).c;
    const upcoming = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE user_id = ? AND status = 'Confirmed' AND appointment_date >= date('now')").get(userId).c;
    const pending = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE user_id = ? AND status = 'Pending'").get(userId).c;
    const completed = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE user_id = ? AND status = 'Completed'").get(userId).c;
    const cancelled = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE user_id = ? AND status = 'Cancelled'").get(userId).c;

    const nextUpcoming = db.prepare(`
      SELECT a.*, doc.name as doctor_name, doc.title as doctor_title, doc.avatar as doctor_avatar, doc.room_number as doctor_room, d.name as department_name, d.color as department_color
      FROM appointments a
      JOIN doctors doc ON a.doctor_id = doc.id
      JOIN departments d ON a.department_id = d.id
      WHERE a.user_id = ? AND a.status = 'Confirmed' AND a.appointment_date >= date('now')
      ORDER BY a.appointment_date ASC, a.time_slot ASC
      LIMIT 1
    `).get(userId);

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
