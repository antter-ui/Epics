// public/app.js
// MediCare Connect - Core Frontend Application Logic

(function () {
  'use strict';

  // Application State
  const state = {
    currentUser: null,
    departments: [],
    doctors: [],
    appointments: [],
    stats: null,
    activeTab: 'All',
    searchQuery: '',
    deptFilter: '',
    activeModal: null,
    selectedAppointment: null,
    bookingSuccessData: null,

    // Booking Wizard Form State
    booking: {
      patientName: '',
      patientEmail: '',
      patientPhone: '',
      medicalIssue: '',
      description: '',
      departmentId: null,
      doctorId: null,
      appointmentDate: '',
      timeSlot: '',
      availableSlots: [],
      isLoadingSlots: false,
      isSubmitting: false
    }
  };

  // DOM Elements Cache
  const el = {};

  function initElements() {
    el.mainContent = document.getElementById('mainContent');
    el.authSection = document.getElementById('authSection');
    el.userMenu = document.getElementById('userMenu');
    el.userAvatar = document.getElementById('userAvatar');
    el.userName = document.getElementById('userName');
    el.btnSignIn = document.getElementById('btnSignIn');
    el.btnLogout = document.getElementById('btnLogout');
    el.btnBookNav = document.getElementById('btnBookNav');
    el.btnBookHero = document.getElementById('btnBookHero');

    // Dashboard
    el.heroPatientName = document.getElementById('heroPatientName');
    el.statUpcoming = document.getElementById('statUpcoming');
    el.statCompleted = document.getElementById('statCompleted');
    el.statPending = document.getElementById('statPending');
    el.statTotal = document.getElementById('statTotal');
    el.heroStatTotal = document.getElementById('heroStatTotal');
    el.nextAppointmentSection = document.getElementById('nextAppointmentSection');

    // Appointments list & controls
    el.statusTabs = document.getElementById('statusTabs');
    el.searchInput = document.getElementById('searchInput');
    el.deptFilterSelect = document.getElementById('deptFilterSelect');
    el.appointmentsContainer = document.getElementById('appointmentsContainer');

    // Modals
    el.loginModal = document.getElementById('loginModal');
    el.bookingModal = document.getElementById('bookingModal');
    el.detailsModal = document.getElementById('detailsModal');
    el.cancelModal = document.getElementById('cancelModal');
    el.successModal = document.getElementById('successModal');

    // Toast Container
    el.toastContainer = document.getElementById('toastContainer');
  }

  // Toast Notification System
  function showToast(message, type = 'success') {
    if (!el.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    `;

    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Format Date Helper
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return dateStr;
  }

  // API Client
  async function apiRequest(endpoint, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };

    const token = localStorage.getItem('mc_token');
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    try {
      const res = await fetch(endpoint, config);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server request failed');
      }
      return data;
    } catch (err) {
      throw err;
    }
  }

  // -------------------------------------------------------------
  // Authentication & Initialization
  // -------------------------------------------------------------
  async function checkAuth() {
    const token = localStorage.getItem('mc_token');
    if (!token) {
      clearUser();
      await loadPublicDirectory();
      return;
    }
    try {
      const data = await apiRequest('/api/auth/me');
      if (data && data.user) {
        setUser(data.user);
        await loadInitialData();
      } else {
        clearUser();
        await loadPublicDirectory();
      }
    } catch (err) {
      clearUser();
      await loadPublicDirectory();
    }
  }

  function setUser(user) {
    state.currentUser = user;
    if (el.userName) el.userName.textContent = user.name;
    if (el.userAvatar) el.userAvatar.src = user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`;
    if (el.heroPatientName) el.heroPatientName.textContent = user.name;
    if (el.authSection) el.authSection.style.display = 'none';
    if (el.userMenu) el.userMenu.style.display = 'flex';
    if (el.mainContent) el.mainContent.style.display = 'block';

    // Auto fill patient details in booking state
    state.booking.patientName = user.name;
    state.booking.patientEmail = user.email;
  }

  function clearUser() {
    state.currentUser = null;
    localStorage.removeItem('mc_token');
    if (el.authSection) el.authSection.style.display = 'flex';
    if (el.userMenu) el.userMenu.style.display = 'none';
  }

  function switchAuthTab(tab) {
    const tabSignInBtn = document.getElementById('tabSignInBtn');
    const tabSignUpBtn = document.getElementById('tabSignUpBtn');
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');
    const loginErrorMsg = document.getElementById('loginErrorMsg');
    const regErrorMsg = document.getElementById('regErrorMsg');

    if (loginErrorMsg) loginErrorMsg.style.display = 'none';
    if (regErrorMsg) regErrorMsg.style.display = 'none';

    if (tab === 'signin') {
      if (tabSignInBtn) tabSignInBtn.classList.add('active');
      if (tabSignUpBtn) tabSignUpBtn.classList.remove('active');
      if (signInForm) signInForm.style.display = 'block';
      if (signUpForm) signUpForm.style.display = 'none';
    } else {
      if (tabSignUpBtn) tabSignUpBtn.classList.add('active');
      if (tabSignInBtn) tabSignInBtn.classList.remove('active');
      if (signUpForm) signUpForm.style.display = 'block';
      if (signInForm) signInForm.style.display = 'none';
    }
  }

  async function submitEmailLogin() {
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPassword');
    const errorBanner = document.getElementById('loginErrorMsg');
    const submitBtn = document.getElementById('btnSubmitLogin');

    if (errorBanner) errorBanner.style.display = 'none';

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passInput ? passInput.value : '';

    if (!email || !password) {
      if (errorBanner) {
        errorBanner.textContent = 'Please enter both email and password.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';
    }

    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (res.token) {
        localStorage.setItem('mc_token', res.token);
      }
      setUser(res.user);
      closeModal();
      showToast(`Welcome back, ${res.user.name}!`, 'success');
      await loadInitialData();
    } catch (err) {
      if (errorBanner) {
        errorBanner.textContent = err.message;
        errorBanner.style.display = 'block';
      }
      showToast(err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Patient Portal';
      }
    }
  }

  async function submitEmailRegister() {
    const nameInput = document.getElementById('regName');
    const emailInput = document.getElementById('regEmail');
    const passInput = document.getElementById('regPassword');
    const errorBanner = document.getElementById('regErrorMsg');
    const submitBtn = document.getElementById('btnSubmitRegister');

    if (errorBanner) errorBanner.style.display = 'none';

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passInput ? passInput.value : '';

    if (!name || !email || !password) {
      if (errorBanner) {
        errorBanner.textContent = 'Please fill out all required fields.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    if (password.length < 6) {
      if (errorBanner) {
        errorBanner.textContent = 'Password must be at least 6 characters.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';
    }

    try {
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });

      if (res.token) {
        localStorage.setItem('mc_token', res.token);
      }
      setUser(res.user);
      closeModal();
      showToast(`Welcome to MediCare Connect, ${res.user.name}!`, 'success');
      await loadInitialData();
    } catch (err) {
      if (errorBanner) {
        errorBanner.textContent = err.message;
        errorBanner.style.display = 'block';
      }
      showToast(err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Patient Account';
      }
    }
  }

  // -------------------------------------------------------------
  // Firebase Authentication
  // -------------------------------------------------------------
  let firebaseInitialized = false;

  function getActiveFirebaseConfig() {
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY') {
      return window.FIREBASE_CONFIG;
    }
    const saved = localStorage.getItem('mc_firebase_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.apiKey && parsed.apiKey !== 'YOUR_API_KEY') return parsed;
      } catch (e) { }
    }
    return window.FIREBASE_CONFIG || null;
  }

  function initFirebaseApp() {
    const config = getActiveFirebaseConfig();
    if (!config || !config.apiKey || config.apiKey === 'YOUR_API_KEY') {
      return false;
    }
    if (!window.firebase) {
      console.warn('Firebase SDK not loaded.');
      return false;
    }

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }
      firebaseInitialized = true;
      return true;
    } catch (err) {
      console.error('Firebase init error:', err);
      return false;
    }
  }

  async function loginWithFirebaseGoogle() {
    if (!firebaseInitialized) {
      initFirebaseApp();
    }

    const btn = document.getElementById('btnFirebaseGoogle');
    const resetGoogleBtn = () => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Continue with Google</span>
        `;
      }
    };

    if (firebaseInitialized) {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:8px;">Opening Google Sign-In...</span>`;
      }

      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await firebase.auth().signInWithPopup(provider);
        const fbUser = result.user;

        const res = await apiRequest('/api/auth/firebase-login', {
          method: 'POST',
          body: JSON.stringify({
            email: fbUser.email,
            name: fbUser.displayName || fbUser.email.split('@')[0],
            avatar: fbUser.photoURL,
            uid: fbUser.uid
          })
        });

        if (res.token) {
          localStorage.setItem('mc_token', res.token);
        }
        setUser(res.user);
        closeModal();
        showToast(`Welcome, ${res.user.name}! Signed in successfully with Google.`, 'success');
        await loadInitialData();
        return;
      } catch (err) {
        console.error('Firebase Auth Error:', err);
        resetGoogleBtn();

        if (err.code === 'auth/popup-closed-by-user') {
          showToast('Sign-in popup was closed.', 'info');
          return;
        } else if (err.code === 'auth/operation-not-allowed') {
          showToast('Please enable "Google" under Firebase Console > Authentication > Sign-in method.', 'error');
          setTimeout(() => openGoogleAccountChooser(), 1200);
          return;
        } else if (err.code === 'auth/unauthorized-domain') {
          showToast('Domain not authorized in Firebase. Add localhost in Firebase Console > Authentication > Settings.', 'error');
          setTimeout(() => openGoogleAccountChooser(), 1200);
          return;
        } else {
          showToast(err.message || 'Firebase sign-in failed.', 'error');
          setTimeout(() => openGoogleAccountChooser(), 1200);
          return;
        }
      } finally {
        resetGoogleBtn();
      }
    }

    // Direct Google Account Selector
    openGoogleAccountChooser();
  }

  function openGoogleAccountChooser() {
    let chooser = document.getElementById('googleChooserModal');
    if (!chooser) {
      chooser = document.createElement('div');
      chooser.id = 'googleChooserModal';
      chooser.className = 'modal-backdrop open';
      document.body.appendChild(chooser);
    } else {
      chooser.classList.add('open');
    }

    chooser.innerHTML = `
      <div class="modal-card" style="max-width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
        <div class="modal-header" style="border-bottom: 1px solid var(--border-light); padding: 1.25rem;">
          <div style="display:flex; align-items:center; gap:0.65rem;">
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span style="font-weight:700; font-size:1.1rem; color:var(--text-primary);">Google Authorization</span>
          </div>
          <button class="btn-close-modal" onclick="document.getElementById('googleChooserModal').classList.remove('open')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="modal-body" style="padding: 1.25rem;">
          <p style="font-size:0.88rem; color:var(--text-secondary); margin-bottom:1.25rem;">
            Choose a Google account to authorize and continue to <strong>MediCare Connect</strong>:
          </p>

          <!-- Primary Account: Vedu Jns -->
          <div class="demo-account-card" style="border:2px solid #0284c7; background:#f0f9ff; margin-bottom:0.75rem;" onclick="window.MediCareApp.loginWithDirectGoogle('vedujns6@gmail.com', 'Vedu Jns')">
            <div class="demo-user-left">
              <div style="width:40px; height:40px; border-radius:50%; background:#0284c7; color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.15rem;">V</div>
              <div>
                <div style="font-weight:700; font-size:0.95rem; color:#0f172a;">Vedu Jns</div>
                <div style="font-size:0.8rem; color:#0369a1; font-weight:600;">vedujns6@gmail.com</div>
              </div>
            </div>
            <span style="font-size:0.75rem; font-weight:700; background:#0284c7; color:white; padding:0.25rem 0.65rem; border-radius:999px;">
              Authorize &rarr;
            </span>
          </div>

          <!-- Option to enter another Google Email -->
          <div style="border-top:1px solid var(--border-light); padding-top:1rem; margin-top:1rem;">
            <label style="font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.35rem; display:block;">
              Or sign in with any Google account:
            </label>
            <div style="display:flex; gap:0.5rem;">
              <input type="email" id="inputOtherGoogleEmail" class="form-input" placeholder="your.name@gmail.com" />
              <button type="button" class="btn-primary" style="white-space:nowrap; padding:0.55rem 1rem;" onclick="const e=document.getElementById('inputOtherGoogleEmail').value.trim(); if(e) window.MediCareApp.loginWithDirectGoogle(e);">
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function loginWithDirectGoogle(email, name = null) {
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name || cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
    const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    try {
      const res = await apiRequest('/api/auth/firebase-login', {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          name: formattedName,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(formattedName)}&backgroundColor=0284c7`,
          uid: `google_${cleanEmail}`
        })
      });

      if (res.token) {
        localStorage.setItem('mc_token', res.token);
      }
      setUser(res.user);

      // Close all modals
      closeModal();
      const chooser = document.getElementById('googleChooserModal');
      if (chooser) chooser.classList.remove('open');

      showToast(`Welcome, ${res.user.name}! Google authorization successful.`, 'success');
      await loadInitialData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function saveFirebaseConfig() {
    const textarea = document.getElementById('inputFirebaseConfig');
    if (!textarea || !textarea.value.trim()) {
      showToast('Please paste your Firebase configuration.', 'error');
      return;
    }

    let raw = textarea.value.trim();
    raw = raw.replace(/^const\s+\w+\s*=\s*/, '').replace(/;\s*$/, '');

    try {
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        parsed = (new Function(`return (${raw});`))();
      }

      if (!parsed || !parsed.apiKey) {
        throw new Error('Config missing apiKey.');
      }

      localStorage.setItem('mc_firebase_config', JSON.stringify(parsed));
      window.FIREBASE_CONFIG = parsed;
      initFirebaseApp();

      const box = document.getElementById('firebaseConfigBox');
      if (box) box.style.display = 'none';

      showToast('Firebase configuration saved successfully! You can now click Continue with Google.', 'success');
    } catch (err) {
      showToast('Could not parse Firebase configuration: ' + err.message, 'error');
    }
  }

  async function logout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore
    }
    clearUser();
    showToast('You have been logged out securely.', 'info');
    setTimeout(() => { window.location.href = '/login.html'; }, 700);
  }

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  async function loadInitialData() {
    try {
      // Fetch departments, doctors, appointments, stats in parallel
      const [deptData, docData, aptData, statsData] = await Promise.all([
        apiRequest('/api/departments'),
        apiRequest('/api/doctors'),
        apiRequest('/api/appointments'),
        apiRequest('/api/stats')
      ]);

      state.departments = deptData.departments || [];
      state.doctors = docData.doctors || [];
      state.appointments = aptData.appointments || [];
      state.stats = statsData.stats || null;

      populateDepartmentFilter();
      renderDashboardStats();
      renderAppointments();
      renderDoctorsDirectory();
    } catch (err) {
      console.error('Error loading data:', err);
      showToast('Could not load appointment data: ' + err.message, 'error');
    }
  }

  async function loadPublicDirectory() {
    try {
      const [deptData, docData] = await Promise.all([
        apiRequest('/api/departments'),
        apiRequest('/api/doctors')
      ]);
      state.departments = deptData.departments || [];
      state.doctors = docData.doctors || [];
      populateDepartmentFilter();
      renderDoctorsDirectory();
    } catch (err) {
      console.error('Error loading doctors directory:', err);
    }
  }

  function renderDoctorsDirectory() {
    const grid = document.getElementById('doctorsDirectoryGrid');
    const deptSelect = document.getElementById('docDeptFilter');
    const searchInput = document.getElementById('docSearchInput');
    if (!grid) return;

    if (deptSelect && deptSelect.options.length <= 1 && state.departments.length > 0) {
      state.departments.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.name;
        deptSelect.appendChild(opt);
      });
    }

    const deptFilter = deptSelect ? deptSelect.value : '';
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const filtered = state.doctors.filter(doc => {
      const matchesDept = !deptFilter || String(doc.department_id) === String(deptFilter);
      const matchesQuery = !query ||
        doc.name.toLowerCase().includes(query) ||
        (doc.department_name || '').toLowerCase().includes(query) ||
        (doc.qualification || '').toLowerCase().includes(query) ||
        (doc.bio || '').toLowerCase().includes(query);
      return matchesDept && matchesQuery;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-muted);">No doctors match your search criteria.</div>`;
      return;
    }

    grid.innerHTML = filtered.map(doc => `
      <article class="directory-doctor-card">
        <div>
          <div class="dir-doc-top">
            <img class="dir-doc-avatar" src="${escapeHtml(doc.avatar)}" alt="${escapeHtml(doc.name)}" />
            <div class="dir-doc-info">
              <span class="dir-doc-specialty">${escapeHtml(doc.department_name || '')}</span>
              <h3>${escapeHtml(doc.name)}</h3>
              <div class="dir-doc-qual">${escapeHtml(doc.qualification)} &bull; ${doc.experience_years} yrs exp</div>
            </div>
          </div>
          <p class="dir-doc-bio" style="margin-top:0.85rem;">${escapeHtml(doc.bio)}</p>
        </div>
        <div>
          <div class="dir-doc-meta">
            <span>★ ${doc.rating} (${doc.reviews_count} reviews)</span>
            <span>Room ${escapeHtml(doc.room_number)}</span>
            <span class="dir-doc-days">Available: ${escapeHtml(doc.available_days)}</span>
          </div>
          <div class="dir-doc-actions" style="margin-top:0.85rem;">
            <span class="dir-doc-fee">\$${doc.consultation_fee} / visit</span>
            <button type="button" class="btn-primary" style="padding:0.5rem 1rem; font-size:0.84rem;" onclick="window.MediCareApp.openBookingModal(${doc.department_id}, ${doc.id})">
              Book Appointment
            </button>
          </div>
        </div>
      </article>
    `).join('');
  }

  async function refreshAppointments() {
    try {
      const [aptData, statsData] = await Promise.all([
        apiRequest('/api/appointments'),
        apiRequest('/api/stats')
      ]);
      state.appointments = aptData.appointments || [];
      state.stats = statsData.stats || null;

      renderDashboardStats();
      renderAppointments();
    } catch (err) {
      console.error('Error refreshing appointments:', err);
    }
  }

  // -------------------------------------------------------------
  // Dashboard & Appointments Rendering
  // -------------------------------------------------------------
  function populateDepartmentFilter() {
    if (!el.deptFilterSelect) return;
    el.deptFilterSelect.innerHTML = '<option value="">All Departments</option>' +
      state.departments.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
  }

  function renderDashboardStats() {
    if (!state.stats) return;

    if (el.statUpcoming) el.statUpcoming.textContent = state.stats.upcoming || 0;
    if (el.statCompleted) el.statCompleted.textContent = state.stats.completed || 0;
    if (el.statPending) el.statPending.textContent = state.stats.pending || 0;
    if (el.statTotal) el.statTotal.textContent = state.stats.total || 0;
    if (el.heroStatTotal) el.heroStatTotal.textContent = state.stats.total || 0;

    // Next upcoming appointment banner
    renderNextAppointmentBanner(state.stats.nextUpcoming);
  }

  function renderNextAppointmentBanner(nextApt) {
    if (!el.nextAppointmentSection) return;

    if (!nextApt) {
      el.nextAppointmentSection.innerHTML = '';
      el.nextAppointmentSection.style.display = 'none';
      return;
    }

    el.nextAppointmentSection.style.display = 'block';
    el.nextAppointmentSection.innerHTML = `
      <div class="next-appointment-banner">
        <div class="next-apt-left">
          <img class="next-apt-avatar" src="${escapeHtml(nextApt.doctor_avatar)}" alt="${escapeHtml(nextApt.doctor_name)}" />
          <div>
            <div class="next-apt-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              Next Upcoming Consultation
            </div>
            <div class="next-apt-doctor">${escapeHtml(nextApt.doctor_name)} <span style="font-size:0.85rem; font-weight:normal; opacity:0.85;">(${escapeHtml(nextApt.department_name)})</span></div>
            <div class="next-apt-details">
              <span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                ${formatDate(nextApt.appointment_date)} at ${escapeHtml(nextApt.time_slot)}
              </span>
              <span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                ${escapeHtml(nextApt.doctor_room)}
              </span>
            </div>
          </div>
        </div>
        <div class="next-apt-actions">
          <button class="btn-banner-white" onclick="window.MediCareApp.openDetailsModal(${nextApt.id})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            View Details
          </button>
          <button class="btn-banner-transparent" onclick="window.MediCareApp.addToGoogleCalendar(${nextApt.id})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Google Calendar
          </button>
        </div>
      </div>
    `;
  }

  function renderAppointments() {
    if (!el.appointmentsContainer) return;

    // Filter by Active Tab
    let list = state.appointments;
    if (state.activeTab !== 'All') {
      list = list.filter(a => a.status === state.activeTab);
    }

    // Filter by Search Query
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase().trim();
      list = list.filter(a =>
        a.doctor_name.toLowerCase().includes(q) ||
        a.medical_issue.toLowerCase().includes(q) ||
        a.department_name.toLowerCase().includes(q) ||
        (a.reference_code && a.reference_code.toLowerCase().includes(q))
      );
    }

    // Filter by Department
    if (state.deptFilter) {
      list = list.filter(a => String(a.department_id) === String(state.deptFilter));
    }

    // Update Tab Counts
    updateTabCounts();

    if (list.length === 0) {
      el.appointmentsContainer.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </div>
          <h3>No Appointments Found</h3>
          <p>There are no appointments matching your current selection or filter criteria.</p>
          <button class="btn-primary" onclick="window.MediCareApp.openBookingModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Book an Appointment Now
          </button>
        </div>
      `;
      return;
    }

    el.appointmentsContainer.innerHTML = list.map(apt => {
      const statusClass = `status-${apt.status.toLowerCase()}`;
      let statusIcon = '';
      if (apt.status === 'Confirmed') {
        statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      } else if (apt.status === 'Pending') {
        statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
      } else if (apt.status === 'Completed') {
        statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
      } else if (apt.status === 'Cancelled') {
        statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
      }

      const isCancellable = (apt.status === 'Confirmed' || apt.status === 'Pending');

      return `
        <div class="appointment-card" id="apt-${apt.id}">
          <div class="apt-card-top">
            <div class="apt-doctor-profile">
              <img class="apt-doctor-img" src="${escapeHtml(apt.doctor_avatar)}" alt="${escapeHtml(apt.doctor_name)}" />
              <div class="apt-doctor-info">
                <h3>
                  ${escapeHtml(apt.doctor_name)}
                  <span class="department-tag" style="background:${escapeHtml(apt.department_color)}15; color:${escapeHtml(apt.department_color)};">
                    ${escapeHtml(apt.department_name)}
                  </span>
                </h3>
                <div class="apt-doctor-title">${escapeHtml(apt.doctor_title)} &bull; ${escapeHtml(apt.doctor_qualification)}</div>
              </div>
            </div>
            <div>
              <span class="apt-status-badge ${statusClass}">
                ${statusIcon}
                ${escapeHtml(apt.status)}
              </span>
            </div>
          </div>

          <div class="apt-card-details-grid">
            <div class="apt-detail-item">
              <span class="apt-detail-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                Date
              </span>
              <span class="apt-detail-value">${formatDate(apt.appointment_date)}</span>
            </div>
            <div class="apt-detail-item">
              <span class="apt-detail-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                Time Slot
              </span>
              <span class="apt-detail-value">${escapeHtml(apt.time_slot)}</span>
            </div>
            <div class="apt-detail-item">
              <span class="apt-detail-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                Location / Room
              </span>
              <span class="apt-detail-value">${escapeHtml(apt.doctor_room)}</span>
            </div>
            <div class="apt-detail-item">
              <span class="apt-detail-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                Consultation Fee
              </span>
              <span class="apt-detail-value">$${escapeHtml(apt.consultation_fee)}</span>
            </div>
          </div>

          <div class="apt-issue-box">
            <div class="apt-issue-title">Medical Concern / Issue:</div>
            <div class="apt-issue-text">${escapeHtml(apt.medical_issue)}</div>
            ${apt.description ? `<div class="apt-description-note"><strong>Notes:</strong> ${escapeHtml(apt.description)}</div>` : ''}
          </div>

          ${apt.doctor_notes ? `
            <div class="apt-doctor-notes-box">
              <strong>🩺 Doctor's Consultation Summary & Prescription:</strong>
              ${escapeHtml(apt.doctor_notes)}
            </div>
          ` : ''}

          ${apt.status === 'Cancelled' ? `
            <div class="apt-cancellation-box">
              <strong>❌ Cancellation Details:</strong>
              Reason: ${escapeHtml(apt.cancellation_reason || 'Not specified')}
            </div>
          ` : ''}

          <div class="apt-card-footer">
            <div class="apt-ref-id">Ref: ${escapeHtml(apt.reference_code)}</div>
            <div class="apt-actions-group">
              <button class="btn-sm-details" onclick="window.MediCareApp.openDetailsModal(${apt.id})">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                Full Details
              </button>
              ${isCancellable ? `
                <button class="btn-sm-cancel" onclick="window.MediCareApp.openCancelModal(${apt.id})">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                  Cancel
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function updateTabCounts() {
    const counts = {
      All: state.appointments.length,
      Confirmed: state.appointments.filter(a => a.status === 'Confirmed').length,
      Pending: state.appointments.filter(a => a.status === 'Pending').length,
      Completed: state.appointments.filter(a => a.status === 'Completed').length,
      Cancelled: state.appointments.filter(a => a.status === 'Cancelled').length
    };

    ['All', 'Confirmed', 'Pending', 'Completed', 'Cancelled'].forEach(tab => {
      const badge = document.getElementById(`count-${tab}`);
      if (badge) badge.textContent = counts[tab] || 0;
    });
  }

  // -------------------------------------------------------------
  // Booking Wizard Modal Logic
  // -------------------------------------------------------------
  function openBookingModal(preselectedDeptId = null, preselectedDocId = null) {
    if (!state.currentUser) {
      window.location.href = '/login.html';
      return;
    }

    // Default form state
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    state.booking = {
      patientName: state.currentUser.name,
      patientEmail: state.currentUser.email,
      patientPhone: '',
      medicalIssue: '',
      description: '',
      departmentId: preselectedDeptId || (state.departments[0] ? state.departments[0].id : null),
      doctorId: preselectedDocId || null,
      appointmentDate: tomorrow,
      timeSlot: '',
      availableSlots: [],
      isLoadingSlots: false,
      isSubmitting: false
    };

    renderBookingModalContent();
    openModal(el.bookingModal);

    // If department preselected, set doctors
    if (state.booking.departmentId) {
      onDepartmentSelected(state.booking.departmentId, false);
    }
  }

  function renderBookingModalContent() {
    const today = new Date().toISOString().split('T')[0];

    el.bookingModal.querySelector('.modal-body').innerHTML = `
      <form id="bookingForm" onsubmit="event.preventDefault(); window.MediCareApp.submitBooking();">
        <!-- 1. Patient Information -->
        <div class="form-section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          1. Patient Details
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Patient Name <span class="req">*</span></label>
            <input type="text" id="bookPatientName" class="form-input" value="${escapeHtml(state.booking.patientName)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Email Address <span class="req">*</span></label>
            <input type="email" id="bookPatientEmail" class="form-input" value="${escapeHtml(state.booking.patientEmail)}" required readonly style="background:#f1f5f9; cursor:not-allowed;" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Phone Number (Optional)</label>
          <input type="tel" id="bookPatientPhone" class="form-input" placeholder="+1 (555) 000-0000" />
        </div>

        <!-- 2. Medical Concern -->
        <div class="form-section-title" style="margin-top:1.5rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          2. Medical Issue & Health Concern
        </div>
        <div class="form-group">
          <label class="form-label">Primary Health Concern or Symptom <span class="req">*</span></label>
          <input type="text" id="bookMedicalIssue" class="form-input" placeholder="e.g., Persistent joint pain in left knee, chest discomfort, skin rash..." required />
          <div class="form-hint">Briefly state the primary symptom or reason for your visit.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Detailed Description of Problem (Optional)</label>
          <textarea id="bookDescription" class="form-textarea" placeholder="How long have you had this problem? Any known allergies or current medications?"></textarea>
        </div>

        <!-- 3. Department & Doctor -->
        <div class="form-section-title" style="margin-top:1.5rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          3. Select Specialization & Doctor
        </div>
        
        <label class="form-label">Medical Specialization <span class="req">*</span></label>
        <div class="departments-grid-picker" id="deptPickerGrid">
          ${state.departments.map(d => `
            <div class="dept-pick-card ${state.booking.departmentId === d.id ? 'selected' : ''}" 
                 onclick="window.MediCareApp.onDepartmentSelected(${d.id})" id="dept-card-${d.id}">
              <div class="dept-pick-icon" style="background:${escapeHtml(d.color)}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
              </div>
              <div class="dept-pick-name">${escapeHtml(d.name)}</div>
              <div class="dept-pick-count">${escapeHtml(d.doctor_count || 2)} Specialists</div>
            </div>
          `).join('')}
        </div>

        <label class="form-label">Available Doctors <span class="req">*</span></label>
        <div class="doctors-grid-picker" id="doctorPickerGrid">
          <!-- Populated dynamically based on selected department -->
        </div>

        <!-- 4. Date and Time Slot -->
        <div class="form-section-title" style="margin-top:1.5rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          4. Appointment Date & Time Slot
        </div>

        <div class="form-group">
          <label class="form-label">Preferred Date <span class="req">*</span></label>
          <input type="date" id="bookDate" class="form-input" min="${today}" value="${state.booking.appointmentDate}" onchange="window.MediCareApp.onDateChanged(this.value)" required />
        </div>

        <div class="slots-container">
          <div class="slots-subhead">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            Available Time Slots (Real-Time Availability Check)
          </div>
          <div id="slotsGridWrapper">
            <div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.9rem;">
              Select a doctor and date above to load available appointment slots.
            </div>
          </div>
        </div>

        <div id="bookingErrorBanner" style="display:none; padding:0.75rem 1rem; border-radius:var(--radius-md); background:#fef2f2; border:1px solid #fee2e2; color:#b91c1c; font-size:0.88rem; margin-bottom:1rem;"></div>

        <div class="modal-footer" style="padding:1rem 0 0 0; border-top:1px solid var(--border-light); margin-top:1rem; background:transparent;">
          <button type="button" class="btn-secondary" onclick="window.MediCareApp.closeModal()">Cancel</button>
          <button type="submit" id="btnSubmitBooking" class="btn-primary" style="padding:0.75rem 1.75rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Confirm & Book Appointment
          </button>
        </div>
      </form>
    `;
  }

  function onDepartmentSelected(deptId, autoPickFirstDoctor = true) {
    state.booking.departmentId = deptId;
    state.booking.timeSlot = '';

    // Update UI highlights
    document.querySelectorAll('.dept-pick-card').forEach(el => el.classList.remove('selected'));
    const chosen = document.getElementById(`dept-card-${deptId}`);
    if (chosen) chosen.classList.add('selected');

    // Filter doctors belonging to this department
    const deptDoctors = state.doctors.filter(d => Number(d.department_id) === Number(deptId));
    const doctorGrid = document.getElementById('doctorPickerGrid');

    if (!doctorGrid) return;

    if (deptDoctors.length === 0) {
      doctorGrid.innerHTML = `<div style="grid-column: span 2; color:var(--text-muted);">No doctors found for this department.</div>`;
      return;
    }

    doctorGrid.innerHTML = deptDoctors.map(doc => `
      <div class="doctor-pick-card ${state.booking.doctorId === doc.id ? 'selected' : ''}" 
           onclick="window.MediCareApp.onDoctorSelected(${doc.id})" id="doc-card-${doc.id}">
        <img class="doctor-pick-img" src="${escapeHtml(doc.avatar)}" alt="${escapeHtml(doc.name)}" />
        <div class="doctor-pick-details">
          <div class="doctor-pick-name">${escapeHtml(doc.name)}</div>
          <div class="doctor-pick-qual">${escapeHtml(doc.qualification)}</div>
          <div class="doctor-pick-meta">
            <span class="doctor-rating-pill">★ ${doc.rating} (${doc.reviews_count})</span>
            <span class="doctor-fee-pill">$${doc.consultation_fee}</span>
          </div>
        </div>
      </div>
    `).join('');

    // Select doctor
    if (autoPickFirstDoctor || !state.booking.doctorId) {
      onDoctorSelected(deptDoctors[0].id);
    } else {
      // Re-trigger slots query
      fetchSlotAvailability();
    }
  }

  function onDoctorSelected(doctorId) {
    state.booking.doctorId = doctorId;
    state.booking.timeSlot = '';

    document.querySelectorAll('.doctor-pick-card').forEach(el => el.classList.remove('selected'));
    const chosen = document.getElementById(`doc-card-${doctorId}`);
    if (chosen) chosen.classList.add('selected');

    fetchSlotAvailability();
  }

  function onDateChanged(dateVal) {
    state.booking.appointmentDate = dateVal;
    state.booking.timeSlot = '';
    fetchSlotAvailability();
  }

  async function fetchSlotAvailability() {
    const slotsWrapper = document.getElementById('slotsGridWrapper');
    if (!slotsWrapper) return;

    if (!state.booking.doctorId || !state.booking.appointmentDate) {
      slotsWrapper.innerHTML = `
        <div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.9rem;">
          Please select a doctor and appointment date to load available time slots.
        </div>
      `;
      return;
    }

    slotsWrapper.innerHTML = `
      <div style="padding:1.5rem; text-align:center; color:var(--primary); font-size:0.9rem;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite; vertical-align:middle; margin-right:8px;"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="10"></circle></svg>
        Checking real-time doctor schedule...
      </div>
    `;

    try {
      const data = await apiRequest(`/api/availability?doctorId=${state.booking.doctorId}&date=${state.booking.appointmentDate}`);
      state.booking.availableSlots = data.slots || [];
      renderSlotsGrid();
    } catch (err) {
      slotsWrapper.innerHTML = `
        <div style="padding:1rem; text-align:center; color:#b91c1c; font-size:0.88rem;">
          Error checking availability: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }

  function renderSlotsGrid() {
    const slotsWrapper = document.getElementById('slotsGridWrapper');
    if (!slotsWrapper) return;

    const slots = state.booking.availableSlots;
    if (!slots || slots.length === 0) {
      slotsWrapper.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-muted);">No slots configured.</div>`;
      return;
    }

    // Split Morning and Afternoon
    const morningSlots = slots.filter(s => s.slot.includes('AM'));
    const afternoonSlots = slots.filter(s => s.slot.includes('PM'));

    slotsWrapper.innerHTML = `
      <div style="margin-bottom:0.75rem;">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.4rem;">
          Morning Slots (09:00 AM – 11:30 AM)
        </div>
        <div class="slots-grid">
          ${morningSlots.map(s => renderSlotButton(s)).join('')}
        </div>
      </div>
      <div>
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.4rem;">
          Afternoon & Evening Slots (02:00 PM – 05:00 PM)
        </div>
        <div class="slots-grid">
          ${afternoonSlots.map(s => renderSlotButton(s)).join('')}
        </div>
      </div>
    `;
  }

  function renderSlotButton(s) {
    const isSelected = (state.booking.timeSlot === s.slot);
    const isDisabled = !s.is_available;
    const badgeText = s.is_available ? 'Available' : s.reason;

    return `
      <button type="button" 
              class="slot-btn ${isSelected ? 'selected' : ''}" 
              ${isDisabled ? 'disabled' : ''}
              onclick="window.MediCareApp.onSlotSelected('${s.slot}')"
              title="${escapeHtml(s.reason)}">
        <span>${escapeHtml(s.slot)}</span>
        <span class="slot-status-text">${escapeHtml(badgeText)}</span>
      </button>
    `;
  }

  function onSlotSelected(slotStr) {
    state.booking.timeSlot = slotStr;
    renderSlotsGrid();
  }

  async function submitBooking() {
    const errorBanner = document.getElementById('bookingErrorBanner');
    const submitBtn = document.getElementById('btnSubmitBooking');
    if (errorBanner) errorBanner.style.display = 'none';

    // Read form inputs
    const patientName = document.getElementById('bookPatientName').value.trim();
    const patientEmail = document.getElementById('bookPatientEmail').value.trim();
    const patientPhone = document.getElementById('bookPatientPhone').value.trim();
    const medicalIssue = document.getElementById('bookMedicalIssue').value.trim();
    const description = document.getElementById('bookDescription').value.trim();
    const appointmentDate = document.getElementById('bookDate').value;
    const departmentId = state.booking.departmentId;
    const doctorId = state.booking.doctorId;
    const timeSlot = state.booking.timeSlot;

    // Frontend validations
    const errors = [];
    if (!patientName || patientName.length < 2) errors.push('Please enter patient name.');
    if (!medicalIssue || medicalIssue.length < 3) errors.push('Please describe your medical issue or health concern (at least 3 characters).');
    if (!departmentId) errors.push('Please select a department.');
    if (!doctorId) errors.push('Please select a doctor.');
    if (!appointmentDate) errors.push('Please select an appointment date.');
    if (!timeSlot) errors.push('Please select a time slot.');

    if (errors.length > 0) {
      if (errorBanner) {
        errorBanner.textContent = errors.join(' ');
        errorBanner.style.display = 'block';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="10"></circle></svg>
        Confirming Booking...
      `;
    }

    try {
      const res = await apiRequest('/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientName,
          patientEmail,
          patientPhone,
          medicalIssue,
          description,
          departmentId,
          doctorId,
          appointmentDate,
          timeSlot
        })
      });

      closeModal();
      showToast('Appointment booked successfully!', 'success');

      // Open Success Confirmation Modal
      state.bookingSuccessData = res.appointment;
      openSuccessModal(res.appointment);

      // Refresh data
      await refreshAppointments();
    } catch (err) {
      if (errorBanner) {
        errorBanner.textContent = err.message;
        errorBanner.style.display = 'block';
      }
      showToast(err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Confirm & Book Appointment
        `;
      }
    }
  }

  // -------------------------------------------------------------
  // Booking Success Modal
  // -------------------------------------------------------------
  function openSuccessModal(apt) {
    if (!el.successModal) return;

    el.successModal.querySelector('.modal-body').innerHTML = `
      <div class="success-screen-box">
        <div class="success-check-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h2>Appointment Confirmed!</h2>
        <p>Your appointment has been registered and confirmed in our hospital management system.</p>

        <div class="success-code-banner">
          <div class="success-code-label">Booking Reference Number</div>
          <div class="success-code-val">${escapeHtml(apt.reference_code)}</div>
        </div>

        <div class="success-summary-card">
          <div style="display:flex; align-items:center; gap:0.85rem; margin-bottom:1rem;">
            <img src="${escapeHtml(apt.doctor_avatar)}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;" />
            <div>
              <div style="font-weight:700; font-size:1rem;">${escapeHtml(apt.doctor_name)}</div>
              <div style="font-size:0.82rem; color:var(--text-muted);">${escapeHtml(apt.department_name)} &bull; ${escapeHtml(apt.doctor_title)}</div>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; font-size:0.88rem;">
            <div><strong>Date:</strong> ${formatDate(apt.appointment_date)}</div>
            <div><strong>Time:</strong> ${escapeHtml(apt.time_slot)}</div>
            <div><strong>Location:</strong> ${escapeHtml(apt.doctor_room)}</div>
            <div><strong>Fee:</strong> $${escapeHtml(apt.consultation_fee)}</div>
          </div>
        </div>

        <div style="display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap;">
          <button class="btn-primary" onclick="window.MediCareApp.addToGoogleCalendar(${apt.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Add to Google Calendar
          </button>
          <button class="btn-secondary" onclick="window.MediCareApp.printAppointmentSlip(${apt.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Print Appointment Slip
          </button>
          <button class="btn-secondary" onclick="window.MediCareApp.closeModal()">
            Done & Return to Dashboard
          </button>
        </div>
      </div>
    `;

    openModal(el.successModal);
  }

  // -------------------------------------------------------------
  // Appointment Details Modal
  // -------------------------------------------------------------
  function openDetailsModal(aptId) {
    const apt = state.appointments.find(a => a.id === aptId);
    if (!apt) return;

    state.selectedAppointment = apt;

    // Timeline calculation
    let step1 = 'done', step2 = 'done', step3 = '', step4 = '';
    if (apt.status === 'Confirmed') {
      step2 = 'active';
    } else if (apt.status === 'Completed') {
      step2 = 'done';
      step3 = 'done';
      step4 = 'done';
    } else if (apt.status === 'Cancelled') {
      step2 = 'cancelled-step';
    }

    el.detailsModal.querySelector('.modal-body').innerHTML = `
      <div class="timeline-tracker">
        <div class="timeline-step ${step1}">
          <div class="timeline-circle">1</div>
          <span class="timeline-label">Booked</span>
        </div>
        <div class="timeline-step ${step2}">
          <div class="timeline-circle">2</div>
          <span class="timeline-label">${apt.status === 'Cancelled' ? 'Cancelled' : 'Confirmed'}</span>
        </div>
        <div class="timeline-step ${step3}">
          <div class="timeline-circle">3</div>
          <span class="timeline-label">Consultation</span>
        </div>
        <div class="timeline-step ${step4}">
          <div class="timeline-circle">4</div>
          <span class="timeline-label">Completed</span>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
        <div>
          <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Reference Code</span>
          <div style="font-family:monospace; font-size:1.15rem; font-weight:800; color:var(--primary-dark);">${escapeHtml(apt.reference_code)}</div>
        </div>
        <div>
          <span class="apt-status-badge status-${apt.status.toLowerCase()}">${escapeHtml(apt.status)}</span>
        </div>
      </div>

      <div style="background:var(--bg-subtle); border-radius:var(--radius-md); padding:1.25rem; margin-bottom:1.25rem; display:flex; gap:1.25rem; align-items:center;">
        <img src="${escapeHtml(apt.doctor_avatar)}" style="width:68px; height:68px; border-radius:50%; object-fit:cover; border:2px solid white; box-shadow:var(--shadow-sm);" />
        <div>
          <h3 style="font-size:1.15rem; font-weight:700; margin-bottom:0.15rem;">${escapeHtml(apt.doctor_name)}</h3>
          <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.35rem;">
            ${escapeHtml(apt.doctor_title)} &bull; ${escapeHtml(apt.doctor_qualification)}
          </div>
          <div style="font-size:0.82rem; color:var(--text-secondary);">
            🏥 <strong>Room:</strong> ${escapeHtml(apt.doctor_room)} | 💵 <strong>Fee:</strong> $${escapeHtml(apt.consultation_fee)}
          </div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.25rem;">
        <div style="background:white; border:1px solid var(--border-light); border-radius:var(--radius-md); padding:0.85rem;">
          <div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Appointment Date</div>
          <div style="font-size:0.95rem; font-weight:700;">${formatDate(apt.appointment_date)}</div>
        </div>
        <div style="background:white; border:1px solid var(--border-light); border-radius:var(--radius-md); padding:0.85rem;">
          <div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Time Slot</div>
          <div style="font-size:0.95rem; font-weight:700;">${escapeHtml(apt.time_slot)}</div>
        </div>
      </div>

      <div style="margin-bottom:1.25rem;">
        <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.35rem;">Medical Issue & Reason for Visit</div>
        <div style="background:var(--bg-subtle); padding:0.85rem 1rem; border-radius:var(--radius-md); font-size:0.92rem;">
          ${escapeHtml(apt.medical_issue)}
        </div>
        ${apt.description ? `
          <div style="margin-top:0.5rem; font-size:0.88rem; color:var(--text-secondary); padding:0.5rem 0.75rem; border-left:3px solid var(--primary); background:white;">
            <strong>Patient Notes:</strong> ${escapeHtml(apt.description)}
          </div>
        ` : ''}
      </div>

      ${apt.doctor_notes ? `
        <div class="apt-doctor-notes-box">
          <strong>🩺 Doctor's Consultation Diagnosis & Prescription Notes:</strong>
          <p style="margin-top:0.35rem;">${escapeHtml(apt.doctor_notes)}</p>
        </div>
      ` : ''}

      ${apt.status === 'Cancelled' ? `
        <div class="apt-cancellation-box">
          <strong>❌ Cancellation Reason:</strong>
          <p style="margin-top:0.35rem;">${escapeHtml(apt.cancellation_reason || 'Not specified')}</p>
        </div>
      ` : ''}

      <div class="modal-footer" style="padding:1rem 0 0 0; background:transparent;">
        <div>
          ${(apt.status === 'Confirmed' || apt.status === 'Pending') ? `
            <button class="btn-sm-cancel" style="padding:0.6rem 1rem;" onclick="window.MediCareApp.openCancelModal(${apt.id})">
              Cancel Appointment
            </button>
          ` : ''}
        </div>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn-secondary" onclick="window.MediCareApp.printAppointmentSlip(${apt.id})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Print Slip
          </button>
          <button class="btn-primary" onclick="window.MediCareApp.closeModal()">
            Close
          </button>
        </div>
      </div>
    `;

    openModal(el.detailsModal);
  }

  // -------------------------------------------------------------
  // Cancel Modal Logic
  // -------------------------------------------------------------
  function openCancelModal(aptId) {
    const apt = state.appointments.find(a => a.id === aptId);
    if (!apt) return;

    state.selectedAppointment = apt;

    el.cancelModal.querySelector('.modal-body').innerHTML = `
      <div style="text-align:center; padding:1rem 0;">
        <div style="width:56px; height:56px; border-radius:50%; background:#fee2e2; color:#b91c1c; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <h3 style="font-size:1.25rem; font-weight:800; margin-bottom:0.35rem;">Cancel Appointment?</h3>
        <p style="color:var(--text-secondary); font-size:0.9rem; max-width:400px; margin:0 auto 1.25rem;">
          Are you sure you want to cancel your consultation with <strong>${escapeHtml(apt.doctor_name)}</strong> on <strong>${formatDate(apt.appointment_date)}</strong> at <strong>${escapeHtml(apt.time_slot)}</strong>?
        </p>

        <div class="form-group" style="text-align:left; max-width:400px; margin:0 auto 1.25rem;">
          <label class="form-label">Reason for Cancellation (Optional)</label>
          <select id="cancelReasonSelect" class="form-select" onchange="if(this.value === 'Other') document.getElementById('cancelCustomReason').style.display='block'; else document.getElementById('cancelCustomReason').style.display='none';">
            <option value="Schedule conflict or work commitment">Schedule conflict or work commitment</option>
            <option value="Symptoms improved or resolved">Symptoms improved or resolved</option>
            <option value="Need to reschedule for another date">Need to reschedule for another date</option>
            <option value="Consulting with local physician">Consulting with local physician</option>
            <option value="Other">Other reason...</option>
          </select>
          <input type="text" id="cancelCustomReason" class="form-input" placeholder="Please specify your reason" style="display:none; margin-top:0.5rem;" />
        </div>

        <div style="display:flex; justify-content:center; gap:0.75rem;">
          <button type="button" class="btn-secondary" onclick="window.MediCareApp.closeModal()">Keep Appointment</button>
          <button type="button" id="btnConfirmCancel" class="btn-sm-cancel" style="padding:0.65rem 1.25rem; font-size:0.92rem;" onclick="window.MediCareApp.submitCancellation(${apt.id})">
            Yes, Cancel Appointment
          </button>
        </div>
      </div>
    `;

    openModal(el.cancelModal);
  }

  async function submitCancellation(aptId) {
    const btn = document.getElementById('btnConfirmCancel');
    const select = document.getElementById('cancelReasonSelect');
    const custom = document.getElementById('cancelCustomReason');

    let reason = select ? select.value : 'Cancelled by patient';
    if (reason === 'Other' && custom && custom.value.trim()) {
      reason = custom.value.trim();
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Cancelling...';
    }

    try {
      await apiRequest(`/api/appointments/${aptId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });

      closeModal();
      showToast('Appointment has been cancelled successfully.', 'info');
      await refreshAppointments();
    } catch (err) {
      showToast(err.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Yes, Cancel Appointment';
      }
    }
  }

  // -------------------------------------------------------------
  // Add to Google Calendar & Print Slip
  // -------------------------------------------------------------
  function addToGoogleCalendar(aptId) {
    const apt = state.appointments.find(a => a.id === aptId) || state.bookingSuccessData;
    if (!apt) return;

    // Build Google Calendar Event URL
    // Format date and time
    // Example: apt.appointment_date = "2026-11-25", time_slot = "10:30 AM"
    const dateStr = apt.appointment_date.replace(/-/g, '');
    let [timePart, meridiem] = apt.time_slot.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const startH = String(hours).padStart(2, '0');
    const startM = String(minutes).padStart(2, '0');
    // 30 min duration
    let endHours = hours;
    let endM = minutes + 30;
    if (endM >= 60) {
      endHours += 1;
      endM -= 60;
    }
    const endH = String(endHours).padStart(2, '0');
    const endMStr = String(endM).padStart(2, '0');

    const startIso = `${dateStr}T${startH}${startM}00`;
    const endIso = `${dateStr}T${endH}${endMStr}00`;

    const title = encodeURIComponent(`Doctor Appointment: ${apt.doctor_name} (${apt.department_name})`);
    const details = encodeURIComponent(`Medical Appointment with ${apt.doctor_name}.\nDepartment: ${apt.department_name}\nBooking Ref: ${apt.reference_code}\nMedical Issue: ${apt.medical_issue}\nPatient: ${apt.patient_name}`);
    const location = encodeURIComponent(`MediCare Connect Clinic - ${apt.doctor_room}`);

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
    window.open(gcalUrl, '_blank');
  }

  function printAppointmentSlip(aptId) {
    const apt = state.appointments.find(a => a.id === aptId) || state.bookingSuccessData;
    if (!apt) return;

    // Create printable window or trigger print
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Appointment Slip - ${escapeHtml(apt.reference_code)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: bold; color: #0284c7; }
          .ref { font-family: monospace; font-size: 18px; margin-top: 5px; color: #475569; }
          .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 12px; }
          .label { font-weight: bold; color: #64748b; }
          .val { font-weight: 600; color: #0f172a; }
          .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">🏥 MediCare Connect Medical Center</div>
          <div>Official Patient Appointment Slip</div>
          <div class="ref">Booking Reference: ${escapeHtml(apt.reference_code)}</div>
        </div>
        <div class="card">
          <div class="row"><span class="label">Patient Name:</span><span class="val">${escapeHtml(apt.patient_name)}</span></div>
          <div class="row"><span class="label">Patient Email:</span><span class="val">${escapeHtml(apt.patient_email)}</span></div>
          <div class="row"><span class="label">Appointment Date:</span><span class="val">${formatDate(apt.appointment_date)}</span></div>
          <div class="row"><span class="label">Appointment Time:</span><span class="val">${escapeHtml(apt.time_slot)}</span></div>
          <div class="row"><span class="label">Department:</span><span class="val">${escapeHtml(apt.department_name)}</span></div>
          <div class="row"><span class="label">Consulting Doctor:</span><span class="val">${escapeHtml(apt.doctor_name)}</span></div>
          <div class="row"><span class="label">Clinic Location:</span><span class="val">${escapeHtml(apt.doctor_room)}</span></div>
          <div class="row"><span class="label">Consultation Fee:</span><span class="val">$${escapeHtml(apt.consultation_fee)}</span></div>
          <div class="row"><span class="label">Appointment Status:</span><span class="val">${escapeHtml(apt.status)}</span></div>
        </div>
        <div class="card">
          <div class="label" style="margin-bottom:8px;">Reason for Visit / Medical Issue:</div>
          <div>${escapeHtml(apt.medical_issue)}</div>
        </div>
        <div class="footer">
          Please arrive 15 minutes prior to your scheduled consultation time.<br>
          For emergency support or rescheduling, visit your MediCare Connect portal.
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }

  // -------------------------------------------------------------
  // Modal Management
  // -------------------------------------------------------------
  function openModal(modalEl) {
    closeModal();
    if (modalEl) {
      modalEl.classList.add('open');
      state.activeModal = modalEl;
    }
  }

  function closeModal() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
    state.activeModal = null;
  }

  function openLoginModal() {
    openModal(el.loginModal);
  }

  // -------------------------------------------------------------
  // Event Listeners & Global Setup
  // -------------------------------------------------------------
  function setupEventListeners() {
    // Search input
    if (el.searchInput) {
      el.searchInput.addEventListener('input', e => {
        state.searchQuery = e.target.value;
        renderAppointments();
      });
    }

    // Department filter select
    if (el.deptFilterSelect) {
      el.deptFilterSelect.addEventListener('change', e => {
        state.deptFilter = e.target.value;
        renderAppointments();
      });
    }

    // Available Doctors Directory filters
    const docSearchInput = document.getElementById('docSearchInput');
    const docDeptFilter = document.getElementById('docDeptFilter');
    if (docSearchInput) {
      docSearchInput.addEventListener('input', () => renderDoctorsDirectory());
    }
    if (docDeptFilter) {
      docDeptFilter.addEventListener('change', () => renderDoctorsDirectory());
    }

    // Status Tabs
    if (el.statusTabs) {
      el.statusTabs.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          el.statusTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          state.activeTab = btn.getAttribute('data-status');
          renderAppointments();
        });
      });
    }

    // Nav and Hero booking buttons
    if (el.btnBookNav) el.btnBookNav.addEventListener('click', () => openBookingModal());
    if (el.btnBookHero) el.btnBookHero.addEventListener('click', () => openBookingModal());
    if (el.btnSignIn) el.btnSignIn.addEventListener('click', (e) => { e.preventDefault(); window.location.href = '/login.html'; });
    if (el.btnLogout) el.btnLogout.addEventListener('click', () => logout());

    // Close modal on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) {
          closeModal();
        }
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.activeModal) {
        closeModal();
      }
    });
  }

  // Google Sign-In SDK Initialization callback
  window.handleGoogleCredentialResponse = function (response) {
    if (response && response.credential) {
      loginWithGoogleCredential(response.credential);
    }
  };

  // Expose public API to window for inline onclick handlers
  window.MediCareApp = {
    openBookingModal,
    openDetailsModal,
    openCancelModal,
    openLoginModal,
    closeModal,
    switchAuthTab,
    submitEmailLogin,
    submitEmailRegister,
    loginWithFirebaseGoogle,
    saveFirebaseConfig,
    logout,
    onDepartmentSelected,
    onDoctorSelected,
    onDateChanged,
    onSlotSelected,
    submitBooking,
    submitCancellation,
    addToGoogleCalendar,
    printAppointmentSlip
  };

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    initElements();
    setupEventListeners();
    checkAuth();
    initFirebaseApp();
  });

})();
