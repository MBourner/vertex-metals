# Claude Code Project Prompt — Vertex Metals Ltd (v2)
## Vanilla HTML / CSS / JS + Supabase

---

## Project Brief

You are building the public-facing website and internal management portal for **Vertex Metals Ltd**, a commodity trading intermediary incorporated on the Isle of Man. The company connects metal and mineral exporters in India with industrial buyers in the United Kingdom. The initial MVP product is **Aluminium Alloy Core Wire** (EC Grade / 6XXX series), with expansion planned into copper, lithium battery precursors, and precious metals/gems.

**Tech stack: vanilla HTML, CSS, and JavaScript only. No frameworks, no build step, no npm.** The project must run by simply opening HTML files in a browser or serving static files. Supabase is used for authentication, database, and file storage via the Supabase JS client loaded from CDN.

The two directors are:
- **Jackson Paul** — sales director, front end, commercial (supplier relationships India, UK buyer lead generation)
- **Martyn Bourner** — operations director (logistics, compliance, technology, admin)

---

## Design Reference URLs

Jackson has provided the following website URLs as design inspiration. Before writing a single line of CSS, fetch and analyse each URL to understand the visual language, layout patterns, typography, colour palette, spacing, and UX patterns:

```
https://corporate.arcelormittal.com/

https://nucor.com/

https://www.steeldynamics.com/

https://www.salzgitter-mannesmann-uk.com/

https://www.jsw.in/

https://www.stemcor.com/products-and-services

```

Derive a cohesive design direction from these references. The aesthetic must feel:
- **Premium, credible, and industrial** — this is a B2B metals trading company; buyers are UK manufacturing procurement managers
- **Professional but not generic** — not a corporate template, not a SaaS product
- **Trustworthy and serious** — AML-compliant, Isle of Man incorporated, regulated business
- Not consumer-facing or flashy

Document the chosen design direction in `docs/design-system.md` before building any pages.

---

## Phase 1: Project Setup & Folder Structure

Create the following folder structure exactly:

```
vertex-metals/
├── index.html                        # Homepage (public)
├── products.html                     # Products listing (public)
├── products/
│   └── aluminium-alloy-core-wire.html  # Product detail page (public)
├── about.html                        # About page (public)
├── compliance.html                   # Compliance statement (public)
├── contact.html                      # Contact & RFQ form (public)
│
├── portal/
│   ├── login.html                    # Portal login page
│   ├── dashboard.html                # Main portal dashboard
│   ├── rfq/
│   │   ├── index.html                # RFQ inbox — list of buyer enquiries
│   │   └── detail.html               # Individual RFQ record
│   ├── quotes/
│   │   ├── index.html                # Supplier quotes list
│   │   └── calculator.html           # Markup calculator tool
│   ├── trades/
│   │   └── index.html                # Trade files — deals in progress
│   ├── kyc/
│   │   ├── index.html                # KYC/CDD records list
│   │   └── detail.html               # Individual counterparty KYC record
│   ├── contacts/
│   │   └── index.html                # Buyers & suppliers CRM
│   └── cbam/
│       └── index.html                # CBAM carbon intensity tracker
│
├── css/
│   ├── variables.css                 # Design tokens: colours, fonts, spacing
│   ├── base.css                      # Reset, typography, body defaults
│   ├── components.css                # Buttons, forms, cards, tables, badges
│   ├── layout.css                    # Nav, sidebar, page wrappers, grid
│   └── portal.css                    # Portal-specific styles
│
├── js/
│   ├── supabase-client.js            # Supabase initialisation (shared)
│   ├── auth.js                       # Auth helpers: login, logout, session check, redirect
│   ├── portal-guard.js               # Route protection: redirects unauthenticated users to login
│   ├── contact-form.js               # Public contact/RFQ form submission
│   ├── portal/
│   │   ├── dashboard.js
│   │   ├── rfq.js
│   │   ├── quotes.js
│   │   ├── calculator.js
│   │   ├── trades.js
│   │   ├── kyc.js
│   │   ├── contacts.js
│   │   └── cbam.js
│
├── assets/
│   ├── images/
│   │   ├── logo/
│   │   └── products/
│   └── icons/
│
├── docs/
│   ├── design-system.md             # Colours, fonts, spacing tokens, component patterns
│   ├── architecture.md              # How the project is structured and why
│   └── supabase-schema.md           # Database tables and RLS policies
│
└── README.md
```

No `package.json`, no `node_modules`, no build tools. The only external dependencies are loaded via CDN `<script>` tags.

---

## Phase 2: Supabase Configuration

### 2.1 — Supabase client setup

Create `js/supabase-client.js`. Load the Supabase JS v2 client from CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

In `supabase-client.js`, initialise the client:

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

Leave `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` as clear placeholders with a comment instructing where to find these values in the Supabase dashboard. Every HTML page loads this file before any other JS.

### 2.2 — Auth helpers (`js/auth.js`)

Implement the following functions:

- `signIn(email, password)` — calls `supabase.auth.signInWithPassword()`; returns error if failed
- `signOut()` — calls `supabase.auth.signOut()`; redirects to `/portal/login.html`
- `getSession()` — returns the current session or null
- `requireAuth()` — checks session; if none, redirects to `/portal/login.html` immediately. Must be called at the top of every portal page script.
- `getCurrentUser()` — returns the current user object

### 2.3 — Portal route guard (`js/portal-guard.js`)

A single script tag included in every portal HTML page (before page content loads). Calls `requireAuth()` synchronously on page load. If no valid session is found, immediately redirects to `/portal/login.html`. This prevents any portal page content from rendering for unauthenticated users.

### 2.4 — Database schema

Create `docs/supabase-schema.md` documenting the following tables. Also provide the raw SQL `CREATE TABLE` statements that can be pasted directly into the Supabase SQL editor:

**`rfq_submissions`** — enquiries submitted via the public contact form
- `id` uuid primary key
- `created_at` timestamptz
- `name` text
- `company` text
- `role` text
- `email` text
- `phone` text
- `product_interest` text
- `estimated_quantity` text
- `message` text
- `counterparty_type` text — 'buyer' or 'supplier'
- `status` text — 'new', 'in_review', 'quoted', 'closed'

**`contacts`** — buyers and suppliers CRM
- `id` uuid primary key
- `created_at` timestamptz
- `company_name` text
- `contact_name` text
- `email` text
- `phone` text
- `type` text — 'buyer' or 'supplier'
- `country` text
- `notes` text
- `kyc_status` text — 'not_started', 'in_progress', 'complete', 'flagged'

**`kyc_records`** — KYC/CDD records per counterparty (linked to contacts)
- `id` uuid primary key
- `created_at` timestamptz
- `contact_id` uuid references contacts(id)
- `verification_date` date
- `verified_by` text
- `documents_collected` text[] — array of document types collected
- `sanctions_screened_at` timestamptz
- `sanctions_result` text — 'clear', 'match', 'potential_match'
- `pep_screened_at` timestamptz
- `pep_result` text — 'clear', 'match', 'potential_match'
- `risk_rating` text — 'low', 'medium', 'high'
- `edd_required` boolean
- `notes` text
- `next_review_date` date

**`supplier_quotes`** — FOB quotes received from Indian suppliers
- `id` uuid primary key
- `created_at` timestamptz
- `supplier_id` uuid references contacts(id)
- `product` text
- `specification` text
- `fob_price_usd` numeric
- `quantity_mt` numeric — metric tonnes
- `validity_date` date
- `incoterm` text
- `origin_port` text
- `notes` text
- `status` text — 'active', 'expired', 'used'

**`trades`** — deals in progress
- `id` uuid primary key
- `created_at` timestamptz
- `reference` text — e.g. VM-2026-001
- `buyer_id` uuid references contacts(id)
- `supplier_id` uuid references contacts(id)
- `product` text
- `quantity_mt` numeric
- `buy_price_usd` numeric
- `sell_price_gbp` numeric
- `margin_gbp` numeric
- `status` text — 'enquiry', 'quoted', 'confirmed', 'in_transit', 'delivered', 'invoiced', 'complete'
- `lc_reference` text
- `bl_reference` text
- `notes` text

**`cbam_records`** — carbon intensity data per supplier for UK CBAM (effective 2027)
- `id` uuid primary key
- `created_at` timestamptz
- `supplier_id` uuid references contacts(id)
- `product` text
- `facility_name` text
- `energy_source` text
- `carbon_intensity_tco2_per_t` numeric — tonnes CO2 per tonne product
- `verified_by_third_party` boolean
- `verification_date` date
- `eu_cbam_compliant` boolean
- `notes` text

Include RLS policies for each table: authenticated users (directors) can read and write all rows; anonymous users have no access. The `rfq_submissions` table also allows anonymous INSERT (so the public contact form can write to it).

---

## Phase 3: Public-Facing Website

All public pages share a common `<head>` block and navigation. Extract these into clearly commented HTML snippets that are copy-pasted into each page (no server-side includes — this is static HTML). Add a comment at the top of each file: `<!-- SHARED: update nav in all public pages if changed -->`.

### Navigation
- Logo (left) — text "Vertex Metals" in the brand font, linked to `index.html`
- Links: Products, About, Compliance, Contact
- CTA button: "Request a Quote" → links to `contact.html`
- Mobile hamburger menu (CSS + minimal JS toggle, no libraries)

### 3.1 — Homepage (`index.html`)

- **Hero**: Bold typographic statement. Suggested headline: *"Industrial metals. India to the UK."* with a sub-line about the India–UK FTA advantage and UK Critical Minerals supply chain. Strong CTA button: "Request a Quote".
- **Value proposition strip**: 3–4 icon+text blocks — e.g. Isle of Man incorporated / AML & KYC compliant / India–UK FTA advantage / UK Critical Minerals listed
- **Products teaser**: 3 cards — Aluminium Alloy Core Wire (featured), + 2 "coming soon" (Copper, Lithium). Each links to `/products.html`.
- **Why Vertex Metals**: 3–4 differentiators — e.g. Proven India supply chain / Dangerous goods logistics expertise / Full compliance documentation / End-to-end trade management
- **India–UK trade context**: A brief factual section on the trade corridor — reference the India–UK CETA (signed May 2025), UK aluminium demand growth, aluminium's Critical Mineral status (March 2025)
- **CTA banner**: "Ready to source? Talk to us." with contact button

### 3.2 — Products (`products.html`)

- Product grid — cards for each product:
  - **Aluminium Alloy Core Wire** — EC Grade / 6XXX series — active, link to detail page
  - **Steel & Iron Products** — coming soon
  - **Mica** — coming soon
  - **Copper Concentrate** — Phase 2
  - **Lithium Battery Precursors** — Phase 2
- Each card: product name, one-line description, origin country flag (India), UK demand context note, status badge (Available / Coming Soon), CTA

### 3.3 — Product detail: Aluminium Alloy Core Wire (`products/aluminium-alloy-core-wire.html`)

- Full product description
- Specifications table: grades (EC Grade, 6XXX series), conductivity, tensile strength, standard coil weights, available forms
- Why India: Gujarat and Odisha manufacturing clusters, quality credentials
- UK demand context: Critical Mineral status, EV cabling demand, aerospace
- India–UK FTA: duty advantage
- CBAM note: UK CBAM from January 2027 — Vertex Metals is building carbon intensity data for all supplier facilities
- CTA: Request a Quote

### 3.4 — About (`about.html`)

- Company overview: what Vertex Metals does, Isle of Man incorporation, trading model
- **Team section**: Jackson Paul (Director — commercial, India supply chain) and Martyn Bourner (Director — operations, compliance, technology). Keep bios factual and professional.
- How we trade: plain-language explanation of the intermediary model — sourcing, documentation, logistics, margin. Do NOT mention ITDLC mechanics, switch BOLs, or markup methodology.
- Regulatory credentials: IOM 1931 Act company, IOM FSA designated business, AML/KYC policy, HMRC registrations in progress

### 3.5 — Compliance (`compliance.html`)

- Introductory paragraph: Vertex Metals takes its compliance obligations seriously as a designated business under IOM law and a metals trader operating into the UK
- **AML/KYC summary**: We conduct Customer Due Diligence on all counterparties. KYC documentation required from all buyers and suppliers before first transaction.
- **No-cash policy statement** (prominent, boxed): All transactions settled by bank transfer or Irrevocable Transferable Documentary Letter of Credit only. No cash accepted in any currency.
- **Sanctions screening**: All counterparties screened against UK, OFSI, UN, and EU sanctions lists at onboarding and every 6 months.
- **MLRO**: Martyn Bourner — mlro@vertexmetalsltd.com
- **UK CBAM**: Vertex Metals is preparing for UK CBAM obligations effective 1 January 2027. Carbon intensity data is collected for all supplier facilities.
- **Governing frameworks**: Proceeds of Crime Act 2008 (IOM), AML/CFT Code 2019 (IOM), UK Money Laundering Regulations 2017, OFSI sanctions obligations

### 3.6 — Contact & RFQ (`contact.html`)

Two tabs or clearly separated sections: **Buyers** and **Suppliers**.

**Buyer enquiry form fields:**
- Full name (required)
- Company name (required)
- Your role / job title
- Email (required)
- Phone
- Product interest (dropdown: Aluminium Alloy Core Wire / Steel & Iron Products / Copper Concentrate / Lithium Precursors / Other)
- Estimated annual volume (text — e.g. "50 MT/year")
- Message / additional details
- Submit button: "Send Enquiry"

**Supplier enquiry form fields:**
- Full name (required)
- Company name (required)
- Your role
- Email (required)
- Phone
- Country of operation (required)
- Products you manufacture (text)
- Approximate annual export capacity
- Message
- Submit button: "Contact Us"

On submit: write the form data to the `rfq_submissions` table in Supabase (anonymous insert — no auth required). Show a clear success message. Show a clear error message if submission fails. Do not redirect away from the page.

Also display:
- Email: sales@vertexmetalsltd.com
- Address: Apartment 3, Falcon Cliff Apartments, 9–10 Palace Road, Douglas, Isle of Man, IM2 4LD

---

## Phase 4: Internal Management Portal

Every portal page must:
1. Load `js/supabase-client.js` first
2. Load `js/portal-guard.js` second (redirects to login if not authenticated — no portal content renders for unauthenticated users)
3. Include a consistent sidebar navigation and top bar

### Portal navigation (sidebar)
- Company logo / name at top
- Links: Dashboard, RFQs, Supplier Quotes, Trades, KYC Records, Contacts, CBAM Tracker
- User info at bottom: logged-in email + Logout button (calls `signOut()`)

### 4.1 — Login (`portal/login.html`)

- Clean, centred login card — not the full portal layout
- Email + password fields
- "Sign In" button — calls `signIn()`; on success redirects to `portal/dashboard.html`
- Clear error message display for failed login
- No "register" or "forgot password" links (two known users only — accounts created directly in Supabase dashboard)

### 4.2 — Dashboard (`portal/dashboard.html`)

Summary cards fetched live from Supabase:
- New RFQs (status = 'new') — count
- Active trades (status not in 'complete', 'closed') — count
- Contacts awaiting KYC (kyc_status = 'not_started' or 'in_progress') — count
- Supplier quotes expiring within 14 days — count

Below the cards: two panels side by side:
- **Recent RFQs**: last 5 submissions, showing company, product interest, date, status badge. Each row links to the RFQ detail page.
- **Active trades**: last 5 trades, showing reference, buyer, product, status badge.

### 4.3 — RFQ Inbox (`portal/rfq/index.html`)

Table of all `rfq_submissions` records, newest first. Columns: date, name, company, type (buyer/supplier), product interest, status badge. Clicking a row goes to `portal/rfq/detail.html?id={uuid}`.

Filter controls above the table: by status (all / new / in_review / quoted / closed) and by type (all / buyer / supplier).

### 4.4 — RFQ Detail (`portal/rfq/detail.html`)

Reads `id` from URL query param. Fetches the full record from Supabase and displays all fields. Includes:
- Status dropdown to update the status (writes back to Supabase on change)
- Notes textarea (editable, saves on blur or with a Save button)
- "Create Contact" button — pre-fills the contacts form with name, company, email, phone from this RFQ

### 4.5 — Supplier Quotes (`portal/quotes/index.html`)

Table of `supplier_quotes`, newest first. Columns: supplier name (join to contacts), product, FOB price (USD), quantity (MT), validity date, status badge. Highlight rows where validity_date is within 14 days in amber; expired in red.

Link to `portal/quotes/calculator.html` prominently.

### 4.6 — Markup Calculator (`portal/quotes/calculator.html`)

A standalone tool. Inputs:
- FOB price (USD per MT)
- Quantity (MT)
- Freight estimate (USD, total)
- Insurance estimate (USD, total)
- Target margin (% — default 20%)
- GBP/USD exchange rate (manual input — note that live rates require a separate API key)

Calculated outputs (update live as inputs change):
- Total landed cost (USD)
- Total landed cost (GBP) at entered exchange rate
- Cost per MT (GBP)
- Suggested sell price per MT (GBP) at target margin
- Total sell value (GBP)
- Gross margin (GBP)
- Gross margin (%)

Style the output section clearly — large numbers, clearly labelled. Add a "Save as Quote" button that writes the calculation to `supplier_quotes` (requires the user to select/enter a supplier and product first).

### 4.7 — Trades (`portal/trades/index.html`)

Table of all trades. Columns: reference, buyer, supplier, product, quantity, sell value (GBP), margin (GBP), status badge. Filterable by status. Each row links to a detail view (stub this as an alert "Trade detail — coming in next sprint" for now).

"New Trade" button opens a modal form to create a new trade record (all fields from the trades schema). On submit, writes to Supabase and refreshes the table.

### 4.8 — KYC Records (`portal/kyc/index.html`)

Table of `kyc_records` joined to `contacts`. Columns: company name, type (buyer/supplier), KYC status badge, risk rating badge, last sanctions screen date, next review date. Rows where next_review_date is within 30 days highlighted amber; overdue highlighted red.

"Add KYC Record" button opens a form modal. Each row links to `portal/kyc/detail.html?id={uuid}`.

### 4.9 — KYC Detail (`portal/kyc/detail.html`)

Full editable form for a single KYC record. All fields from the schema displayed and editable. Includes a "Sanctions Screen Log" section showing screening history (date, result) in a small table — these are stored in the notes field as structured text for now, with a note that a dedicated screening_logs table will be added in a future sprint.

### 4.10 — Contacts (`portal/contacts/index.html`)

Table of all contacts. Columns: company name, contact name, type badge, country, KYC status badge, email. Search box filters by company name or contact name. "Add Contact" button opens a modal form. Each row links to the KYC detail for that contact if a KYC record exists.

### 4.11 — CBAM Tracker (`portal/cbam/index.html`)

Table of `cbam_records` joined to `contacts` (supplier). Columns: supplier name, product, facility, energy source, carbon intensity (tCO2/t), third-party verified badge, EU CBAM compliant badge, verification date.

Banner at top of page: *"UK CBAM takes effect 1 January 2027. Vertex Metals must register with HMRC before that date. All aluminium suppliers must provide verified installation-level emissions data."*

"Add Record" button opens a form modal.

---

## Phase 5: Design System

### CSS architecture

- `variables.css` defines all design tokens as CSS custom properties. No hardcoded colours, font sizes, or spacing values anywhere else.
- `base.css` imports `variables.css` first. Includes a minimal reset, body defaults, and typography scale.
- Every HTML page loads in this order: `variables.css` → `base.css` → `components.css` → `layout.css` → then page-specific styles inline if needed.

### Colour palette

Derive from Jackson's reference URLs. Document the chosen palette in `design-system.md`. Until references are analysed, use this placeholder palette — clearly marked as TO BE UPDATED after reference review:

```css
:root {
  --color-primary: #1a2332;        /* Deep navy — trust, industrial */
  --color-primary-light: #2c3e55;
  --color-accent: #c17f24;         /* Copper-gold — metals, premium */
  --color-accent-light: #d4953a;
  --color-surface: #f8f7f4;        /* Warm off-white */
  --color-surface-raised: #ffffff;
  --color-border: #e2e0db;
  --color-text-primary: #1a1a18;
  --color-text-secondary: #5c5b57;
  --color-text-muted: #9c9b97;
  --color-success: #2d6a2d;
  --color-warning: #8a5c00;
  --color-danger: #8a1c1c;
  --color-success-bg: #eaf3e8;
  --color-warning-bg: #fdf3dc;
  --color-danger-bg: #fdeaea;
}
```

### Typography

Choose a distinctive display font and a clean body font from Google Fonts. Avoid Inter, Roboto, Arial, and system fonts. Load via `<link>` in `base.css` or in the shared `<head>`. Suggestions to evaluate against the reference sites: Cormorant Garamond, DM Serif Display, Syne, Neue Haas Grotesk, or similar. Document the chosen pairing in `design-system.md`.

Define a type scale in `variables.css`:

```css
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 1.875rem;
--text-4xl: 2.25rem;
--text-5xl: 3rem;
```

### Spacing

4px base grid:

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-24: 6rem;     /* 96px */
```

### Components

Define reusable component classes in `components.css`:

- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`
- `.card` — surface card with border and radius
- `.badge`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info`, `.badge-neutral`
- `.form-group`, `.form-label`, `.form-input`, `.form-select`, `.form-textarea`
- `.table-wrapper` (overflow-x: auto), `table`, `thead`, `tbody tr:hover`
- `.modal-overlay`, `.modal-box` (CSS only toggle via class)
- `.alert`, `.alert-success`, `.alert-error`
- `.sidebar`, `.sidebar-link`, `.sidebar-link.active`
- `.topbar`
- `.stat-card` — dashboard summary card with label + large number

---

## Phase 6: Email Notifications (Contact Form)

For the public contact form, use **Resend** to send an email notification to `sales@vertexmetalsltd.com` when a new RFQ submission is made.

Since there is no server-side code, use the Resend API directly from the browser via a `fetch()` POST to `https://api.resend.com/emails`. Note in a comment that the Resend API key must be a restricted key scoped to send-only, and that the key will be visible in client-side code — this is acceptable for a low-security notification email but should be replaced with a Supabase Edge Function in a future sprint if needed.

Leave `YOUR_RESEND_API_KEY` as a clear placeholder in `js/contact-form.js`.

The email should notify: new RFQ submission received, include the submitter's name, company, email, and product interest.

Alternatively, if Resend integration is complex to stub cleanly, use a **Supabase Database Webhook** note: add a comment in `js/contact-form.js` explaining that a Supabase webhook can trigger an email via Resend when a new row is inserted into `rfq_submissions`, and that this is the recommended approach to keep API keys server-side. Stub the client-side code to simply write to Supabase and show a success message, with a TODO comment for the webhook setup.

---

## Phase 7: README & Documentation

### `README.md`

- Project overview
- Tech stack: vanilla HTML/CSS/JS, Supabase JS v2 via CDN
- Folder structure summary
- How to run locally: open `index.html` in a browser, or use VS Code Live Server extension
- How to deploy: push to GitHub, connect to Cloudflare Pages or Netlify, set no build command, set publish directory to `/`
- Environment setup: replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` in `js/supabase-client.js`
- Supabase setup: link to `docs/supabase-schema.md` for SQL to run in Supabase SQL editor
- Portal access: accounts created directly in Supabase Authentication dashboard
- Contact: Martyn Bourner, martyn@vertexmetalsltd.com

### `docs/architecture.md`

Explain the key design decisions:
- Why vanilla JS (no framework, no build step, proven pattern)
- How auth works (Supabase session, portal-guard.js on every portal page)
- How the public RFQ form writes to Supabase without auth (anon insert + RLS)
- CSS architecture (variables → base → components → layout)
- Future migration path if a framework becomes necessary

---

## Key Business Context

Use throughout for copy, labels, and UX decisions:

- **Company**: Vertex Metals Ltd, Isle of Man 1931 Act, 0% IOM corporation tax
- **Model**: Commodity trading intermediary — acts as principal, earns margin, does not hold stock
- **MVP product**: Aluminium Alloy Core Wire (EC Grade / 6XXX series) — India to UK
- **Suppliers**: Gujarat (Ahmedabad) and Odisha manufacturing clusters, India
- **Buyers**: UK industrial manufacturers — West Midlands automotive (EV cabling), aerospace, energy
- **Key commercial context**: India–UK CETA signed May 2025 (near tariff-free); aluminium designated UK Critical Mineral March 2025; India's UK aluminium market share grew 2,615% YoY
- **Compliance**: IOM FSA designated business; AML/KYC policy active; no-cash policy; HMRC HVD registration pending; UK CBAM from January 2027
- **Future products**: Phase 2 — copper concentrate, lithium battery precursors; Phase 3 — lab-grown diamonds, silver jewellery
- **Website**: www.vertexmetalsltd.com | **Email**: sales@vertexmetalsltd.com
- **Address**: Apartment 3, Falcon Cliff Apartments, 9–10 Palace Road, Douglas, Isle of Man, IM2 4LD
- **MLRO**: Martyn Bourner — mlro@vertexmetalsltd.com

---

## Constraints

- No frameworks, no npm, no build step — static files only
- No hardcoded colours or font sizes outside `variables.css`
- All portal pages must call `requireAuth()` via `portal-guard.js` before rendering any content
- Do not expose internal commercial mechanics (margin calculations, ITDLC, switch BOL procedures) on the public site
- Compliance page copy must be factually accurate — this is a regulated business
- All forms must have client-side validation with clear error states
- Site must be fully mobile-responsive using CSS only (no JS for layout)
- All Supabase credentials left as named placeholders — never hardcode real keys

---

## Build Order

Work through phases in this order:

1. **Phase 1** — Create the full folder structure with empty placeholder files
2. **Phase 5** — Design system: analyse reference URLs, document design direction, create all CSS files with tokens and component classes
3. **Phase 3** — Public website pages (index, products, about, compliance, contact) using the design system
4. **Phase 2** — Supabase client, auth helpers, portal guard, database schema documentation
5. **Phase 4** — Portal pages, starting with login and dashboard, then module by module
6. **Phase 6** — Email notification stub
7. **Phase 7** — README and documentation

---

*Vertex Metals Ltd — v2 prompt — vanilla HTML/CSS/JS + Supabase — April 2026*
