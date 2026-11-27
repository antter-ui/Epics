# Website Resource & Asset Inventory

**Reference Website:** `https://the-practitioner.cmsmasters.studio/` (`main/`, `home-clinic/`, `about-me/`, `services/`, `book-a-consultation/`, `contacts/`)  
**Target Asset Root:** `public/assets/` (`images/`, `icons/`, `fonts/`, `backgrounds/`, `logos/`)

> **Copyright & Licensing Policy:** Proprietary theme assets, brand logos, decorative theme PNGs/SVGs, and bundled ThemeForest stock photos from `the-practitioner.cmsmasters.studio` are **not** redistributed. All fonts use open-source **SIL Open Font License 1.1** equivalents, all logos/icons/organic backgrounds have been recreated as original project-owned SVGs in `public/assets/`, and all photographic slots map to open-license **Unsplash** imagery matching the exact reference aspect ratios.

---

## 1. Asset Directory Structure

```text
public/
└── assets/
    ├── backgrounds/
    │   ├── dot-cluster.svg
    │   ├── hero-curve-line.svg
    │   ├── organic-blob-accent.svg
    │   ├── organic-blob-cream.svg
    │   └── organic-blob-sage.svg
    ├── fonts/
    │   └── fonts.css
    ├── icons/
    │   ├── arrow-right.svg
    │   ├── calendar.svg
    │   ├── check-verified.svg
    │   ├── chevron-down.svg
    │   ├── clock.svg
    │   ├── close.svg
    │   ├── menu.svg
    │   ├── phone.svg
    │   ├── search.svg
    │   ├── social-facebook.svg
    │   ├── social-instagram.svg
    │   ├── social-x.svg
    │   └── social-youtube.svg
    ├── images/
    │   └── README.md
    └── logos/
        ├── logo-practitioner-dark.svg
        └── logo-practitioner-light.svg
```

---

## 2. Complete Resource Inventory

### 2.1 Typography & Fonts

| Filename / Resource | Resource Type | Original Source Location | Intended Section | Dimensions / Weights | Licensing Status | Replacement / Local Asset |
|---|---|---|---|---|---|---|
| `Outfit` (`fonts.css`) | Web Font (Sans-Serif) | `.../cmsmasters-local-fonts/outfit_local/OutfitThin-*.woff2` | Global body, H1–H5, nav, buttons | Weights `300`, `400`, `500` (+ `600`) | **SIL OFL 1.1** (Open Source) | Loaded via Google Fonts in `public/assets/fonts/fonts.css` |
| `Radley` (`fonts.css`) | Web Font (Serif Italic) | `.../cmsmasters-local-fonts/radley_local/Radley-Italic.woff2` | Blockquotes, footer titles, editorial accents | `400` Regular & `400` Italic | **SIL OFL 1.1** (Open Source) | Loaded via Google Fonts in `public/assets/fonts/fonts.css` |

### 2.2 Logos

| Filename | Resource Type | Original Source Location | Intended Section | Dimensions | Licensing Status | Replacement / Local Asset |
|---|---|---|---|---|---|---|
| `logo-practitioner-dark.svg` | Vector Logo (SVG) | `.../main/wp-content/uploads/sites/9/2022/06/logo-main.svg` & `logo-clinic-1.svg` | Main Header Navigation (light bg) | `165x56` (`2.95:1`) | Proprietary demo brand — **Replaced** | Original SVG created at `public/assets/logos/logo-practitioner-dark.svg` |
| `logo-practitioner-light.svg` | Vector Logo (SVG) | `.../main/wp-content/uploads/sites/9/2022/06/logo-store-1.svg` & `logo-landing-1.svg` | Dark Navy Footer (`#08263F`) | `165x56` (`2.95:1`) | Proprietary demo brand — **Replaced** | Original SVG created at `public/assets/logos/logo-practitioner-light.svg` |

### 2.3 Icons & Icon Libraries

| Filename | Resource Type | Original Source Location | Intended Section | Dimensions | Licensing Status | Replacement / Local Asset |
|---|---|---|---|---|---|---|
| `arrow-right.svg` | UI Icon (SVG) | `cmsmasters-demo-icons` (`.cmsms-demo-icon-arrow`) | Buttons, service cards, carousel arrows | `20x20` (`1:1`) | Proprietary icon font — **Replaced** | Original SVG at `public/assets/icons/arrow-right.svg` |
| `search.svg` | UI Icon (SVG) | `cmsmasters-demo-icons` (`.cmsms-demo-icon-search`) | Header search trigger & modal input | `20x20` (`1:1`) | Proprietary icon font — **Replaced** | Original SVG at `public/assets/icons/search.svg` |
| `check-verified.svg` | UI Icon (SVG) | `cmsmasters-demo-icons` (`.cmsms-demo-icon-approved`) | Credentials, booking confirmation, trust pills | `20x20` (`1:1`) | Proprietary icon font — **Replaced** | Original SVG at `public/assets/icons/check-verified.svg` |
| `menu.svg` / `close.svg` / `chevron-down.svg` | UI Navigation Icons | Font Awesome (`fa-bars`, `fa-times`, `fa-angle-down`) | Mobile hamburger, modal/drawer close, dropdowns | `16x16`–`22x22` | FA Free (CC BY 4.0) — **Replaced with standalone SVGs** | `public/assets/icons/menu.svg`, `close.svg`, `chevron-down.svg` |
| `phone.svg` / `calendar.svg` / `clock.svg` | Clinic Contact Icons | Font Awesome (`fa-phone-alt`, `fa-clock`, `fa-file-alt`) | Top bar, contact info cards, slot picker | `20x20` (`1:1`) | FA Free (CC BY 4.0) — **Replaced with standalone SVGs** | `public/assets/icons/phone.svg`, `calendar.svg`, `clock.svg` |
| `social-facebook.svg`, `social-x.svg`, `social-youtube.svg`, `social-instagram.svg` | Social Icons (SVG) | Font Awesome Brands (`fa-facebook-f`, `fa-x-twitter`, `fa-youtube`, `fa-instagram`) | Footer social row & Instagram strip | `18x18` (`1:1`) | Brand marks / FA Free — **Standalone SVGs** | `public/assets/icons/social-*.svg` |

### 2.4 Background Shapes & Decorative Illustrations

| Filename | Resource Type | Original Source Location | Intended Section | Dimensions | Licensing Status | Replacement / Local Asset |
|---|---|---|---|---|---|---|
| `hero-curve-line.svg` | Decorative Line SVG | `.../2022/01/home-line-1.svg` / `home-line.png` | Hero & Contacts organic line accent | `327x369` | Proprietary theme graphic — **Replaced** | Original SVG at `public/assets/backgrounds/hero-curve-line.svg` |
| `organic-blob-cream.svg` | Decorative Blob SVG | `.../2021/12/home-shape.png`, `home-shape-3.png`, `about-shape-7.png` | Hero, Testimonial, & Story backdrops (`#FAF5F0`) | `618x530` | Proprietary theme graphic — **Replaced** | Original SVG at `public/assets/backgrounds/organic-blob-cream.svg` |
| `organic-blob-sage.svg` | Decorative Blob SVG | `.../2022/05/shape-2.png`, `home-clinic-elemnet-6.png` | Services & Clinic hero backdrop (`#527359` @ 10%) | `618x529` | Proprietary theme graphic — **Replaced** | Original SVG at `public/assets/backgrounds/organic-blob-sage.svg` |
| `organic-blob-accent.svg` | Decorative Accent SVG | `.../2021/12/home-back-10.png`, `about-shape-2.png` | Floating parallax accent (`#BED173`) | `139x138` | Proprietary theme graphic — **Replaced** | Original SVG at `public/assets/backgrounds/organic-blob-accent.svg` |
| `dot-cluster.svg` | Pattern Graphic SVG | `.../2022/06/home-podcast-element-8.png` | Hero & pre-footer floating dots (`#EC9F57`) | `120x120` | Proprietary theme graphic — **Replaced** | Original SVG at `public/assets/backgrounds/dot-cluster.svg` |

### 2.5 Photographic Assets (Licensed Demo Media -> Open-License Unsplash Replacements)

All original demo `.jpg` / `.png` photographs in `the-practitioner.cmsmasters.studio` carry third-party ThemeForest demo restrictions and are **not** copied locally. Below is the exact dimensional replacement map:

| Reference Filename | Resource Type | Original Source Location | Intended Section | Reference Dimensions (Aspect) | Licensing Status | Replacement Strategy |
|---|---|---|---|---|---|---|
| `home-clinic-3.jpg`, `home-clinic-image-2..4.jpg` | Clinic Interior / Banner Photo | `.../sites/9/2022/06/home-clinic-3.jpg` | Clinic Hero & Philosophy Gallery (`home-clinic`) | `820x380` (`~2.16:1`) | Demo stock photo — **Do Not Reuse** | Unsplash modern medical clinic consultation photography (`?w=820&h=380&fit=crop`) |
| `home-clinic-4.jpg`, `home-15.jpg`, `home-2.png` | Lead Practitioner / Clinic Feature | `.../sites/9/2022/01/home-clinic-4.jpg`, `home-15.jpg` | Hero Portrait / Approach Split | `620x680` / `725x752` (`~0.91:1`–`0.96:1`) | Demo stock photo — **Do Not Reuse** | Unsplash physician portrait (`?w=725&h=752&fit=crop&crop=face`) |
| `service-1..9-768x456.jpg` | Medical Service Cards | `.../sites/9/2021/12/service-1..9-768x456.jpg` | `Our Services` 3-col Grid (`home-clinic` & `services/`) | `768x456` (`1.68:1`) | Demo stock photo — **Do Not Reuse** | 6 curated Unsplash clinical department images (`?w=768&h=456&fit=crop`) mapped to SQLite departments |
| `home-clinic-doctor-1..3.jpg` | Doctor Team Portraits | `.../sites/9/2022/01/home-clinic-doctor-1..3.jpg` | Doctor Team Carousel (`home-clinic`) | `768x768` (`1:1`) | Demo stock photo — **Do Not Reuse** | Existing 12 Unsplash doctor portraits in `server/db.js` (`?w=768&h=768&fit=crop&crop=face`) |
| `consultation-2.jpg` | Appointment Page Visual | `.../sites/9/2021/12/consultation-2.jpg` | `Book a Consultation` page & drawer | `768x880` (`0.87:1`) | Demo stock photo — **Do Not Reuse** | Unsplash doctor-patient consultation (`?w=768&h=880&fit=crop`) |
| `contacts-1.jpg`, `contacts-3.jpg` | Clinic Contact Photos | `.../sites/9/2022/01/contacts-1.jpg`, `contacts-3.jpg` | `Contacts` page | `680x760`, `590x740` | Demo stock photo — **Do Not Reuse** | Unsplash clinic reception & physician (`?w=680&h=760&fit=crop`) |
| `about-1.jpg`, `about-2.jpg`, `about-4.jpg` | About Page Photos | `.../sites/9/2021/12/about-1..4.jpg` | `About Me` / Clinic Story | `1280x660`, `560x601`, `561x680` | Demo stock photo — **Do Not Reuse** | Unsplash medical team & clinic environment matching dimensions |
| `quote-1..3.jpg` | Patient Testimonial Avatars | `.../sites/9/2021/12/quote-1..3.jpg` | Patient Testimonials Carousel | `150x150` (`1:1`) | Demo stock photo — **Do Not Reuse** | Unsplash patient portrait avatars (`?w=150&h=150&fit=crop&crop=face`) |
| `lesson-12.jpg`, `course-3/5/6.jpg`, `podcast-4/5/7/8.jpg` | Articles / Wellness Guides | `.../sites/9/2022/01-02/...` | Health Journal / Blog Cards | `768x489` / `1024x560` | Demo stock photo — **Do Not Reuse** | Unsplash wellness & nutrition editorial photos (`?w=768&h=489&fit=crop`) |
| `269610464_*.jpg` (6 square photos) | Pre-Footer Gallery | `.../sites/9/2022/06/...` | Pre-Footer `@clinic` 6-tile Strip | `1080x1080` (`1:1`) | Demo Instagram assets — **Do Not Reuse** | 6 Unsplash healthcare & nutrition square thumbnails (`?w=400&h=400&fit=crop`) |

### 2.6 Publicly Accessible CSS & JavaScript Reference Notes
- **Stylesheets inspected (used as token/specification reference only — NOT copied):** `post-43c1f9.css` (Global Kit tokens), `post-4668ca1.css` (Header/Top-bar/Off-canvas), `post-364c1f9.css` (Footer), `post-100598ca1.css` (Main Homepage), `default-vars.min8a54.css`.
- **Scripts inspected:** Reference site uses WordPress + Elementor + Swiper v8 + Forminator + jQuery. Our independent reconstruction will implement all interactions (dropdowns, search modal, slide-over booking drawer, responsive carousel, tabs, accordion, BMI calculator, and scroll reveal) in **clean, zero-dependency vanilla ES6+ JavaScript** integrated directly with `server/routes.js`.
