# Architecture — Vertex Metals

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — no framework, no build step |
| Hosting | Static file server (e.g. Netlify, Vercel, or any CDN) |
| Database + Auth | Supabase (PostgreSQL + GoTrue) |
| Email notifications | Supabase Database Webhooks → Edge Function → Resend (TODO) |

No Node.js, no npm, no bundler. Files are served as-is.

---

## Directory Structure

```
vertex-metals/
├── index.html                  # Public homepage
├── products.html               # Products index
├── about.html
├── compliance.html
├── contact.html
│
├── products/
│   └── aluminium-alloy-core-wire.html
│
├── portal/                     # Internal portal (auth-gated)
│   ├── login.html
│   ├── dashboard.html
│   ├── rfq/
│   │   ├── index.html
│   │   └── detail.html
│   ├── quotes/
│   │   ├── index.html
│   │   └── calculator.html
│   ├── trades/
│   │   ├── index.html
│   │   └── detail.html
│   ├── kyc/
│   │   ├── index.html
│   │   └── detail.html
│   ├── contacts/
│   │   └── index.html
│   └── cbam/
│       └── index.html
│
├── css/
│   ├── variables.css           # Design tokens (colours, type, spacing)
│   ├── base.css                # Reset + typography
│   ├── components.css          # Buttons, cards, forms, tables, modals, badges, alerts
│   ├── layout.css              # Nav, hero, sections, footer
│   └── portal.css              # Sidebar, topbar, portal layout
│
├── js/
│   ├── supabase-client.js      # Supabase init (URL + anon key)
│   ├── auth.js                 # signIn, signOut, getSession, getCurrentUser, requireAuth
│   ├── portal-guard.js         # IIFE: hide body → requireAuth → show body
│   ├── contact-form.js         # Public RFQ form logic
│   └── portal/
│       ├── dashboard.js
│       ├── rfq.js
│       ├── calculator.js
│       ├── quotes.js
│       ├── trades.js
│       ├── kyc.js
│       ├── contacts.js
│       └── cbam.js
│
├── assets/
│   └── images/
│       └── logo/
│           └── vertex-metals-logo.jpg
│
└── docs/
    ├── architecture.md         # This file
    ├── supabase-schema.md      # Full CREATE TABLE SQL + RLS policies
    └── design-system.md        # Colour palette, typography, spacing
```

---

## Authentication Flow

```
User visits portal page
       │
       ▼
portal-guard.js (IIFE)
  → document.body.style.visibility = 'hidden'
  → await requireAuth()          ← auth.js
        │
        ├── session valid → body.visibility = 'visible'  → page loads
        └── no session   → redirect to /portal/login.html
```

`requireAuth()` calls `supabaseClient.auth.getSession()`. Supabase stores the JWT in `localStorage` automatically; no manual session handling needed.

---

## Supabase Data Model

```
contacts ──────────────────────────────────────────┐
    │                                               │
    ├── rfq_submissions (anon insert, auth read)    │
    ├── supplier_quotes (supplier_id → contacts)    │
    ├── trades          (buyer_id, supplier_id)     │
    ├── kyc_records     (contact_id, 1:1 preferred) │
    └── cbam_records    (supplier_id → contacts)    │
                          trade_id → trades ────────┘
```

Full CREATE TABLE statements and RLS policies: see [supabase-schema.md](supabase-schema.md).

---

## CSS Architecture

Load order in every HTML `<head>`:

```html
<link rel="stylesheet" href="/css/variables.css" />
<link rel="stylesheet" href="/css/base.css" />
<link rel="stylesheet" href="/css/components.css" />
<link rel="stylesheet" href="/css/layout.css" />   <!-- public pages -->
<!-- OR -->
<link rel="stylesheet" href="/css/portal.css" />   <!-- portal pages -->
```

`variables.css` is imported by `base.css` via `@import`. All design tokens are custom properties on `:root`; **no hex values should appear outside `variables.css`**.

---

## Portal Module Pattern

Each portal JS file follows the same pattern:

1. `esc(s)` helper — XSS-safe string escaping (always use for user-supplied data in innerHTML)
2. `loadXxx()` — fetches from Supabase, renders into `<tbody id="xxx-body">`
3. `buildXxxForm()` — returns HTML string for the add/edit modal
4. `submitXxx(event)` — reads form, validates, INSERTs/UPDATEs via Supabase
5. IIFE at bottom — calls `getCurrentUser()`, sets email, then calls `loadXxx()`

---

## Email Notifications (TODO)

To avoid exposing API keys client-side, use:

1. **Supabase Database Webhook** on `rfq_submissions` INSERT
2. → calls a **Supabase Edge Function** (`notify-rfq`)
3. → Edge Function sends email via **Resend** (server-side API key stored as Edge Function secret)

This pattern keeps the Resend API key entirely server-side.
