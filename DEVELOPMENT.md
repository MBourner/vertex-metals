# Vertex Metals — Development Log

**Current Version:** v0.4.0  
**Branch:** main  
**Last updated:** May 2026  
**Built by:** Vector Business Solutions

---

## Version History

| Version | Branch / PR | Summary |
|---------|-------------|---------|
| v0.1.0 | Initial commits | Public website (8 pages), Supabase client, basic contact form |
| v0.2.0 | portal-update-0105 (#15) | Full portal build — order lifecycle management, supplier PO, documents, shipment tracking, invoicing, state machine |
| v0.3.0 | dev-work-0205 (#25) | Verification queue, KYC/compliance screens, product lines & families, contacts CRM |
| v0.4.0 | RFQ-order-workflow (#29) | RFQ multi-line architecture, customer quote with magic link, scenario-based pricing, supplier quote request PDF, order draft mode, public contact form redesign, logo update, About Us quality copy |

---

## What Has Been Built

### Public Website

Eight public pages with full navigation, responsive mobile layout, and Supabase-connected contact form.

- **index.html** — Hero, value proposition, sectors teaser (Energy, Automotive, Telecoms, Oil & Gas), product highlights, how it works
- **products.html** — Product families overview with links to detail pages
- **products/** — Six individual product detail pages: Aluminium, Copper, Stainless Steel, Mild Steel, Other Metals, Critical Minerals
- **about.html** — Company overview, trading model, ISO/quality standards, director bios (currently hidden for privacy)
- **industries.html** — Sectors served in detail
- **compliance.html** — AML/KYC policy, sanctions, CBAM, quality standards
- **sustainability.html** — ESG and responsible sourcing
- **partners.html** — Supplier partner registration
- **contact.html** — Buyer enquiry form with cascading product family → product line selection (live from Supabase), specification field, quantity with unit selector, success confirmation in-place

### Internal Portal

Auth-gated management system at `/portal/`. All data in Supabase (PostgreSQL + GoTrue).

#### RFQ Workflow (v0.4.0 — multi-line)

The full RFQ-to-order flow:

1. **RFQ received** — from the public contact form or added manually in the portal
2. **Enquiry tab** — customer details, specifications, and a structured **Quote Lines** panel where primary and alternative lines are defined before supplier quotes are requested. Auto-creates Line 1 from the enquiry product selection.
3. **Cost Inputs tab** — supplier quotes (per-MT, per-piece, or total price), logistics quotes (per-MT or flat fee), overhead costs (import duty, customs). Supplier quotes grouped by supplier as **pricing scenarios**. Supplier/logistics quote PDF request generator.
4. **Pricing tab** — scenario-based multi-line calculator. Select a supplier scenario; per-line cost breakdown (FOB → freight → insurance → overheads → landed → margin → sell price). Logistics flat fees split proportionally by quantity.
5. **Build Quote tab** — pre-populated from priced lines. Customer address pre-filled from contacts. Payment terms dropdown. T&Cs placeholder. Publishes as a branded customer-facing quote.
6. **Customer tab** — magic link displayed for sending to customer. Quote status tracking (issued → sent → accepted → rejected).

#### Customer-Facing Quote Page

Public page at `/customer-quote/?token={uuid}` — branded HTML quote viewable by the customer via magic link. Accept button, PDF download via html2pdf.js. Accepting updates both the customer quote and RFQ status to "accepted".

#### Order Lifecycle

1. **Draft Order** — created from an accepted customer quote. No automatic verification submission; operator completes details and documents first.
2. **Edit Order** — `orders/new.html` with full fields including quantity unit support.
3. **Submit for Verification** — manual action from order detail page with priority selector (Routine 24h / Expedite 4h).
4. **PO Translation queue** — verifier cross-checks order against customer PO and source RFQ (link provided).
5. **Supplier PO drafting** — select approved supplier, load from supplier quote (per-piece / per-MT / total), live cost estimate and margin check, payment terms dropdown.
6. **Supplier PO approval queue** — separate verification step.
7. **Document collection** — bills of lading, certificates of origin, mill test reports.
8. **Shipment tracking** — sea freight legs, ETA tracking.
9. **Invoicing and settlement** — invoice drafted, reviewed, issued; payment tracking.

#### Other Portal Modules

- **Verification Queue** — unified queue for all verification types (PO translation, supplier PO approval, invoice review, release approval). Source RFQ link on PO translation items.
- **Contacts CRM** — buyers, suppliers, logistics providers. Address fields, VAT number, AML/KYC status, sanctions screening log, audit history.
- **Product Lines** — product catalogue with families, CN codes, default markup %, VAT rate, insurance %, standard sell price and market reference price. Used throughout the pricing calculator.
- **Supplier Quotes** — library of supplier quotes, linkable to RFQ lines. Per-piece, per-MT, and total price bases.
- **Logistics Quotes** — freight quotes with flat fee or per-MT pricing.
- **KYC Records** — counterparty due diligence tracking.
- **CBAM Tracker** — carbon intensity data for imports.
- **Pricing Calculator** — standalone tool for ad-hoc pricing calculations.
- **Financials / Metrics / Dashboard** — reporting and overview screens.
- **Concessions / Disputes** — post-trade issue management.

### Database Migrations Applied

| File | Purpose |
|------|---------|
| `phase-6-rfq-quoting.sql` | `customer_quote_lines`, `rfq_overhead_costs`, logistics flat fee, magic link RLS, contact address fields, `specifications` on `rfq_submissions` |
| `phase-7-rfq-lines.sql` | `rfq_lines` table, `rfq_line_id` / pricing basis / per-piece price on `supplier_quotes`, `quantity_unit` on `rfq_submissions`, `trades`, `customer_quote_lines` |
| `product-catalogue-seed.sql` | 6 product families, 35 product lines with CN codes, VAT and insurance rates |

Additional one-off SQL applied directly (not in migration files):
```sql
ALTER TABLE supplier_quotes ALTER COLUMN fob_price_usd DROP NOT NULL;
ALTER TABLE customer_quotes ALTER COLUMN sell_price_per_mt_gbp DROP NOT NULL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS quantity_unit text DEFAULT 'MT';
ALTER TABLE rfq_submissions ADD COLUMN IF NOT EXISTS quantity_unit text DEFAULT 'MT';
ALTER TABLE customer_quotes DROP CONSTRAINT customer_quotes_status_check;
ALTER TABLE customer_quotes ADD CONSTRAINT customer_quotes_status_check
  CHECK (status IN ('draft','issued','sent','accepted','rejected','expired'));
```

---

## Known Issues & Items to Revisit

### High Priority

- **Email notifications not yet live** — the full flow (Supabase DB webhook → Edge Function → Resend) is designed and documented in `js/contact-form.js` but not implemented. New RFQs, published customer quotes, and order state changes should all trigger email notifications. Requires Supabase Edge Function setup and a Resend account with API key stored as an environment variable.
- **Customer portal login** — customers currently access quotes only via magic link (one-time / expiry-linked). A returning customer portal with saved order history and re-quote requests has not been built. The magic link approach is sufficient for MVP but a proper customer account system is a near-term need.
- **Terms & Conditions placeholder** — the T&Cs field in the Build Quote tab pre-fills with placeholder text. Final legal T&Cs wording needs to be inserted (consult legal if required) and hardcoded as the default.

### Medium Priority

- **Multi-product enquiry on the contact form** — currently one product family/line per submission. Planned as a "quote basket" feature for the public site. For now, customers add additional products in the spec/message field and we add lines manually in the portal.
- **Supabase Storage bucket not yet created** — the `rfq-documents` bucket (for supplier/logistics quote PDF uploads) is referenced in the code but must be created in the Supabase dashboard (Storage → New bucket → `rfq-documents`, private). Without it, document upload in the Cost Inputs tab will fail silently.
- **`default_markup_pct` not set on product lines** — the product catalogue was seeded with CN codes, VAT, and insurance rates but `default_markup_pct`, `standard_sell_price_gbp`, and `market_reference_price_gbp` are all null. The pricing calculator falls back to 10% margin but correct margins should be set via the Product Lines page.
- **Supplier contacts missing address data** — the contacts page now has address fields but existing contacts were created before these were added. The Supplier PO and quote request PDF "To:" sections will be blank until contacts are updated.
- **Order quantity for non-MT units** — when converting an RFQ with pieces quantity to an order, `quantity_mt` is stored as null. The order edit form, supplier PO, and some display areas handle this gracefully, but the pricing calculator (standalone, not the RFQ one) still assumes MT throughout.

### Low Priority / Polish

- **Director bios on About Us** — hidden for privacy reasons. The section is commented out in `about.html` with a clear note to reinstate. Re-enable when directors are comfortable with public disclosure.
- **Product pages still reference aluminium wire as the launch product** — the products/aluminium-alloy-core-wire.html page still has India-specific supplier references. Now that the business has pivoted to a broader multi-product model, these pages may need a copy review.
- **Verification queue RLS** — the verification queue currently allows any authenticated user to see and act on all queue items regardless of role. Four-eyes constraints are enforced (drafter cannot approve their own items) but finer-grained role-based access control (e.g. only Finance role sees invoice review items) has not been applied.
- **PDF output quality** — the customer-facing quote PDF (html2pdf.js) renders well for simple quotes but may paginate awkwardly for quotes with many line items. Long quotes with 6+ lines may need a CSS page-break rule.

---

## Next Development Stages

### Stage 1 — Email Notifications (immediate operational need)

Set up Supabase DB webhook → Edge Function → Resend for:
- New RFQ received → notify `sales@vertexmetalsltd.com`
- Customer quote published → send magic link email to customer
- Order state changes (verified, shipped, invoiced) → notify relevant parties

### Stage 2 — Customer Portal

A lightweight authenticated area for returning buyers:
- View all their quotes and orders
- Download documents
- Request re-quotes
- Submit new enquiries with pre-filled company details

This removes the reliance on magic links for returning customers and enables longer-term buyer relationships.

### Stage 3 — Quote Basket (Public Site)

Allow buyers to select multiple product lines on the public site and submit them as a single multi-line enquiry — directly populating `rfq_lines` in the portal on submission. Removes the need for portal operators to manually add additional lines.

### Stage 4 — Supplier Self-Service

A supplier-facing portal or email-based workflow where:
- Suppliers receive quote requests by email (with a link)
- They can submit their quote via a form rather than by email
- Quotes are automatically entered into the portal and linked to the correct RFQ lines

### Stage 5 — Automated Pricing & Market Data

- Pull live LME/market reference prices into `product_lines.market_reference_price_gbp` via a scheduled job or API
- Trigger automatic repricing alerts when market prices move beyond a threshold
- Connect live exchange rate feeds to the pricing calculator

### Stage 6 — CBAM Reporting

- Automated CBAM reporting using carbon intensity data collected during trade execution
- Export in the required format for HMRC submission
- Track embedded CO₂ per product family

### Stage 7 — ISO 9001 Accreditation Readiness

- Internal audit workflow for supplier re-qualification
- Document retention policy enforcement
- Management review reporting pack (trade volume, margin analysis, dispute rate, supplier audit status)

---

## Development Notes

- **No build step** — vanilla HTML/CSS/JS. Files are served as-is. No npm, no bundler. Edit files directly and refresh the browser.
- **Local dev** — VS Code Live Server on port 5500. Share on local network via `http://{your-ip}:5500`.
- **Supabase** — all DB changes require running SQL in the Supabase SQL Editor. Migration files are in `docs/migrations/`. The `supabase-schema.md` schema reference is partially out of date and should be regenerated periodically.
- **CSS** — no hex values outside `css/variables.css`. Use `var(--token-name)` everywhere. Exception: dynamically injected `innerHTML` in JS — use hardcoded hex values (e.g. `#0a1728` for navy) as CSS variables do not reliably resolve in this context.
- **XSS** — all portal JS uses `esc()` helper before writing user data into `innerHTML`. Never use raw string interpolation with DB-sourced values.
- **State machine** — order state transitions go through Supabase RPC functions via `StateMachine.transition()`. Never write directly to `trades.current_state`.
- **Branching** — feature work in named branches, merge to `main` via PR. Current naming convention: descriptive kebab-case (e.g. `RFQ-order-workflow`).
