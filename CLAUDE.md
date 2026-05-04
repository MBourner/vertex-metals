# Vertex Metals — Claude Context

## Project

Vertex Metals Ltd is a B2B commodity trading intermediary incorporated on the Isle of Man. Pre-revenue startup trading metals (primarily aluminium alloy core wire, EC Grade / 6XXX series, India → UK) with plans to expand to copper, stainless steel, and critical minerals.

**Directors:** Jackson Paul (sales, supplier/buyer relationships), Martyn Bourner (operations, tech)  
**Address:** Apartment 3, Falcon Cliff Apartments, 9–10 Palace Road, Douglas, Isle of Man, IM2 4LD  
**Email:** sales@vertexmetalsltd.com

## Tech Stack

Vanilla HTML/CSS/JS — no framework, no Node.js, no npm, no bundler. Files are served as-is; there is no build step.

- **Database + Auth:** Supabase (PostgreSQL + GoTrue)
- **Email (TODO):** Supabase DB webhook → Edge Function → Resend

## Directory Structure

```
vertex-metals/
├── index.html, about.html, products.html, ...   # Public website (8 pages)
├── products/                                    # Product detail pages
├── portal/                                      # Internal portal (auth-gated) — see portal/CLAUDE.md
├── css/                                         # Shared stylesheets
├── js/                                          # Shared + portal JS modules
├── assets/                                      # Images, video, icons
└── docs/                                        # Architecture & schema reference docs
```

Full directory detail: `docs/architecture.md`  
Database schema + RLS policies: `docs/supabase-schema.md`

## CSS Architecture

Load order in every `<head>` (order matters — variables must come first):

```html
<link rel="stylesheet" href="/css/variables.css" />   <!-- design tokens -->
<link rel="stylesheet" href="/css/base.css" />        <!-- reset + typography -->
<link rel="stylesheet" href="/css/components.css" />  <!-- buttons, cards, forms, tables, modals, badges -->
<link rel="stylesheet" href="/css/layout.css" />      <!-- public pages: nav, hero, sections, footer -->
<!-- OR for portal pages: -->
<link rel="stylesheet" href="/css/portal.css" />      <!-- portal: sidebar, topbar, portal layout -->
```

**Rule:** No hex values outside `variables.css`. All colours are custom properties on `:root`. Always use `var(--token-name)` in component styles.

## Design System

- **Navy:** `#0a1728` (dark sections, portal bg)  — `--color-navy`
- **Steel blue:** `#7ab8d4` (primary interactive, accents)  — `--color-steel`
- **Surface:** `#f4f5f7` (page background)  — `--color-surface`
- **Headings:** Syne (Google Fonts) — geometric, wide-tracked
- **Body:** DM Sans (Google Fonts)

Aesthetic: premium industrial B2B. Dark hero sections with steel-blue accents. Clean white content areas.

## Copy & UX Tone

Professional, factual, no hyperbole. Vertex Metals is a regulated B2B trade business. Do not expose commercial mechanics (margins, sourcing strategy, counterparty names) on the public site.
