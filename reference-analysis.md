# Reference Website Analysis & Technical Implementation Plan

**Project:** The Practitioner – Medical Website Reconstruction & Patient Appointment-Booking Application  
**Reference ThemeForest URL:** `https://preview.themeforest.net/item/the-practitioner-doctor-and-medical-wordpress-theme/full_screen_preview/37693974`  
**Underlying Public Demo Origin:** `https://the-practitioner.cmsmasters.studio/` (Theme: *The Practitioner* v1.2.3 by CMSMasters)  
**Primary Medical Reconstruction Targets:**  
- **Private Medical Clinic Demo:** `https://the-practitioner.cmsmasters.studio/main/home-clinic/`  
- **Practitioner / Doctor Main Demo:** `https://the-practitioner.cmsmasters.studio/main/`  
- **Key Subpages:** `/main/about-me/`, `/main/services/`, `/main/book-a-consultation/`, `/main/contacts/`

> **Inspection Method Note:** Measurements below were extracted directly from the publicly accessible HTML pages and compiled Elementor/theme CSS stylesheets (`post-43c1f9.css`, `post-40ce32.css`, `post-4668ca1.css`, `post-364c1f9.css`, `post-100598ca1.css`, `default-vars.min8a54.css`) mirrored via HTTrack from `https://the-practitioner.cmsmasters.studio/`. Live Chrome DevTools runtime computed-box inspection was unavailable in this session because the Chrome DevTools MCP server was not connected; rendered pixel heights where not fixed by CSS `min-height` are marked as stylesheet-derived (`padding` + content).

---

## 1. Existing Project Audit (`c:\epics`)

Before planning the reconstruction, the current **MediCare Connect** codebase was inspected:
- **Server (`server/server.js`):** Zero-dependency Node.js HTTP server (`PORT` default `3000`) serving `public/` static files and dispatching `/api/*` requests.
- **Database (`server/db.js`):** Native `node:sqlite` (`DatabaseSync` in WAL mode) at `data/healthcare.db` with 5 tables:
  - `users` (supports hashed email/password via `scryptSync` and Google OAuth `google_id`)
  - `sessions` (7-day bearer/cookie tokens `mc_session`)
  - `departments` (6 seeded departments: Cardiology, Dermatology, Orthopedics, General Medicine, Neurology, Pediatrics)
  - `doctors` (12 seeded doctors with qualifications, experience, ratings, room numbers, consultation fees, bios, and available days)
  - `appointments` (slot collision checking against `ALL_TIME_SLOTS`, reference codes `MED-2026-XXXX`, status tracking, cancellation reasons)
- **API (`server/routes.js`, `server/auth.js`):** Public endpoints (`/api/health`, `/api/departments`, `/api/doctors`, `/api/doctors/:id`, `/api/availability?doctorId=&date=`) and authenticated endpoints (`/api/auth/register`, `/api/auth/login`, `/api/auth/google`, `/api/auth/firebase-login`, `/api/auth/me`, `/api/auth/logout`, `/api/stats`, `/api/appointments`, `/api/appointments/:id`, `/api/appointments/:id/cancel`).
- **Frontend (`public/`):** Currently a SaaS-style medical dashboard (`index.html`, `app.js`, `styles.css`, `login.html`, `firebase-config.js`) using blue `#0369a1` / emerald `#047857` and `Montserrat`.
- **Verification (`test-server.js`):** 13+ automated HTTP API tests covering auth, availability, booking, and collision prevention.

---

## 2. Phase 1A — Visual Design System Analysis

### 2.1 Color Palette (Extracted from `post-43c1f9.css` & `default-vars.min8a54.css`)

| Token Name | Hex Value | Role in Reference Design |
|---|---|---|
| `--e-global-color-primary` | `#527359` | Sage Forest Green — top announcement bar bg, primary headings/links/accents, button hover bg, table headers |
| `--e-global-color-secondary` | `#333133` | Deep Charcoal — main headings (`H1`–`H6`), dark logo wordmark, active/input text |
| `--e-global-color-text` | `#5A595A` | Neutral Slate Gray — body paragraphs, labels, secondary copy |
| `--e-global-color-accent` | `#BED173` | Pistachio / Soft Lime — primary CTA buttons (`#BED173` normal bg in `/main/`), top-bar highlight link, footer headings |
| `--e-global-color-tertiary` | `#989898` | Muted Warm Gray — metadata, post dates, subtitle wordmark, link hover muted state |
| `--e-global-color-background` | `#FFFFFF` | Pure White — page canvas, card surfaces, button text on filled buttons, input backgrounds |
| `--e-global-color-alternate` | `#FAF5F0` | Warm Cream / Alabaster — alternating section backgrounds, hero organic backdrop, table footers |
| `--e-global-color-border` | `#E1DFDB` | Warm Stone — `1px` card borders, form input borders, dividers, decorative curve lines |
| `--e-global-color-44bbd74` | `#EC9F57` | Warm Apricot / Amber — top-bar CTA hover, pre-footer Instagram strip/accents, highlight badges |
| `--e-global-color-fff825f` | `#88ABDA` | Soft Sky Blue — secondary decorative accents and icon highlights |
| `--e-global-color-b38bcd3` | `#08263F` | Deep Navy — main footer background (`#08263F`), dark CTA banner surface |

*(Note: On the showcase landing kit `post-40ce32.css`, buttons use `#527359` normal bg / transparent hover with `#E1DFDB` border; on the `/main/` & `/main/home-clinic/` kit `post-43c1f9.css`, buttons default to `--e-global-color-accent` `#BED173` normal bg with white text and transition to `--e-global-color-primary` `#527359` on hover.)*

### 2.2 Typography System (`post-43c1f9.css`)

- **Primary Font Family:** `"Outfit"` (loaded as `"Outfit Local"` in reference; open-source Google Font `Outfit`, weights `300`, `400`, `500`)
- **Editorial Accent Serif:** `"Radley"` (loaded as `"Radley Local"` italic in reference; open-source Google Font `Radley`, italic `400`)

| Element / Role | Font Family | Desktop Size (`>1024px`) | Tablet Size (`<=1024px`) | Mobile Size (`<=767px`) | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|---|---|
| **H1 (Display / Hero)** | Outfit | `82px` | `64px` | `46px` (kit) / `44px` (landing) | `400` | `1.07em` | `-2px` |
| **H2 (Section Title)** | Outfit | `58px` | `48px` | `38px` | `400` | `1.14em` | `-1px` |
| **H3 (Sub-section / Banner)** | Outfit | `46px` | `38px` | `30px` | `400` | `1.18em` | `-1px` |
| **H4 (Card / Block Title)** | Outfit | `34px` | `28px` | `24px` | `400` | `1.24em` | `0px` |
| **H5 (Small Card / Table Head)** | Outfit | `24px` | `20px` | `18px` | `400` | `1.3em` | `0px` |
| **H6 (Cite / Micro Heading)** | Outfit | `18px` | `17px` | `16px` | `400` | `1.33em` | `0px` |
| **Body Text** | Outfit | `19px` | `18px` | `17px` | `300` | `1.58em` | `0px` |
| **Accent / Lead Text** | Outfit | `18px` | `17px` | `16px` | `400` | `1.66em` | `0px` |
| **Tertiary / Small Text** | Outfit | `16px`–`17px` | `15px`–`16px` | `14px`–`15px` | `300` | `1.4em`–`1.74em` | `0px` |
| **Taxonomy / Eyebrow Tag** | Outfit | `13px` | `13px` | `12px` | `500` | `1.7em` | `1px` (`UPPERCASE`) |
| **Meta Text** | Outfit | `16px` | `15px` | `14px` | `300` | `1.32em` | `0px` |
| **Buttons** | Outfit | `18px` | `17px` | `16px` | `500` | `1.44em` | `0px` |
| **Blockquote** | Radley (Italic) | `28px` | `26px` | `24px` | `400` (`italic`) | `1.36em` | `0px` |
| **Footer Column Title / Editorial Accent** | Radley (Italic) | `24px` | `22px` | `20px` | `400` (`italic`) | `1.33em` | `0px` |

### 2.3 Containers, Spacing, Buttons, Borders & Shadows

- **Container Widths (`post-43c1f9.css`):**
  - Boxed Elementor Section Max Width: `1320px` (desktop), `1024px` (tablet `<=1024px`), `767px` (mobile `<=767px`).
  - Global Content Width: `1240px` (`--cmsmasters-global-content-padding-left/right: 30px` desktop/tablet, `20px` mobile).
  - Main Content Wrapper Max Width: `1340px`.
- **Section Vertical Spacing:**
  - Alternating section padding: `80px 20px` to `130px 20px 100px 20px` on desktop; `70px–90px` on tablet; `60px–70px` on mobile.
  - Hero top padding: `160px 20px 0px 20px` desktop (`185px` tablet, `180px` mobile) to accommodate the negative-margin transparent header overlay (`margin-bottom: -140px`).
- **Header Dimensions (`post-4668ca1.css`):**
  - Top Announcement Bar: full-width `#527359` background, `0px 20px` side padding, centered flex row (`17px` light text + `18px` `#BED173` CTA link).
  - Main Navigation Bar: `min-height: 88px`, transparent background (`#FFFFFF00`) layered over top of hero (`z-index: 999`, `margin-bottom: -140px`), `padding: 0 15px`.
- **Footer Dimensions (`post-364c1f9.css`):**
  - Pre-footer Instagram Strip: `Follow @dr_martin on Instagram` + 6-image square grid (`1080x1080` source aspect `1:1`) + warm apricot `#EC9F57` (`--e-global-color-44bbd74`) accent block (`padding: 20px`, inner gap `20px`/`30px`).
  - Main Footer (`#08263F`): `padding: 80px 20px 20px 20px`, 4-column link/newsletter grid (`Company`, `Our Services`, `Help`, `Subscribe to Stay Inspired!`) + bottom legal & social bar.
- **Buttons:**
  - Primary Button (`/main/`): `padding: 17px 45px`, `border-radius: 5px`, `background: #BED173` (`--e-global-color-accent`), `color: #FFFFFF`, `border: none`; hover shifts smoothly (`transition: all 0.3s`) to `background: #527359` (`--e-global-color-primary`).
  - Outline / Alternate Button (landing/secondary): `padding: 20px 40px`, `border-radius: 5px`, `border: 1px solid #527359` or `#E1DFDB`.
- **Form Inputs:**
  - `background: #FFFFFF`, `color: #333133`, `border: 1px solid #E1DFDB`, `border-radius: 5px`, `padding: 12px 16px`, focus border `#BED173`, placeholder `#E1DFDB` (note: for WCAG accessibility on our app, we will darken placeholder/helper text slightly while keeping the warm stone border `#E1DFDB`).
- **Cards, Image Masks & Shadows (`post-100598ca1.css`):**
  - Bordered Content Cards: `background: #FFFFFF`, `border: 1px solid #E1DFDB`, `border-radius: 20px`, `padding: 30px`.
  - Feature / Image Radiuses observed: `5px`, `10px`, `15px`, `20px`, `50px`, `80px`, organic leaf mask `40% 0% 40% 0%`, asymmetric pill mask `300px 0px 0px 300px`.
  - Shadows: The theme relies heavily on **flat editorial layering (`1px solid #E1DFDB` borders + `#FAF5F0` vs `#FFFFFF` tonal contrast + organic SVG/PNG shapes)** rather than heavy drop-shadows (`box-shadow` rules were absent in the inspected `post-364`, `post-466`, and `post-10059` stylesheets).
- **Icons:**
  - UI & Social Icons: Font Awesome 5/6 (`fas fa-angle-down`, `fas fa-bars`, `fas fa-times`, `fas fa-phone-alt`, `far fa-clock`, `far fa-file-alt`, `fab fa-facebook-f`, `fab fa-x-twitter`, `fab fa-youtube`, `fab fa-instagram`).
  - Custom Theme Icons (`cmsmasters-demo-icons`): Search, directional arrow, approved/verified checkmark, mobile/feature glyphs.

---

## 3. Phase 1B — Layout & Multi-Page Structure Analysis

### 3.1 Global Chrome (Shared Across All Pages)
1. **Top Announcement Bar:** `#527359` full-width strip with brief callout text + `"Book a Consultation"` trigger (opens the slide-over consultation booking drawer).
2. **Primary Navigation Header (`min-height: 88px`):**
   - Left: Brand SVG logo (`logo-main.svg` `165x56` or `logo-clinic-1.svg`).
   - Center: Horizontal nav links (`Home` dropdown with 6 demo variants, `Services` dropdown with 4 featured services + View All, `Courses` dropdown, `About Me`, `Blog Page`, `Contacts`, `Shop`).
   - Right: Search modal trigger icon + Off-canvas consultation/menu trigger button.

### 3.2 Homepage Variant A — Private Medical Clinic (`/main/home-clinic/`) — Primary Target for Medical Clinic Reconstruction
Top-to-bottom section sequence:
1. **Hero Section (`padding-top: 160px`):** Full-width warm editorial hero with `H1`: *"Comprehensive Nutrition & Dietetics Clinic"*, supporting copy, primary CTA (`"Find Out More"` / `"Book Consultation"`), clinic photo (`home-clinic-3.jpg` `820x380` / `home-clinic-4.jpg` `620x680`) framed by layered organic PNG/SVG blobs (`618x528`, `156x202`, `102x102`).
2. **Services Grid (`"Our Diet & Nutrition Services"`):** 3-column desktop grid (`column-gap: 80px`, `row-gap: 80px`) of 6 medical service cards (`768x456` / ~16:9.5 landscape images + title + `"Read More"` button).
3. **Interactive Symptom / Care Tabs Section:** Vertical tab switcher on desktop (`Hot Flushes`, `Night Sweats`, `Mood Changes`, `All This and More`) switching 4 rich content panels (`H4` heading + clinical overview + `"Start Online Visit"` CTA), collapsing to horizontal tabs at `<=1024px`.
4. **Clinic Gallery / Philosophy Split Section:** Asymmetric media + narrative block with `"How We Help"` CTA and organic background accents.
5. **Interactive BMI Calculator & Appointment / Consultation Section:** Two-column block pairing `"Calculate Your BMI"` + `"BMI Calculator Chart"` reference table with embedded Forminator appointment/consultation booking form (`forminator-module-39`).
6. **Doctor Team Carousel:** 3-column Swiper carousel (`768x768` square doctor portraits for `Dr. Joanna Sharp`, `Dr. Hallie Albert`, `Dr. Rod Baber`), specialty titles, and individual `"Book Consultation"` buttons (`slider_per_view: 3` desktop, `2` tablet, `1` mobile; `60px` gap).
7. **Journal / Health Articles Strip:** Editorial post cards (`"Read More"`).
8. **Pre-Footer Instagram Feed + Deep Navy `#08263F` Footer:** 6 square posts (`@dr_martin`), 4-column footer (`Company`, `Our Services`, `Help`, `Subscribe to Stay Inspired!` email form), social icon row, copyright.

### 3.3 Homepage Variant B — Personal Practitioner (`/main/`)
1. **Hero:** `H1` *"Natural Healing, Simplified"* + `"Book Now"` & `"Start Here"` buttons + portrait (`725x752`, `~1:1.04`) with floating organic shapes & curved `327x369` connector line.
2. **Doctor Intro (`min-height: 700px`):** *"Hi! I'm Dr. Serena Martin..."* + portrait (`630x698`) + `"Find Out More"` CTA.
3. **My Practice / Conditions Cards:** Bordered `20px`-radius cards (`padding: 30px`, `1px solid #E1DFDB`).
4. **Why Choose Dr. Serena Martin? + Testimonial Quote (`Radley` italic 28px):** Patient portrait (`640x640`) + quote + circular `150x150` reviewer avatars.
5. **A Better Approach to Health (`min-height: 805px`):** Full-bleed split section (`padding: 0 80px`) + `"Find the Cause"` / `"View Services"` CTAs.
6. **5-Minute Video Introduction (`min-height: 640px`):** Video preview card (`951x536`, 16:9) with YouTube play trigger.
7. **Courses / Podcast / Blog (`2`-column grid, `60px` col-gap, `40px` row-gap)** + `"More Podcasts"` AJAX load-more button.
8. **Shop Category Strip (`min-height: 400px`):** 4 category cards (`Supplements`, `Vitamins`, `Books`, `Other Essentials`) + `"To the Shop"` CTA.
9. **Take the First Step (`min-height: 630px`):** High-impact bottom conversion banner (`"Book a Consultation"`).

### 3.4 Key Subpages Inspected
- **`/main/about-me/`:** Intro bio + wide banner (`1280x660`) -> `Personal Story` + `Radley` italic pullquote -> `Formal Training` -> `A Different Approach to Eating Well` (`560x601` + `561x680` asymmetric images) -> `Doctor is here to help` CTA -> `Read the Blog` (3-card row) -> `Frequently asked questions` accordion (`cmsmasters-toggles`).
- **`/main/services/`:** Page header (`Services`) -> Feature highlight (`680x580`) + `H4` problem-framing statement -> 9-card Services grid (`768x456` thumbnails, 3 columns desktop).
- **`/main/book-a-consultation/`:** Page header (`Book a Consultation`) -> 2-column layout pairing portrait (`768x880`) + decorative shapes with Forminator booking form (`forminator-module-37`).
- **`/main/contacts/`:** Page header (`Contacts`) -> `Contact Information` + `Contact Us` split with clinic photos (`680x760`, `590x740`), phone/location icon-list blocks, and Forminator contact/booking forms (`37`, `40`).

---

## 4. Phase 1C — Interaction & Animation Analysis

Observed directly in Elementor `data-settings` and CSS rules:
1. **Navigation Dropdowns:** Horizontal desktop menu (`layout: "horizontal"`, `dropdown_horizontal_distance: 10px`) with hover/focus submenus (`Home`, `Services`, `Courses`). Collapses at `<=1024px` (`dropdown_breakpoints: "tablet"`).
2. **Search Modal Popup:** Clicking the header search icon opens a full-screen search overlay (`type_of_search: "search-popup"`, closes via `Esc` or close icon hover `#BED173`).
3. **Right Off-Canvas Drawer:** Slides in from the right (`canvas_position: "right"`, `animation_type: "slide"`, `overlay_close: "yes"`, `esc_close: "yes"`) containing mobile navigation AND the quick `"Book a Consultation"` form block.
4. **Button & Link Hover States:** Smooth `0.3s` transitions (`#BED173` -> `#527359` on primary buttons; `#FFFFFF` -> `#BED173` on footer links; `#BED173` -> `#EC9F57` on top-bar CTA; social icon inversion `#08263F` on `#FFFFFF` pill hover).
5. **Scroll Parallax & 3D Tilt:** Decorative organic shapes move subtly on scroll (`cms_scroll_effects` vertical/horizontal speed `0.4`–`4px`) and respond to desktop cursor tilt (`cms_tilt_shift: 0.1`–`0.5px`), plus slow rotation (`0deg` to `30deg` over `1.5s`).
6. **Entrance Animations:** `fadeIn`, `fadeInUp`, `fadeInLeft`, `fadeInRight`, `slideInUp`, `slideInDown` with staggered delays (`200ms`, `300ms`, `400ms`, `600ms`) — automatically disabled on mobile (`_animation_mobile: "none"`).
7. **Interactive Tabs (`home-clinic`):** Vertical 4-tab switcher on desktop converting to horizontal tabs on tablet/mobile.
8. **Doctor Team Swiper Carousel (`home-clinic`):** Infinite horizontal slide carousel (`speed: 500ms`, `autoplay: 5000ms`, `pause_on_hover: true`), circle scrollbar/pagination dots.
9. **FAQ Toggles (`about-me`):** Expand/collapse accordion rows.

---

## 5. Phase 1D — Responsive Breakpoint Behavior

From `post-43c1f9.css`, `post-100598ca1.css`, and widget `data-settings`:

| Viewport Target | Active CSS Breakpoint | Container Max Width | Header & Nav | Grids & Carousels | Typography Scale |
|---|---|---|---|---|---|
| **Desktop (`1440px`)** | Default (`>1024px`) | `1320px` (content `1240px`, `30px` side padding) | Full horizontal menu + search + off-canvas CTA (`min-height: 88px`) | 3-col Services (`80px` gap), 3-slide Doctor Carousel (`60px` gap), Vertical Symptom Tabs, 4-col Footer | `H1: 82px`, `H2: 58px`, `H3: 46px`, `Body: 19px` |
| **Laptop (`1280px`)** | Default (`>1024px`) | `1320px` fluidly bounded with `20px`–`30px` outer padding | Full horizontal menu remains expanded | Same 3-col / 2-col grids with tighter side gutters | `H1: 82px`, `H2: 58px`, `Body: 19px` |
| **Tablet (`768px`)** | `@media(max-width: 1024px)` | `1024px` (`10px`–`30px` side padding) | Horizontal nav collapses to hamburger + right slide-over drawer (`dropdown_breakpoints: "tablet"`) | Services -> `2` cols (`40px` gap); Doctor Carousel -> `2` slides (`40px` gap); Podcast/Blog -> `1` col; Vertical Tabs -> Horizontal Tabs; Entrance animations minimized | `H1: 64px`, `H2: 48px`, `H3: 38px`, `H4: 28px`, `Body: 18px`, `Btn: 17px` |
| **Mobile (`375px`)** | `@media(max-width: 767px)` | `767px` (`20px` content padding) | Compact top bar + hamburger menu + slide-over drawer | All grids stack to `1` column (`50px` row gap); Doctor Carousel -> `1` slide (`0px` gap); Entrance animations disabled (`none`); Hero & section paddings compress (`180px` hero top, `60px–70px` sections) | `H1: 46px`, `H2: 38px`, `H3: 30px`, `H4: 24px`, `Body: 17px`, `Btn: 16px` |

---

## 6. Technical Implementation Plan (Reconstruction + Patient Booking App)

### Architecture Strategy
Keep the proven Node.js + SQLite (`server/server.js`, `server/routes.js`, `server/auth.js`, `server/db.js`) backend and existing authentication (`login.html` + Firebase Google OAuth + session cookies/tokens), while reconstructing the entire frontend UI to match **The Practitioner (Private Medical Clinic + Main Practitioner)** design system and converting every static CTA/form into live, database-backed appointment workflows.

### Planned Page & Route Map
1. **`/` (`public/index.html` — Reconstructed Clinic Homepage + Integrated Booking & Patient Portal):**
   - Exact visual reconstruction of *The Practitioner* header (top `#527359` announcement bar + `88px` transparent/sticky navbar with dropdowns, search popup, patient auth status pill, and `"Book a Consultation"` drawer button).
   - **Hero Section:** Warm editorial `#FAF5F0` + `#FFFFFF` split hero with `Outfit` 82px heading, `Radley` italic accents, botanical SVG shapes, and `"Book Consultation"` / `"Explore Services"` CTAs.
   - **Medical Departments & Services Grid (Live from `/api/departments`):** 3-column grid matching the `768x456` / `20px`-radius editorial card design (`Cardiology`, `Dermatology`, `Orthopedics`, `General Medicine`, `Neurology`, `Pediatrics`), each opening a filtered booking flow or service detail view.
   - **Interactive Care & Conditions Tabs:** 4-tab vertical-to-horizontal symptom explorer wired to `"Start Online Visit"` (pre-selecting the matching department in the booking wizard).
   - **Interactive BMI & Pre-Visit Triage Section + Live Consultation Form:** Real client-side BMI calculator paired with direct `"Book a Consultation"` appointment scheduling.
   - **Board-Certified Doctors Carousel (Live from `/api/doctors`):** 3-column responsive carousel (`3 -> 2 -> 1`) displaying our 12 SQLite doctors with ratings, qualifications, clinic rooms, fees, and 1-click `"Book Consultation"` pre-selected for that doctor.
   - **Patient Portal / My Appointments Section (Authenticated View):** Re-styled in `#FAF5F0` / `#FFFFFF` / `#527359` / `#BED173` / `#E1DFDB` tokens — displays upcoming visits banner, status filter tabs (`All`, `Confirmed`, `Pending`, `Completed`, `Cancelled`), search, Google Calendar export, details timeline modal, cancellation modal, and printable appointment slip.
   - **Pre-Footer Gallery & Deep Navy `#08263F` Footer:** 4-column editorial footer (`Radley` italic `#BED173` titles, links, newsletter form, social icons).
2. **Dedicated Multi-Page Navigation Views / Routes (either clean SPA views or multi-page HTML served by `server.js`):**
   - `/about` (`public/about.html` or view): Reconstructed About Clinic & Medical Team story + FAQ accordion.
   - `/services` (`public/services.html` or view): Full 6-department & treatment directory backed by `/api/departments`.
   - `/book` (`public/book.html` or slide-over/modal wizard): Dedicated full-page + off-canvas **Booking Wizard** backed by `/api/availability` and `POST /api/appointments` (with atomic SQLite slot collision prevention).
   - `/contact` (`public/contact.html` or view): Clinic locations, hours, and working inquiry/booking form.
   - `/login.html`: Restyle split-screen patient authentication in *The Practitioner* palette (`#FAF5F0`, `#527359`, `#BED173`, `#333133`, `Outfit` + `Radley`) while preserving Firebase Google Sign-In and email/password flows.

### Implementation Phases (For Execution After Approval)
- **Step 1:** Finalize design tokens in `public/css/tokens.css` (`Outfit` + `Radley`, exact `--e-global-*` palette, responsive typography & container rules).
- **Step 2:** Build shared header/nav/search-popup/off-canvas drawer/footer components and scroll-reveal/carousel JS utilities (`public/js/theme-ui.js`).
- **Step 3:** Reconstruct Homepage (`/`) matching *The Practitioner* section-by-section, hydrated dynamically from `/api/departments`, `/api/doctors`, and `/api/appointments`.
- **Step 4:** Build/restyle `/about`, `/services`, `/book`, `/contact`, and `/login.html` with full appointment-booking, real-time slot checking, and patient dashboard integration.
- **Step 5:** Run `.\node.bat test-server.js` + full responsive verification (`1440px`, `1280px`, `768px`, `375px`) and accessibility contrast audit.
