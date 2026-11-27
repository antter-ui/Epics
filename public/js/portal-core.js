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

  const REMEMBERED_ACCOUNTS_KEY = 'mc_remembered_accounts';

  function getRememberedAccounts() {
    try {
      const raw = localStorage.getItem(REMEMBERED_ACCOUNTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(a => a && typeof a.email === 'string' && a.email.includes('@'));
    } catch (e) {
      return [];
    }
  }

  function rememberAccount(user, providerOverride = null) {
    if (!user || !user.email) return;
    try {
      const email = String(user.email).trim().toLowerCase();
      const existing = getRememberedAccounts();
      const prev = existing.find(a => a.email === email);
      const cleanAvatar = user.avatar && !String(user.avatar).includes('patient-avatar.svg') ? String(user.avatar) : (prev ? prev.avatar : '');
      const provider = providerOverride || (prev && prev.provider) || user.auth_provider || 'email';
      const entry = {
        email,
        name: String(user.name || (prev && prev.name) || email.split('@')[0]).trim(),
        avatar: cleanAvatar,
        provider: provider === 'google' ? 'google' : 'email',
        lastUsedAt: Date.now()
      };
      const updated = [entry, ...existing.filter(a => a.email !== email)].slice(0, 4);
      localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(updated));
    } catch (e) { /* ignore storage quota errors */ }
  }

  function clearRememberedAccounts(email = null) {
    try {
      if (!email) {
        localStorage.removeItem(REMEMBERED_ACCOUNTS_KEY);
        return [];
      }
      const target = String(email).trim().toLowerCase();
      const filtered = getRememberedAccounts().filter(a => a.email !== target);
      localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(filtered));
      return filtered;
    } catch (e) {
      return [];
    }
  }

  function getCachedUser() {
    try {
      const raw = sessionStorage.getItem('mc_user_cache');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setCachedUser(user, providerOverride = null) {
    try {
      if (user) {
        sessionStorage.setItem('mc_user_cache', JSON.stringify(user));
        sessionStorage.removeItem('tp_manual_logout');
        rememberAccount(user, providerOverride);
      } else {
        sessionStorage.removeItem('mc_user_cache');
      }
    } catch (e) { /* ignore */ }
  }

  async function getCurrentUser() {
    try {
      const data = await apiRequest('/api/auth/me');
      setCachedUser(data.user || null);
      return data.user || null;
    } catch (e) {
      setCachedUser(null);
      return null;
    }
  }

  async function requireAuth(redirectTo = '/login.html') {
    let user = await getCurrentUser();
    if (!user && sessionStorage.getItem('tp_manual_logout') !== '1') {
      user = await trySilentBackgroundRestore();
    }
    if (!user) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${redirectTo}?redirect=${next}`;
      return null;
    }
    return user;
  }

  async function logout() {
    setCachedUser(null);
    sessionStorage.setItem('tp_manual_logout', '1');
    localStorage.removeItem('mc_token');
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (e) { /* ignore */ }
    window.location.href = '/login.html';
  }

  let sharedFirebaseLoadPromise = null;
  let silentRestorePromise = null;

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.addEventListener('load', () => { s.dataset.loaded = '1'; resolve(); }, { once: true });
      s.addEventListener('error', reject, { once: true });
      document.head.appendChild(s);
    });
  }

  async function ensureFirebaseReady() {
    if (!global.FIREBASE_CONFIG) {
      await loadScriptOnce('/firebase-config.js');
    }
    if (global.firebase && global.FIREBASE_CONFIG && global.FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY') {
      if (!global.firebase.apps.length) global.firebase.initializeApp(global.FIREBASE_CONFIG);
      return true;
    }
    if (!sharedFirebaseLoadPromise) {
      sharedFirebaseLoadPromise = (async () => {
        await loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
        await loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');
        if (global.firebase && global.FIREBASE_CONFIG && global.FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY') {
          if (!global.firebase.apps.length) global.firebase.initializeApp(global.FIREBASE_CONFIG);
          return true;
        }
        return false;
      })().catch(err => {
        sharedFirebaseLoadPromise = null;
        throw err;
      });
    }
    return sharedFirebaseLoadPromise;
  }

  async function waitForFirebaseUser(authInstance, timeoutMs = 2500) {
    if (!authInstance) return null;
    if (authInstance.currentUser) return authInstance.currentUser;
    return new Promise(resolve => {
      let settled = false;
      const done = u => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (typeof unsub === 'function') unsub();
        resolve(u || null);
      };
      const timer = setTimeout(() => done(authInstance.currentUser), timeoutMs);
      const unsub = authInstance.onAuthStateChanged(u => done(u));
    });
  }

  async function exchangeFirebaseUser(fbUser) {
    const idToken = await fbUser.getIdToken();
    const data = await apiRequest('/api/auth/firebase-login', {
      method: 'POST',
      body: JSON.stringify({ idToken })
    });
    if (data.token) localStorage.setItem('mc_token', data.token);
    if (data.user) setCachedUser(data.user, 'google');
    return data.user || null;
  }

  async function trySilentBackgroundRestore({ expectedEmail = '', redirectTo = '' } = {}) {
    if (sessionStorage.getItem('tp_manual_logout') === '1') return null;
    const accounts = getRememberedAccounts();
    const googleAccounts = accounts.filter(a => a.provider === 'google');
    if (!googleAccounts.length && !expectedEmail) return null;

    if (!silentRestorePromise) {
      silentRestorePromise = (async () => {
        try {
          const ready = await ensureFirebaseReady();
          if (!ready || !global.firebase || typeof global.firebase.auth !== 'function') return null;
          const fbUser = await waitForFirebaseUser(global.firebase.auth(), 2500);
          if (!fbUser || !fbUser.email) return null;
          const fbEmail = fbUser.email.toLowerCase();
          const targetEmail = (expectedEmail || '').trim().toLowerCase();
          if (targetEmail && fbEmail !== targetEmail) return null;
          const user = await exchangeFirebaseUser(fbUser);
          if (user && redirectTo) {
            window.location.href = redirectTo;
          }
          return user;
        } catch (e) {
          return null;
        } finally {
          silentRestorePromise = null;
        }
      })();
    }
    return silentRestorePromise;
  }

  async function signInWithGoogleHint(emailHint = '', { redirectTo = '', forceChooser = false, onVerifying = null } = {}) {
    if (typeof onVerifying === 'function') onVerifying();
    const ready = await ensureFirebaseReady();
    if (!ready || !global.firebase || typeof global.firebase.auth !== 'function') {
      throw new Error('Google Sign-In configuration is unavailable.');
    }

    const authInstance = global.firebase.auth();
    const targetEmail = String(emailHint || '').trim().toLowerCase();

    // Returning-user silent background verification: reuse cached Firebase Google user without opening any popup window
    if (!forceChooser) {
      const currentFbUser = await waitForFirebaseUser(authInstance, 2500);
      if (currentFbUser && currentFbUser.email) {
        const fbEmail = currentFbUser.email.toLowerCase();
        const matchesSavedGoogle = targetEmail
          ? fbEmail === targetEmail
          : getRememberedAccounts().some(a => a.provider === 'google' && a.email === fbEmail);
        if (matchesSavedGoogle) {
          try {
            const user = await exchangeFirebaseUser(currentFbUser);
            if (redirectTo) window.location.href = redirectTo;
            return user;
          } catch (silentErr) {
            // Fall through cleanly only if cached Firebase session was revoked
          }
        }
      }
    }

    const provider = new global.firebase.auth.GoogleAuthProvider();
    const customParams = {};
    if (targetEmail && !forceChooser) {
      customParams.login_hint = targetEmail;
    } else {
      customParams.prompt = 'select_account';
    }
    provider.setCustomParameters(customParams);

    try {
      const result = await authInstance.signInWithPopup(provider);
      if (result && result.user) {
        const user = await exchangeFirebaseUser(result.user);
        if (redirectTo) window.location.href = redirectTo;
        return user;
      }
      return null;
    } catch (err) {
      const redirectFallbackCodes = [
        'auth/popup-blocked',
        'auth/cancelled-popup-request',
        'auth/operation-not-supported-in-this-environment'
      ];
      if (err && redirectFallbackCodes.includes(err.code)) {
        sessionStorage.setItem('tp_fb_redirect_pending', '1');
        if (redirectTo) sessionStorage.setItem('tp_fb_redirect_target', redirectTo);
        await authInstance.signInWithRedirect(provider);
        return null;
      }
      throw err;
    }
  }

  function renderAvatarHtml(acc, sizePx = 38, altIndex = 0) {
    const initial = esc((acc.name || acc.email || 'P').trim().charAt(0).toUpperCase());
    if (acc.avatar) {
      return `<span class="tp-onetap-avatar" style="width:${sizePx}px;height:${sizePx}px;font-size:${Math.round(sizePx * 0.44)}px;"><img src="${esc(acc.avatar)}" alt="" referrerpolicy="no-referrer" /></span>`;
    }
    const altCls = altIndex % 2 === 1 ? ' tp-onetap-avatar--alt' : '';
    return `<span class="tp-onetap-avatar${altCls}" style="width:${sizePx}px;height:${sizePx}px;font-size:${Math.round(sizePx * 0.44)}px;">${initial}</span>`;
  }

  function mountReturningPrompt({ activePath = '' } = {}) {
    if (activePath === '/login.html' || window.location.pathname === '/login.html') return;
    if (document.getElementById('tpOneTapPrompt')) return;
    if (sessionStorage.getItem('tp_onetap_dismissed') === '1') return;

    const accounts = getRememberedAccounts();
    if (!accounts.length) return;

    const promptEl = document.createElement('aside');
    promptEl.id = 'tpOneTapPrompt';
    promptEl.className = 'tp-onetap-prompt';
    promptEl.setAttribute('aria-label', 'Returning patient quick sign-in');

    function renderDefaultList(errMsg = '') {
      promptEl.innerHTML = `
        <div class="tp-onetap-head">
          <div class="tp-onetap-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Sign in to The Practitioner</span>
          </div>
          <button type="button" class="tp-onetap-close" id="tpOneTapClose" aria-label="Dismiss quick sign-in suggestion">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="tp-onetap-progress" aria-hidden="true"><div class="tp-onetap-progress__bar"></div></div>
        <div class="tp-onetap-list">
          ${accounts.slice(0, 3).map((acc, idx) => `
            <button type="button" class="tp-onetap-account" data-onetap-email="${esc(acc.email)}">
              ${renderAvatarHtml(acc, 38, idx)}
              <div class="tp-onetap-meta">
                <div class="tp-onetap-name">${esc(acc.name)}</div>
                <div class="tp-onetap-email">${esc(acc.email)}</div>
              </div>
              <span class="tp-onetap-badge">${acc.provider === 'google' ? 'Google' : 'Continue'}</span>
            </button>
          `).join('')}
        </div>
        ${errMsg ? `<div class="tp-onetap-err">${esc(errMsg)}</div>` : ''}
        <div class="tp-onetap-foot">
          <span>Saved on this browser</span>
          <a href="/login.html?other=1" class="tp-onetap-link">Use another account</a>
        </div>
      `;

      promptEl.querySelector('#tpOneTapClose').addEventListener('click', () => {
        sessionStorage.setItem('tp_onetap_dismissed', '1');
        promptEl.remove();
      });

      promptEl.querySelectorAll('[data-onetap-email]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const email = btn.getAttribute('data-onetap-email');
          const acc = accounts.find(a => a.email === email);
          if (!acc) return;

          if (acc.provider !== 'google') {
            window.location.href = `/login.html?email=${encodeURIComponent(acc.email)}&quick=1`;
            return;
          }

          promptEl.innerHTML = `
            <div class="tp-onetap-head">
              <div class="tp-onetap-brand">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Verifying...</span>
              </div>
              <button type="button" class="tp-onetap-close" id="tpOneTapVerifyClose" aria-label="Cancel">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div class="tp-onetap-progress is-active" aria-hidden="true"><div class="tp-onetap-progress__bar"></div></div>
            <div class="tp-onetap-list">
              <div class="tp-onetap-account" style="cursor:default;">
                ${renderAvatarHtml(acc, 38, 0)}
                <div class="tp-onetap-meta">
                  <div class="tp-onetap-name">${esc(acc.name)}</div>
                  <div class="tp-onetap-email">${esc(acc.email)}</div>
                </div>
              </div>
            </div>
          `;
          promptEl.querySelector('#tpOneTapVerifyClose').addEventListener('click', () => {
            sessionStorage.setItem('tp_onetap_dismissed', '1');
            promptEl.remove();
          });

          try {
            const signedInUser = await signInWithGoogleHint(acc.email);
            if (signedInUser) {
              promptEl.remove();
              const slot = document.getElementById('tpHeaderAuthSlot');
              if (slot) {
                slot.innerHTML = `<a href="/dashboard.html" class="tp-btn tp-btn--outline tp-btn--sm" style="padding:8px 16px;">${esc(signedInUser.name.split(' ')[0])} &middot; Portal</a>`;
              }
              showToast(`Welcome back, ${signedInUser.name}!`);
            }
          } catch (err) {
            renderDefaultList(err && err.code === 'auth/popup-closed-by-user'
              ? 'Sign-in popup closed. Click an account to try again.'
              : (err && err.message) || 'Could not complete Google Sign-In.');
          }
        });
      });
    }

    renderDefaultList();
    document.body.appendChild(promptEl);
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

  /** Initialize header/footer immediately from cache + scroll-reveal, then verify auth cleanly. */
  async function mountLayout({ activePath, overlay = false, requireUser = false } = {}) {
    const headerMount = document.getElementById('siteHeader');
    const footerMount = document.getElementById('siteFooter');
    const cachedUser = getCachedUser();

    function paintHeaderFooter(u) {
      if (headerMount && global.PractitionerUI) {
        headerMount.innerHTML = global.PractitionerUI.renderHeader({ activePath, overlay, user: u });
        global.PractitionerUI.initInteractions();
      }
      if (footerMount && global.PractitionerUI) {
        footerMount.innerHTML = global.PractitionerUI.renderFooter();
      }
    }

    // Immediate non-blocking first paint for Header & Footer
    paintHeaderFooter(cachedUser);

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

    if (requireUser) {
      const verifiedUser = await requireAuth();
      if (!verifiedUser) return null;
      if (!cachedUser || cachedUser.id !== verifiedUser.id || cachedUser.name !== verifiedUser.name) {
        paintHeaderFooter(verifiedUser);
      }
      return verifiedUser;
    }

    // Public pages: refresh auth pill asynchronously without blocking page data or render
    if (localStorage.getItem('mc_token') || cachedUser) {
      getCurrentUser().then(async freshUser => {
        if (!freshUser && sessionStorage.getItem('tp_manual_logout') !== '1') {
          freshUser = await trySilentBackgroundRestore();
        }
        if (Boolean(freshUser) !== Boolean(cachedUser) || (freshUser && cachedUser && freshUser.name !== cachedUser.name)) {
          const slot = document.getElementById('tpHeaderAuthSlot');
          if (slot) {
            slot.innerHTML = freshUser
              ? `<a href="/dashboard.html" class="tp-btn tp-btn--outline tp-btn--sm" style="padding:8px 16px;">${esc(freshUser.name.split(' ')[0])} &middot; Portal</a>`
              : `<a href="/login.html" class="tp-btn tp-btn--outline tp-btn--sm" style="padding:8px 16px;">Patient Login</a>`;
          }
        }
        if (!freshUser) {
          mountReturningPrompt({ activePath });
        }
      });
    } else if (sessionStorage.getItem('tp_manual_logout') !== '1' && getRememberedAccounts().some(a => a.provider === 'google')) {
      trySilentBackgroundRestore().then(restored => {
        if (restored) {
          const slot = document.getElementById('tpHeaderAuthSlot');
          if (slot) {
            slot.innerHTML = `<a href="/dashboard.html" class="tp-btn tp-btn--outline tp-btn--sm" style="padding:8px 16px;">${esc(restored.name.split(' ')[0])} &middot; Portal</a>`;
          }
        } else {
          mountReturningPrompt({ activePath });
        }
      });
    } else {
      mountReturningPrompt({ activePath });
    }

    return cachedUser;
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
    getRememberedAccounts,
    rememberAccount,
    clearRememberedAccounts,
    getCachedUser,
    setCachedUser,
    getCurrentUser,
    requireAuth,
    logout,
    ensureFirebaseReady,
    trySilentBackgroundRestore,
    signInWithGoogleHint,
    renderAvatarHtml,
    mountReturningPrompt,
    enrichDepartment,
    addToGoogleCalendar,
    printAppointmentSlip,
    mountLayout,
    renderPortalSubnav
  };
})(window);
