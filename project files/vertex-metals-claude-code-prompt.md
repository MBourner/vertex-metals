# Claude Code Project Prompt — Vertex Metals Ltd
## Website & Management Software Suite

---

## Project Brief

You are building the website and internal management software suite for **Vertex Metals Ltd**, a commodity trading intermediary incorporated on the Isle of Man. The company connects metal and mineral exporters in India with industrial buyers in the United Kingdom. The initial MVP product focus is **Aluminium Alloy Core Wire** (EC Grade / 6XXX series), with expansion planned into copper, lithium battery precursors, and precious metals/gems.

The two directors are:
- **Jackson Paul** — sales director, front-end commercial (supplier relationships in India, UK buyer lead generation)
- **Martyn Bourner** — operations director, back-end operations (logistics, compliance, technology)

---

## Design Reference URLs

Jackson has provided the following website URLs as design inspiration. Before beginning any design work, fetch and analyse each of these URLs to understand the visual language, layout patterns, typography, colour palette, and UX patterns that appeal to the business:

```
https://corporate.arcelormittal.com/

https://nucor.com/

https://www.steeldynamics.com/

https://www.salzgitter-mannesmann-uk.com/

https://www.jsw.in/

https://www.stemcor.com/products-and-services

```

Derive a cohesive design direction from these references. The aesthetic should feel:
- **Premium, credible, and industrial** — this is a B2B metals trading company dealing with UK manufacturing procurement managers
- **Professional but not stale** — not a generic corporate template
- **Trustworthy** — buyers and suppliers need to feel they are dealing with a serious, well-run business
- Not overly flashy or consumer-facing; this is a trade business

---

## Phase 1: Project Setup & Folder Structure

Create the following folder structure in the project root:

```
vertex-metals/
├── public/
│   ├── images/
│   │   ├── logo/
│   │   └── products/
│   └── favicon/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   ├── ui/
│   │   └── forms/
│   ├── pages/
│   │   ├── website/          # Public-facing marketing site
│   │   └── portal/           # Internal management portal (auth-protected)
│   ├── styles/
│   │   ├── globals.css
│   │   ├── variables.css     # Design tokens: colours, fonts, spacing
│   │   └── components/
│   ├── lib/
│   │   ├── utils/
│   │   └── api/
│   ├── data/
│   │   ├── products.js       # Product catalogue data
│   │   └── contacts.js       # Placeholder supplier/buyer structures
│   └── assets/
│       └── icons/
├── docs/
│   ├── design-system.md
│   └── architecture.md
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

Set up the project using **Next.js 14+ with App Router**, TypeScript, and Tailwind CSS. Install and configure:
- `next` + `react` + `react-dom`
- `typescript`
- `tailwindcss` + `postcss` + `autoprefixer`
- `lucide-react` (icons)
- `framer-motion` (animations)
- `@radix-ui/react-*` (accessible UI primitives as needed)

---

## Phase 2: Public-Facing Marketing Website

### Pages to build:

#### 2.1 — Homepage (`/`)
- Hero section: bold headline communicating the India–UK metals trading corridor. Use a strong typographic statement, not just a banner image. Something like: *"Industrial metals. India to the UK. Done right."*
- Brief value proposition: who we are, what we trade, why buyers choose us
- Key trust signals: Isle of Man incorporated, AML/KYC compliant, India–UK FTA advantage, UK Critical Minerals list
- Products teaser section (linking to `/products`)
- Why us / differentiators section
- CTA section: "Enquire about a shipment" — links to contact/RFQ form

#### 2.2 — Products (`/products`)
- Product listing page with cards for each product category
- Initial products to include:
  - **Aluminium Alloy Core Wire** (EC Grade / 6XXX series) — flagship MVP product
  - placeholder for upcoming product lines x2
- Each product card should show: product name, brief description, origin (India), UK demand context, and a "Request Quote" CTA
- Individual product detail pages (`/products/[slug]`) with fuller spec sheets

#### 2.3 — About (`/about`)
- Company overview: what Vertex Metals does, Isle of Man incorporation, IOM substance compliance
- Team section: Jackson Paul and Martyn Bourner with roles and brief bios
- Trading model explainer: how the intermediary model works (without exposing sensitive commercial mechanics)
- Regulatory section: AML/KYC compliant, HMRC registrations, IOM FSA oversight

#### 2.4 — Compliance (`/compliance`)
- Public-facing compliance statement
- Summary of AML/KYC policy (not the full internal document — a buyer/supplier-facing summary)
- Sanctions screening policy statement
- No-cash policy statement
- CBAM readiness note (effective January 2027)
- Contact details for compliance queries

#### 2.5 — Contact & RFQ (`/contact`)
- Contact form with fields: Name, Company, Role, Email, Phone, Product interest (dropdown), Estimated quantity, Message
- Separate tabs or sections for: **Buyers** (UK companies) and **Suppliers** (Indian manufacturers)
- Company address: Apartment 3, Falcon Cliff Apartments, 9–10 Palace Road, Douglas, Isle of Man, IM2 4LD
- Email: sales@vertexmetalsltd.com
- Form submission should POST to an API route (`/api/contact`) that logs the enquiry (stub the email sending for now with a clear TODO)

---

## Phase 3: Internal Management Portal (Stub / Architecture)

The internal portal is auth-protected and will be built out in future sprints. In this phase:

1. Create the folder structure and routing for the portal under `/portal`
2. Create a login page stub (`/portal/login`) with email + password fields
3. Create a dashboard stub (`/portal/dashboard`) with placeholder cards for each planned module:
   - **RFQ Manager** — receive and manage buyer requests for quotation
   - **Supplier Quotes** — store FOB quotes from Indian suppliers with markup calculator
   - **Trade Files** — per-deal document store (LC, BOL, invoice, compliance docs)
   - **KYC/CDD Records** — counterparty onboarding and screening records
   - **Sanctions Screener** — log of screening checks per counterparty
   - **CBAM Tracker** — carbon intensity data per supplier (ready for 2027 UK CBAM)
   - **Contacts** — buyers and suppliers CRM
4. Add a note in each module stub: *"Module in development — Sprint 2"*
5. Implement basic route protection: any `/portal/*` route should redirect to `/portal/login` unless authenticated (use a simple cookie/session check stub for now)

---

## Phase 4: Design System

Create a `design-system.md` in `/docs` and a `variables.css` in `/src/styles/` that documents:

### Colour Palette
Derive from the reference URLs. If no references are yet provided, use this placeholder palette and note it should be updated:
- `--color-primary`: Deep navy or charcoal (trust, industrial)
- `--color-accent`: Amber or copper-gold (metals, premium)
- `--color-surface`: Off-white or very light grey
- `--color-text`: Near-black
- `--color-muted`: Mid grey for secondary text

### Typography
- Display/heading font: a distinctive, characterful font — avoid Inter, Roboto, Arial. Suggest sourcing from Google Fonts or Fontsource. Options: Neue Montreal, DM Serif Display, Playfair Display, Syne, or similar premium-feeling typefaces.
- Body font: clean and legible at small sizes
- Define a full type scale (xs through 5xl)

### Spacing & Layout
- Define spacing tokens (4px base grid)
- Max content width: 1280px
- Consistent section padding

---

## Phase 5: README & Documentation

Create a thorough `README.md` covering:
- Project overview and purpose
- Tech stack
- Folder structure explanation
- How to run locally (`npm run dev`)
- Environment variables required (`.env.example`)
- Planned module roadmap
- Contact: Martyn Bourner, martyn@vertexmetalsltd.com

---

## Key Business Context for the AI to Know

Use this context when making copy, content, and UX decisions:

- **Company**: Vertex Metals Ltd, Isle of Man incorporated, 0% IOM corporation tax
- **Business model**: Commodity trading intermediary — acts as principal, earns margin, does not hold physical stock
- **MVP product**: Aluminium Alloy Core Wire (EC Grade / 6XXX series) — India to UK
- **Suppliers**: Manufacturing clusters in Gujarat (Ahmedabad) and Odisha, India
- **Buyers**: UK industrial manufacturers — primarily West Midlands automotive (EV cabling), aerospace, and energy sectors
- **Key commercial advantage**: India–UK FTA (signed 2025) provides near tariff-free access; aluminium is a UK Critical Mineral (added March 2025); India's market share in aluminium core wire in UK grew 2,615% YoY
- **Regulatory compliance**: IOM FSA designated business; AML/KYC policy in place; no-cash policy; HMRC HVD registration pending; CBAM readiness programme underway
- **Future expansion**: Phase 2 — copper concentrate, lithium battery precursors; Phase 3 — lab-grown diamonds, silver jewellery
- **Website**: www.vertexmetalsltd.com
- **Primary email**: sales@vertexmetalsltd.com

---

## Constraints & Notes

- All copy must be accurate and professional — this is a regulated financial/trading business. Avoid hyperbole.
- Do not publish or expose any internal commercial mechanics (margin calculations, supplier names, ITDLC procedures) on the public-facing site.
- The compliance page copy should be factually accurate but written for buyers/suppliers — not a regulator.
- The RFQ form on the public site should **not** ask for payment terms or financial details — that happens post-qualification.
- Ensure the site is mobile-responsive from the start.
- Use semantic HTML throughout for accessibility.
- All forms should have basic client-side validation.

---

*Begin with Phase 1 (project setup and folder structure), then Phase 4 (design system, especially after reviewing reference URLs), then Phase 2 (public website pages). Phase 3 (portal) can follow in a subsequent session.*
