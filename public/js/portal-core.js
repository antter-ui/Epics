// public/js/portal-core.js
// Shared API, Auth, Appointment Booking, Calendar Export & UI Utilities
(function (global) {
  'use strict';

  const DEPARTMENT_MEDIA = {
    'cardiology': 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=768&h=456&fit=crop',
    'dermatology': 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=768&h=456&fit=crop',
    'orthopedics': 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=768&h=456&fit=crop',
    'general-medicine': 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=768&h=456&fit=crop',
    'neurology': 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=768&h=456&fit=crop',
    'pediatrics': 'https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?w=768&h=456&fit=crop'
  };

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function showToast(message, type = 'success') {
    let wrap = document.getElementById('tpToastWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'tpToastWrap';
      wrap.className = 'tp-toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = `tp-toast tp-toast--${type}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  async function apiRequest(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = localStorage.getItem('mc_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(endpoint, { ...options, headers });
    const rawText = await res.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      data = {};
    }
    if (!res.ok) {
      const fallbackMsg = res.status === 404 && !data.error
        ? `API endpoint not found (404) at ${window.location.origin}${endpoint}. Make sure you are accessing the app through the running Node server URL (not VS Code Live Server or a static preview).`
        : `Request failed (${res.status})`;
      throw new Error(data.error || fallbackMsg);
    }
    return data;
  }

  async function getCurrentUser() {
    try {
      const data = await apiRequest('/api/auth/me');
      return data.user || null;
    } catch (e) {
      return null;
    }
  }

  async function requireAuth(redirectTo = '/login.html') {
    const user = await getCurrentUser();
    if (!user) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${redirectTo}?redirect=${next}`;
      return null;
    }
    return user;
  }

  async function logout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (e) { /* ignore */ }
    localStorage.removeItem('mc_token');
    showToast('Signed out securely.', 'success');
    setTimeout(() => { window.location.href = '/login.html'; }, 600);
  }

  function enrichDepartment(dept) {
    return {
      ...dept,
      image: DEPARTMENT_MEDIA[dept.slug] || 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=768&h=456&fit=crop'
    };
  }

  function addToGoogleCalendar(apt) {
    if (!apt) return;
    const dateStr = apt.appointment_date.replace(/-/g, '');
    const [timePart, meridiem] = apt.time_slot.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    let endH = hours;
    let endM = minutes + 30;
    if (endM >= 60) { endH += 1; endM -= 60; }

    const pad = n => String(n).padStart(2, '0');
    const startIso = `${dateStr}T${pad(hours)}${pad(minutes)}00`;
    const endIso = `${dateStr}T${pad(endH)}${pad(endM)}00`;

    const title = encodeURIComponent(`Consultation: ${apt.doctor_name} (${apt.department_name})`);
    const details = encodeURIComponent(`Ref: ${apt.reference_code}\nIssue: ${apt.medical_issue}\nPatient: ${apt.patient_name}`);
    const location = encodeURIComponent(`The Practitioner Clinic - ${apt.doctor_room}`);
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`, '_blank');
  }

  function printAppointmentSlip(apt) {
    if (!apt) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Appointment Slip - ${esc(apt.reference_code)}</title>
        <style>
          body { font-family: 'Outfit', -apple-system, sans-serif; padding: 40px; color: #333133; }
          .head { border-bottom: 2px solid #527359; padding-bottom: 18px; margin-bottom: 26px; }
          .brand { font-size: 24px; color: #527359; font-weight: 500; }
          .card { border: 1px solid #E1DFDB; border-radius: 12px; padding: 20px; margin-bottom: 18px; background: #FAF5F0; }
          .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #E1DFDB; }
          .row:last-child { border-bottom: none; }
        </style>
      </head>
      <body>
        <div class="head">
          <div class="brand">The Practitioner Medical Clinic</div>
          <div>Official Appointment Confirmation &bull; Ref: <strong>${esc(apt.reference_code)}</strong></div>
        </div>
        <div class="card">
          <div class="row"><span>Patient</span><strong>${esc(apt.patient_name)} (${esc(apt.patient_email)})</strong></div>
          <div class="row"><span>Date &amp; Time</span><strong>${esc(formatDate(apt.appointment_date))} at ${esc(apt.time_slot)}</strong></div>
          <div class="row"><span>Department</span><strong>${esc(apt.department_name)}</strong></div>
          <div class="row"><span>Specialist</span><strong>${esc(apt.doctor_name)}</strong></div>
          <div class="row"><span>Clinic Room</span><strong>${esc(apt.doctor_room)}</strong></div>
          <div class="row"><span>Consultation Fee</span><strong>$${esc(apt.consultation_fee)}</strong></div>
          <div class="row"><span>Status</span><strong>${esc(apt.status)}</strong></div>
        </div>
        <div class="card">
          <div><strong>Reason for Visit:</strong></div>
          <p>${esc(apt.medical_issue)}</p>
        </div>
      </body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  /** Initialize header/footer + scroll-reveal on any page. */
  async function mountLayout({ activePath, overlay = false, requireUser = false } = {}) {
    const user = requireUser ? await requireAuth() : await getCurrentUser();
    if (requireUser && !user) return null;

    const headerMount = document.getElementById('siteHeader');
    const footerMount = document.getElementById('siteFooter');
    if (headerMount && global.PractitionerUI) {
      headerMount.innerHTML = global.PractitionerUI.renderHeader({ activePath, overlay, user });
      global.PractitionerUI.initInteractions();
    }
    if (footerMount && global.PractitionerUI) {
      footerMount.innerHTML = global.PractitionerUI.renderFooter();
    }

    // Subtle scroll reveal on desktop/tablet
    if (window.matchMedia('(min-width: 768px)').matches && 'IntersectionObserver' in window) {
      const obs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      document.querySelectorAll('.tp-reveal').forEach(el => obs.observe(el));
    } else {
      document.querySelectorAll('.tp-reveal').forEach(el => el.classList.add('is-visible'));
    }

    return user;
  }

  /** Render authenticated portal sub-navigation bar. */
  function renderPortalSubnav(activeHref, user) {
    const links = [
      { label: 'Dashboard', href: '/dashboard.html' },
      { label: 'Book Appointment', href: '/book.html' },
      { label: 'My Appointments', href: '/appointments.html' },
      { label: 'Patient Profile', href: '/profile.html' }
    ];
    return `
      <div class="tp-portal-bar">
        <div class="tp-container tp-portal-nav">
          <div class="tp-portal-links">
            ${links.map(l => `<a href="${l.href}" class="tp-portal-pill ${l.href === activeHref ? 'is-active' : ''}">${l.label}</a>`).join('')}
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-size:15px; color:var(--tp-color-secondary);">Signed in as <strong>${esc(user.name)}</strong></span>
            <button type="button" class="tp-btn tp-btn--outline tp-btn--sm" style="padding:7px 16px;" onclick="window.PortalCore.logout()">Sign Out</button>
          </div>
        </div>
      </div>
    `;
  }

  global.PortalCore = {
    esc,
    formatDate,
    showToast,
    apiRequest,
    getCurrentUser,
    requireAuth,
    logout,
    enrichDepartment,
    addToGoogleCalendar,
    printAppointmentSlip,
    mountLayout,
    renderPortalSubnav
  };
})(window);
