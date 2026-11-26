# MediCare Connect 🏥

A modern, responsive, and secure healthcare appointment booking web application built with Google Authentication, real-time doctor availability checks, slot collision prevention, and personalized patient management dashboards.

![MediCare Connect](public/favicon.svg)

---

## 🌟 Key Features

### 1. Google OAuth Authentication & Authorization
- **Google Identity Services (GIS)** integration for official one-click Google Sign-In.
- Secure HTTP session management with session tokens stored in HTTP-only cookies and Bearer headers.
- **Strict Authorization**: Each patient is restricted to accessing and modifying only their own appointments.
- **Evaluation / Demo Profiles**: Built-in 1-click demo accounts (`sarah.jenkins@gmail.com`, `david.miller@gmail.com`, `elena.rossi@gmail.com`) and custom Google email simulator for instant offline or evaluation testing without requiring pre-registered GCP OAuth keys.

### 2. Patient Dashboard
- **Personalized Patient Welcome**: Displays patient name, avatar, and Google-verified badge.
- **Summary Metrics**: Real-time counter cards for Upcoming Visits, Completed Consultations, Pending Confirmation, and Total Appointments.
- **Immediate Next Appointment Banner**: Shows the next scheduled visit with doctor info, clinic room, countdown, and direct 1-click **Add to Google Calendar** button.
- **Tabbed Status Filters**: Filter appointments by `All`, `Confirmed`, `Pending`, `Completed`, and `Cancelled` with live count badges.
- **Instant Search & Department Filter**: Real-time filtering by doctor name, health issue, reference code, or medical department.

### 3. Guided Appointment Booking Wizard
- **Patient Details**: Pre-filled from the patient's Google profile.
- **Medical Concern & Symptoms**: Clear input for primary medical concern and optional detailed symptoms/medications.
- **Interactive Department Picker**: Choose from 6 medical specializations (Cardiology, Dermatology, Orthopedics, General Medicine, Neurology, Pediatrics).
- **Dynamic Doctor Selection**: Displays specialized doctors matching the chosen department, including credentials, ratings, consultation fees, and clinic rooms.
- **Interactive Calendar & Time Slots**:
  - Minimum date is set to today to prevent booking in the past.
  - **Real-Time Availability Check**: Automatically probes the database for already-booked slots. Booked slots or past time slots for today are disabled with an "Already Booked" badge.
  - **Atomic Collision Prevention**: Database-level check ensures two patients cannot book the same doctor slot simultaneously.

### 4. Appointment Management & Clinical Records
- **Detailed Overview Modal**: Displays reference code (`MED-2026-XXXX`), appointment timeline progression (*Booked &rarr; Confirmed &rarr; Consultation &rarr; Completed*), doctor diagnosis, prescription notes, and clinic location.
- **Appointment Cancellation**: Allows cancelling active appointments with reason tracking.
- **Booking Confirmation Modal**: Displays confirmed appointment details, booking reference code, Google Calendar export, and printable slip.
- **Printable Appointment Slip**: Clean print layout (`Ctrl+P` / Print button) formatted specifically for clinical check-ins.

### 5. UI/UX & Calming Healthcare Theme
- **Color Palette**: Clinical Azure Blue (`#0284c7`), Healing Emerald & Mint Green (`#10b981`), Clean Pure White (`#ffffff`), and Slate Gray neutrals.
- **Emergency Alert Banner**: Prominently warns patients to call 911 for life-threatening emergencies.
- **Responsive Design**: Fully responsive across mobile, tablet, and desktop screens.
- **Toast Notifications**: Non-intrusive feedback for logins, bookings, cancellations, and errors.

---

## 🛠️ Architecture & Tech Stack

- **Backend**: Native Node.js (v22+) HTTP server with custom RESTful routing. Zero external npm dependencies required!
- **Database**: Native SQLite (`node:sqlite` DatabaseSync) in WAL mode, stored in `data/healthcare.db`.
- **Frontend**: Vanilla JavaScript (ES6+), semantic HTML5, modern CSS with CSS variables, Glassmorphism backdrop-blur, and Lucide SVG icons.
- **Authentication**: Google OAuth 2.0 (Google Identity Services) + JWT parsing + session tokens.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v22 or run using the included `run.bat` or `node.bat` script).

### Running the Application

1. **Start the Server**:
   ```cmd
   .\run.bat
   ```
   *Or using command line:*
   ```cmd
   node server/server.js
   ```

2. **Open in Browser**:
   Navigate to:
   ```
   http://localhost:3000
   ```

3. **Running Automated Tests**:
   Verify all 13 backend endpoints, authorization checks, and collision prevention:
   ```cmd
   node test-server.js
   ```

---

## 🔒 Google OAuth Setup (Optional)

To connect your own Google Cloud Platform Client ID:
1. Go to the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Add `http://localhost:3000` to **Authorized JavaScript origins**.
4. In `public/index.html`, replace `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com` in the `data-client_id` attribute with your Client ID.

*Note: You can test all features immediately using the 1-click Google accounts without needing a GCP key.*

---

## 📁 Project Structure

```
c:\epics\
├── data\
│   └── healthcare.db       # SQLite database file (auto-generated)
├── server\
│   ├── db.js               # Database schema, queries, and seed data
│   ├── auth.js             # Google OAuth JWT decoding, demo auth, and sessions
│   ├── routes.js           # REST API endpoints & route dispatchers
│   └── server.js           # HTTP server, static file serving, and SPA router
├── public\
│   ├── index.html          # Semantic HTML layout, modals, and branding
│   ├── styles.css          # Healthcare UI design, color palette, and animations
│   ├── app.js              # State management, API integration, and booking wizard
│   └── favicon.svg         # Healthcare pulse and medical cross logo
├── test-server.js          # Automated end-to-end API test suite (13 tests)
├── package.json            # Project manifest
├── node.bat                # Node runtime launcher
└── run.bat                 # 1-click startup batch script
```
