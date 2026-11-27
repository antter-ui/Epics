// public/design-system/components.js
// Reusable UI Components for The Practitioner Reconstruction
(function (global) {
  'use strict';

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const DEFAULT_NAV = [
    {
      label: 'Home',
      href: '/index.html',
      children: [
        { label: 'Clinic Home', href: '/index.html' },
        { label: 'About Us', href: '/about.html' },
        { label: 'Services Overview', href: '/services.html' },
        { label: 'Design System', href: '/design-system/index.html' }
      ]
    },
    {
      label: 'Services',
      href: '/services.html',
      children: [
        { label: 'All Clinical Services', href: '/services.html' },
        { label: 'Medical Departments', href: '/departments.html' }
      ]
    },
    { label: 'Our Doctors', href: '/doctors.html' },
    { label: 'Contact', href: '/contact.html' },
    {
      label: 'Patient Portal',
      href: '/dashboard.html',
      children: [
        { label: 'Patient Dashboard', href: '/dashboard.html' },
        { label: 'Book Appointment', href: '/book.html' },
        { label: 'My Appointments', href: '/appointments.html' },
        { label: 'Patient Profile', href: '/profile.html' },
        { label: 'Sign In / Register', href: '/login.html' }
      ]
    }
  ];

  /** Render reusable primary/outline/link button. */
  function renderButton({
    label,
    variant = 'accent',
    size = 'md',
    href = null,
    type = 'button',
    id = '',
    extraClass = '',
    attrs = ''
  }) {
    const sizeCls = size === 'sm' ? 'tp-btn--sm' : size === 'lg' ? 'tp-btn--lg' : '';
    const cls = `tp-btn tp-btn--${esc(variant)} ${sizeCls} ${esc(extraClass)}`.trim();
    const idAttr = id ? `id="${esc(id)}"` : '';
    if (href) {
      return `<a ${idAttr} href="${esc(href)}" class="${cls}" ${attrs}>${esc(label)}</a>`;
    }
    return `<button ${idAttr} type="${esc(type)}" class="${cls}" ${attrs}>${esc(label)}</button>`;
  }

  /** Render reusable section heading with optional subtitle. */
  function renderSectionHeading({ title, subtitle = '', align = 'left', level = 'h2' }) {
    const alignCls = align === 'center' ? 'tp-section-heading--center' : '';
    const tag = /^h[1-6]$/.test(level) ? level : 'h2';
    return `
      <div class="tp-section-heading ${alignCls}">
        <${tag} class="tp-section-heading__title">${esc(title)}</${tag}>
        ${subtitle ? `<p class="tp-section-heading__subtitle">${esc(subtitle)}</p>` : ''}
      </div>
    `;
  }

  /** Render reusable Header + Top Announcement Bar + Search Modal + Mobile Drawer. */
  function renderHeader({
    announcementText = 'Accepting new patients for in-clinic & online consultations.',
    announcementCta = 'Book a Consultation',
    navItems = DEFAULT_NAV,
    activePath = '/index.html',
    overlay = false,
    bookHref = '/book.html',
    user = null
  } = {}) {
    const navHtml = navItems.map(item => {
      const hasKids = Array.isArray(item.children) && item.children.length > 0;
      const isChildActive = hasKids && item.children.some(c => c.href === activePath);
      const activeCls = (item.href === activePath || isChildActive) ? 'is-active' : '';
      return `
        <li class="tp-nav__item">
          <a href="${esc(item.href)}" class="tp-nav__link ${activeCls}">
            ${esc(item.label)}
            ${hasKids ? '<img src="/assets/icons/chevron-down.svg" alt="" class="tp-nav__chevron" />' : ''}
          </a>
          ${hasKids ? `
            <ul class="tp-nav__dropdown">
              ${item.children.map(c => `<li><a href="${esc(c.href)}" class="tp-nav__dropdown-link">${esc(c.label)}</a></li>`).join('')}
            </ul>
          ` : ''}
        </li>
      `;
    }).join('');

    const drawerNavHtml = navItems.map(item => `
      <li>
        <a href="${esc(item.href)}" class="tp-drawer__nav-link" data-drawer-close>
          <span>${esc(item.label)}</span>
          <img src="/assets/icons/arrow-right.svg" alt="" width="16" height="16" />
        </a>
      </li>
    `).join('');

    const authPillHtml = user
      ? `<a href="/dashboard.html" class="tp-btn tp-btn--outline tp-btn--sm" style="padding:8px 16px;">${esc(user.name.split(' ')[0])} &middot; Portal</a>`
      : `<a href="/login.html" class="tp-btn tp-btn--outline tp-btn--sm" style="padding:8px 16px;">Patient Login</a>`;

    return `
      <div class="tp-topbar">
        <div class="tp-topbar__inner">
          <span>${esc(announcementText)}</span>
          <a href="${esc(bookHref)}" class="tp-topbar__cta">
            <span>${esc(announcementCta)}</span>
            <img src="/assets/icons/arrow-right.svg" alt="" width="16" height="16" style="filter: brightness(0) saturate(100%) invert(86%) sepia(23%) saturate(789%) hue-rotate(25deg) brightness(93%) contrast(88%);" />
          </a>
        </div>
      </div>

      <header class="tp-header ${overlay ? 'tp-header--overlay' : ''}" id="tpMainHeader">
        <div class="tp-header__inner">
          <a href="/index.html" class="tp-logo" aria-label="The Practitioner Home">
            <img src="/assets/logos/logo-practitioner-dark.svg" alt="The Practitioner" width="165" height="56" />
          </a>

          <nav class="tp-nav" aria-label="Primary Navigation">
            <ul class="tp-nav__list">${navHtml}</ul>
          </nav>

          <div class="tp-header__actions">
            <button type="button" class="tp-icon-btn" id="tpSearchTrigger" aria-label="Open search">
              <img src="/assets/icons/search.svg" alt="" width="18" height="18" />
            </button>
            <div class="tp-header__desktop-cta" style="display:flex; align-items:center; gap:10px;">
              <span id="tpHeaderAuthSlot">${authPillHtml}</span>
              ${renderButton({ label: 'Book Visit', variant: 'accent', size: 'sm', href: bookHref })}
            </div>
            <button type="button" class="tp-icon-btn tp-hamburger" id="tpDrawerTrigger" aria-label="Open menu">
              <img src="/assets/icons/menu.svg" alt="" width="20" height="20" />
            </button>
          </div>
        </div>
      </header>

      <div class="tp-backdrop" id="tpBackdrop"></div>
      <aside class="tp-drawer" id="tpDrawer" aria-hidden="true" aria-label="Navigation & Quick Links">
        <div class="tp-drawer__header">
          <img src="/assets/logos/logo-practitioner-dark.svg" alt="The Practitioner" width="140" height="47" />
          <button type="button" class="tp-icon-btn" id="tpDrawerClose" aria-label="Close drawer">
            <img src="/assets/icons/close.svg" alt="" width="18" height="18" />
          </button>
        </div>
        <div class="tp-drawer__body">
          <ul class="tp-drawer__nav">${drawerNavHtml}</ul>
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${renderButton({ label: 'Book a Consultation', variant: 'accent', size: 'md', href: bookHref, extraClass: 'tp-btn--full' })}
            ${renderButton({ label: user ? 'Open Patient Portal' : 'Patient Sign In', variant: 'outline', size: 'md', href: user ? '/dashboard.html' : '/login.html', extraClass: 'tp-btn--full' })}
          </div>
          <div id="tpDrawerExtra" style="margin-top:24px;"></div>
        </div>
      </aside>

      <div class="tp-search-modal" id="tpSearchModal" aria-hidden="true">
        <button type="button" class="tp-search-modal__close" id="tpSearchClose" aria-label="Close search">
          <img src="/assets/icons/close.svg" alt="" width="20" height="20" style="filter: invert(1);" />
        </button>
        <div class="tp-search-modal__box">
          <form class="tp-search-modal__form" id="tpSearchForm" onsubmit="event.preventDefault(); const q=this.querySelector('input').value.trim(); if(q) window.location.href='/doctors.html?q='+encodeURIComponent(q);">
            <input type="search" class="tp-search-modal__input" placeholder="Search doctors, departments, symptoms..." aria-label="Search" />
            <button type="submit" class="tp-icon-btn" aria-label="Submit search">
              <img src="/assets/icons/search.svg" alt="" width="18" height="18" />
            </button>
          </form>
        </div>
      </div>
    `;
  }

  /** Render reusable Deep Navy Footer matching reference 4-column structure. */
  function renderFooter({ year = new Date().getFullYear() } = {}) {
    return `
      <footer class="tp-footer">
        <div class="tp-footer__grid">
          <div>
            <h3 class="tp-footer__title">Company</h3>
            <ul class="tp-footer__links">
              <li><a href="/about.html">About Us</a></li>
              <li><a href="/doctors.html">Our Doctors</a></li>
              <li><a href="/contact.html">Contact Us</a></li>
              <li><a href="/dashboard.html">Patient Portal</a></li>
            </ul>
          </div>
          <div>
            <h3 class="tp-footer__title">Our Services</h3>
            <ul class="tp-footer__links">
              <li><a href="/departments.html">Medical Departments</a></li>
              <li><a href="/services.html">Clinical Services</a></li>
              <li><a href="/doctors.html">Find a Specialist</a></li>
              <li><a href="/book.html">Online Consultations</a></li>
            </ul>
          </div>
          <div>
            <h3 class="tp-footer__title">Help</h3>
            <ul class="tp-footer__links">
              <li><a href="/book.html">Book an Appointment</a></li>
              <li><a href="/appointments.html">My Appointments</a></li>
              <li><a href="/profile.html">Patient Profile</a></li>
              <li><a href="/about.html#faq">Patient FAQs</a></li>
            </ul>
          </div>
          <div>
            <h3 class="tp-footer__title">Subscribe to Stay Inspired!</h3>
            <p style="font-size:16px; color:rgba(255,255,255,0.75); margin-bottom:12px;">
              Receive preventive wellness tips and seasonal clinic updates.
            </p>
            <form class="tp-newsletter" onsubmit="event.preventDefault(); this.querySelector('.tp-newsletter__msg').hidden=false; this.reset();">
              <input type="email" class="tp-newsletter__input" placeholder="Your email address*" required aria-label="Email address" />
              ${renderButton({ label: 'Subscribe', variant: 'accent', size: 'sm', type: 'submit' })}
              <div class="tp-newsletter__msg" hidden style="width:100%; font-size:14px; color:var(--tp-color-accent); margin-top:6px;">
                Thank you for subscribing to our wellness newsletter.
              </div>
            </form>
            <div class="tp-social-row" aria-label="Clinic Channels">
              <button type="button" class="tp-social-link" style="background:transparent; cursor:pointer;" aria-label="Facebook Clinic Updates" onclick="window.PortalCore && window.PortalCore.showToast ? window.PortalCore.showToast('Follow @thepractitioner.clinic on Facebook.', 'success') : null"><img src="/assets/icons/social-facebook.svg" alt="" width="16" height="16" /></button>
              <button type="button" class="tp-social-link" style="background:transparent; cursor:pointer;" aria-label="X Clinic Updates" onclick="window.PortalCore && window.PortalCore.showToast ? window.PortalCore.showToast('Follow @thepractitioner on X.', 'success') : null"><img src="/assets/icons/social-x.svg" alt="" width="16" height="16" /></button>
              <button type="button" class="tp-social-link" style="background:transparent; cursor:pointer;" aria-label="YouTube Health Talks" onclick="window.PortalCore && window.PortalCore.showToast ? window.PortalCore.showToast('Visit The Practitioner Medical Health Talks on YouTube.', 'success') : null"><img src="/assets/icons/social-youtube.svg" alt="" width="16" height="16" /></button>
              <button type="button" class="tp-social-link" style="background:transparent; cursor:pointer;" aria-label="Instagram Wellness Tips" onclick="window.PortalCore && window.PortalCore.showToast ? window.PortalCore.showToast('Follow @dr_martin on Instagram.', 'success') : null"><img src="/assets/icons/social-instagram.svg" alt="" width="16" height="16" /></button>
            </div>
          </div>
        </div>
        <div class="tp-footer__bottom">
          <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
            <img src="/assets/logos/logo-practitioner-light.svg" alt="The Practitioner" width="132" height="45" />
            <span>&copy; ${esc(year)} The Practitioner Medical Clinic. All Rights Reserved.</span>
          </div>
          <span>Encrypted Patient Scheduling Portal</span>
        </div>
      </footer>
    `;
  }

  /** Render reusable Service Card (matches 768x456 landscape ratio + excerpt + CTA). */
  function renderServiceCard(service, { ctaLabel = 'Book Department', onSelect = '' } = {}) {
    const imgUrl = service.image || 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=768&h=456&fit=crop';
    const actionAttr = onSelect ? `onclick="${esc(onSelect)}"` : '';
    return `
      <article class="tp-service-card">
        <div class="tp-service-card__media">
          <img src="${esc(imgUrl)}" alt="${esc(service.name)}" loading="lazy" />
        </div>
        <div class="tp-service-card__body">
          ${service.tagline ? `<span class="tp-service-card__tag">${esc(service.tagline)}</span>` : ''}
          <h3 class="tp-service-card__title">${esc(service.name)}</h3>
          <p class="tp-service-card__excerpt">${esc(service.description)}</p>
          <div>
            ${renderButton({ label: ctaLabel, variant: 'link', size: 'sm', attrs: actionAttr })}
          </div>
        </div>
      </article>
    `;
  }

  /** Render reusable Doctor Profile Card (matches 768x768 square portrait + credentials + availability + CTA). */
  function renderDoctorCard(doc, { ctaLabel = 'Book Consultation', onBook = '' } = {}) {
    const avatar = (doc.avatar || '').replace('w=300&h=300', 'w=768&h=768');
    const actionAttr = onBook ? `onclick="${esc(onBook)}"` : '';
    return `
      <article class="tp-doctor-card">
        <div class="tp-doctor-card__media">
          <img src="${esc(avatar)}" alt="${esc(doc.name)}" loading="lazy" />
          ${doc.consultation_fee ? `<span class="tp-doctor-card__fee-badge">\$${esc(doc.consultation_fee)} / visit</span>` : ''}
        </div>
        <div class="tp-doctor-card__body">
          ${doc.department_name ? `<span class="tp-doctor-card__dept">${esc(doc.department_name)}</span>` : ''}
          <h3 class="tp-doctor-card__name">${esc(doc.name)}</h3>
          <div class="tp-doctor-card__qual">${esc(doc.qualification || doc.title)}</div>
          <p class="tp-doctor-card__bio">${esc(doc.bio)}</p>
          ${doc.available_days ? `<div style="font-size:14px; color:var(--tp-color-primary); margin-bottom:12px;"><strong>Availability:</strong> ${esc(doc.available_days)}</div>` : ''}
          <div class="tp-doctor-card__meta">
            <span>★ ${esc(doc.rating)} (${esc(doc.reviews_count)} reviews)</span>
            <span>${esc(doc.experience_years)} yrs exp</span>
          </div>
          ${renderButton({ label: ctaLabel, variant: 'accent', size: 'sm', extraClass: 'tp-btn--full', attrs: actionAttr })}
        </div>
      </article>
    `;
  }

  /** Render reusable Appointment Booking Form shell (binds cleanly to /api/availability & /api/appointments). */
  function renderAppointmentForm({
    formId = 'tpBookingForm',
    departments = [],
    doctors = [],
    patientName = '',
    patientEmail = '',
    minDate = new Date().toISOString().split('T')[0],
    submitLabel = 'Confirm Appointment'
  } = {}) {
    const deptOpts = departments.map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('');
    const docOpts = doctors.map(doc => `<option value="${esc(doc.id)}" data-dept="${esc(doc.department_id)}">${esc(doc.name)} (${esc(doc.department_name || '')})</option>`).join('');

    return `
      <form id="${esc(formId)}" class="tp-appointment-form">
        <div class="tp-form-grid">
          <div class="tp-field">
            <label class="tp-label" for="${esc(formId)}-name">Full Name <span class="tp-label__req">*</span></label>
            <input id="${esc(formId)}-name" name="patientName" type="text" class="tp-input" value="${esc(patientName)}" placeholder="Your full name" required />
          </div>
          <div class="tp-field">
            <label class="tp-label" for="${esc(formId)}-email">Email Address <span class="tp-label__req">*</span></label>
            <input id="${esc(formId)}-email" name="patientEmail" type="email" class="tp-input" value="${esc(patientEmail)}" placeholder="name@example.com" required />
          </div>
          <div class="tp-field">
            <label class="tp-label" for="${esc(formId)}-phone">Phone Number</label>
            <input id="${esc(formId)}-phone" name="patientPhone" type="tel" class="tp-input" placeholder="+1 (555) 000-0000" />
          </div>
          <div class="tp-field">
            <label class="tp-label" for="${esc(formId)}-dept">Department <span class="tp-label__req">*</span></label>
            <select id="${esc(formId)}-dept" name="departmentId" class="tp-select" required>
              <option value="">Select medical department</option>
              ${deptOpts}
            </select>
          </div>
          <div class="tp-field">
            <label class="tp-label" for="${esc(formId)}-doctor">Specialist Doctor <span class="tp-label__req">*</span></label>
            <select id="${esc(formId)}-doctor" name="doctorId" class="tp-select" required>
              <option value="">Select specialist</option>
              ${docOpts}
            </select>
          </div>
          <div class="tp-field">
            <label class="tp-label" for="${esc(formId)}-date">Preferred Date <span class="tp-label__req">*</span></label>
            <input id="${esc(formId)}-date" name="appointmentDate" type="date" class="tp-input" min="${esc(minDate)}" value="${esc(minDate)}" required />
          </div>
          <div class="tp-field tp-field--full">
            <span class="tp-label">Available Time Slots <span class="tp-label__req">*</span></span>
            <div class="tp-slot-grid" data-slot-container>
              <button type="button" class="tp-slot-btn" data-slot="09:00 AM">09:00 AM</button>
              <button type="button" class="tp-slot-btn" data-slot="10:30 AM">10:30 AM</button>
              <button type="button" class="tp-slot-btn" data-slot="02:00 PM">02:00 PM</button>
              <button type="button" class="tp-slot-btn" data-slot="03:30 PM">03:30 PM</button>
            </div>
          </div>
          <div class="tp-field tp-field--full">
            <label class="tp-label" for="${esc(formId)}-issue">Primary Health Concern <span class="tp-label__req">*</span></label>
            <input id="${esc(formId)}-issue" name="medicalIssue" type="text" class="tp-input" placeholder="e.g., Routine cardiac screening, skin rash, migraine" required />
          </div>
          <div class="tp-field tp-field--full">
            <label class="tp-label" for="${esc(formId)}-notes">Additional Symptoms or Notes</label>
            <textarea id="${esc(formId)}-notes" name="description" class="tp-textarea" placeholder="Duration of symptoms, current medications, or questions for the doctor..."></textarea>
          </div>
          <div class="tp-field tp-field--full">
            ${renderButton({ label: submitLabel, variant: 'accent', size: 'lg', type: 'submit', extraClass: 'tp-btn--full' })}
          </div>
        </div>
      </form>
    `;
  }

  /** Wire interactive header, drawer, search modal, and scroll behavior. */
  function initInteractions() {
    const header = document.getElementById('tpMainHeader');
    const drawer = document.getElementById('tpDrawer');
    const backdrop = document.getElementById('tpBackdrop');
    const drawerTrigger = document.getElementById('tpDrawerTrigger');
    const drawerClose = document.getElementById('tpDrawerClose');
    const searchModal = document.getElementById('tpSearchModal');
    const searchTrigger = document.getElementById('tpSearchTrigger');
    const searchClose = document.getElementById('tpSearchClose');

    function closeAllOverlays() {
      if (drawer) {
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
      }
      if (backdrop) backdrop.classList.remove('is-open');
      if (searchModal) {
        searchModal.classList.remove('is-open');
        searchModal.setAttribute('aria-hidden', 'true');
      }
    }

    function openDrawer() {
      if (drawer && backdrop) {
        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        backdrop.classList.add('is-open');
      }
    }

    function openSearch() {
      if (searchModal) {
        searchModal.classList.add('is-open');
        searchModal.setAttribute('aria-hidden', 'false');
        const input = searchModal.querySelector('input');
        if (input) setTimeout(() => input.focus(), 60);
      }
    }

    if (drawerTrigger) drawerTrigger.addEventListener('click', openDrawer);
    if (drawerClose) drawerClose.addEventListener('click', closeAllOverlays);
    if (backdrop) backdrop.addEventListener('click', closeAllOverlays);
    if (searchTrigger) searchTrigger.addEventListener('click', openSearch);
    if (searchClose) searchClose.addEventListener('click', closeAllOverlays);

    document.querySelectorAll('[data-drawer-close]').forEach(el => {
      el.addEventListener('click', closeAllOverlays);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAllOverlays();
    });

    if (header) {
      const onScroll = () => {
        header.classList.toggle('tp-header--scrolled', window.scrollY > 24);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    return { openDrawer, openSearch, closeAllOverlays };
  }

  global.PractitionerUI = {
    renderButton,
    renderSectionHeading,
    renderHeader,
    renderFooter,
    renderServiceCard,
    renderDoctorCard,
    renderAppointmentForm,
    initInteractions,
    openBookingDrawer() {
      const drawer = document.getElementById('tpDrawer');
      const backdrop = document.getElementById('tpBackdrop');
      if (drawer && backdrop) {
        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        backdrop.classList.add('is-open');
      }
    }
  };
})(window);
