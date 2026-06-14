# Vertex Metals — Development Log

**Current Version:** v0.5.0  
**Branch:** main  
**Last updated:** June 2026  
**Built by:** Vector Business Solutions

The portal displays its current version number at the bottom of the sidebar (`js/portal/sidebar.js`, `PORTAL_VERSION`). Keep that constant in sync with "Current Version" above whenever this log is updated.

---

## Version History

| Version | Branch / PR | Summary |
|---------|-------------|---------|
| v0.1.0 | Initial commits | Public website (8 pages), Supabase client, basic contact form |
| v0.2.0 | portal-update-0105 (#15) | Full portal build — order lifecycle management, supplier PO, documents, shipment tracking, invoicing, state machine |
| v0.3.0 | dev-work-0205 (#25) | Verification queue, KYC/compliance screens, product lines & families, contacts CRM |
| v0.4.0 | RFQ-order-workflow (#29) | RFQ multi-line architecture, customer quote with magic link, scenario-based pricing, supplier quote request PDF, order draft mode, public contact form redesign, logo update, About Us quality copy |
| v0.5.0 | main (in progress) | ERP-style portal sidebar with new module sections, Sales/Customers homepages, and a full supplier onboarding redesign: 3-phase workflow (Stage 1 Quoting Only → Stage 2 Pre-Trade → Stage 3 Trade Ready) replacing the original 8-stage ISO 9001 flow, tier-based diligence (full vs simplified), sanctions screening + preliminary risk assessment moved into Stage 1 (KYC removed as a redundant separate layer), TOB generator, bank details capture, ESG/environmental fields, supplier reference numbers, and a tier-aware Financial Viability risk-scoring rubric. Also: redesigned customer detail page (sticky header, Overview/RFQs/Orders/Disputes/KYC tabs, Edit Customer modal, quick-action links into New RFQ / New Order); supplier detail page Products tab (link product lines to a supplier as "permitted to supply" via a new `pending` quote status, search-or-create against the product catalogue) and Edit Commercial Terms action, with the KYC tab removed from the supplier detail page entirely |

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

#### Supplier Onboarding (v0.5.0 — 3-Phase Model)

Replaces the original 8-stage ISO 9001 workflow with a 7-value `workflow_stage` model organised around trading readiness. Full detail in `docs/supplier-onboarding-process.md`.

```
draft → stage1_complete → pending_stage2 → awaiting_supplier_info → stage2_complete → trade_ready
                                                                                              (+ terminal: rejected)
```

1. **Stage 1 — Quoting Only** (`suppliers/onboard.html`) — company details (incl. QMS certification, export licence, generated supplier reference), address, primary contact, sanctions screening, and a preliminary risk assessment. Completing Stage 1 means the supplier is sanctions-checked, baseline-vetted, and ready to be quoted.
2. **Stage 2 — Pre-Trade** (`suppliers/pre-trade.html`) — sanctions/risk-assessment review (full-diligence only), ESG/environmental capture, masked bank details + verification, TOB (Terms of Business) generator with generate → send → confirm tracking, and recommendation (compliance) + decision (commercial) sign-off.
3. **Stage 3 — Trade Ready** (`suppliers/trade-ready.html`) — accepted/default currency, payment terms, standard incoterm, DPA document, and final trade-ready sign-off.

Diligence tiers (`OnboardingWorkflow.requiresFullDiligence()`): **full** (`manufacturing`, `materials_commodities`) gets sanctions re-screening and risk-assessment review in Stage 2; **simplified** (`logistics`, `packaging`, `service_provider`) skips those and reaches `stage2_complete` via ESG + bank details + TOB + recommendation/decision alone.

> **Flagged for review:** KYC was removed from the supplier onboarding process (2026-06-13) — supplier vetting is fully covered by the Stage 1/2 sanctions screening and risk assessment, so a separate KYC layer was redundant. The standalone KYC module (`portal/kyc/`, `js/portal/kyc.js`, `kyc_records` table) is unchanged and still used for **buyers**; a follow-up task should review how/where KYC fits the buyer onboarding process.

The risk assessment's **Financial Viability** criterion now has a tier-aware rubric: full-diligence suppliers (settled via Irrevocable Letter of Credit, which hedges Vertex's capital exposure) are scored on counterparty integrity / fraud and sanctions risk (`js/portal/onboard.js`, `FINANCIAL_CRITERION.full`); simplified-track suppliers keep the original creditworthiness-based rubric (`FINANCIAL_CRITERION.simplified`), which is still under review (see Known Issues).

The onboarding pipeline (`suppliers/onboarding-pipeline.html`) tracks active onboardings by stage and completed onboardings (`trade_ready`/`rejected`) over the last 90 days.

**Type-aware Stage 1 fields** (from a logistics supplier test runthrough): the Export Licence Number field is shown only for full-diligence suppliers (manufacturing, materials_commodities — only they export goods themselves); the QMS section is hidden entirely for `packaging` suppliers and is not a Stage 1 gate for them. The sanctions list links now point to the UK Sanctions List (UKSL), which replaced the OFSI Consolidated List from 28 January 2026.

#### Customer Detail Page (v0.5.0)

`portal/customers/detail.html` / `js/portal/customers-detail.js` rebuilt to match the supplier detail page's anatomy: a sticky header (company name, country, status) with a tab bar — **Overview** (key contact details, snapshot stats, recent activity), **RFQs**, **Orders**, **Disputes**, and **KYC**. An **Edit Customer** modal covers contact/address/commercial fields. Quick-action links jump to **New RFQ** and **New Order** pre-filled with the customer's details. Reached from the new Customers homepage (`portal/customers/index.html`, `js/portal/customers.js`) and Sales homepage.

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
| `20260612b_contacts_dispatch_address.sql` | Optional dispatch/warehouse address fields on `contacts`, separate from the registered company address |
| `20260612c_contacts_onboarding_v2_fields.sql` | `contacts` additions for onboarding v2: company phone, supplier reference (unique), export licence number, QMS certification fields, ESG/environmental fields, structured bank details, accepted currencies/payment terms/incoterm |
| `20260612d_supplier_onboarding_v2_stages.sql` | TOB tracking columns on `supplier_onboarding` (`tob_status`, `tob_generated_at/sent_at/confirmed_at`) and remap of `workflow_stage` from the old 8-value enum to the new 7-value 3-phase model |
| `20260612e_supplier_risk_assessment_review.sql` | `reviewed_at` / `reviewed_by` on `supplier_risk_assessment` — marks Stage 2 review/refinement of the Stage 1 preliminary risk assessment |
| `20260613_supplier_quotes_status_pending.sql` | Updates the `supplier_quotes.status` check constraint to allow a new `'pending'` value — represents a product line linked to a supplier as "permitted to supply" with no live quote yet (used by the supplier detail page's Products tab) |

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

- **KYC module decoupled from supplier onboarding (2026-06-13)** — KYC was removed from both the supplier onboarding Stage 1/2 flow and the supplier detail page tab bar as a redundant separate layer (supplier vetting is now fully covered by sanctions screening + risk assessment). The standalone KYC module (`portal/kyc/`, `js/portal/kyc.js`, `kyc_records` table) is untouched and remains in use for **buyers** (`dashboard.js`, `customers.js`, the customer detail page's KYC tab, `sidebar.js`). As a separate task, review how/where KYC should fit the buyer onboarding process.
- **Financial Viability rubric — simplified track** — the tier-aware rubric introduced this session (`FINANCIAL_CRITERION` in `js/portal/onboard.js`) gives full-diligence suppliers (manufacturing, materials_commodities) an LC-based counterparty-integrity scale. Simplified-track suppliers (logistics, packaging, service_provider) still use the original generic creditworthiness rubric as a placeholder — pending Martyn's own testing/definitions for those types (see "Next Development Stages" for the broader per-type criteria work this feeds into).
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

### Stage 8 — Supplier Onboarding: Type-Aware Wizard

Follow-on from the v0.5.0 onboarding redesign, driven by a logistics-supplier test runthrough which found that the single onboarding flow (`onboard.html` / `pre-trade.html`) doesn't fit non-materials supplier types well. In priority order:

1. ✅ **Supplier-type "profile" config (foundational)** — done. `SUPPLIER_TYPE_PROFILES` in `js/portal/supplier-onboarding.js` is now the single declarative config per supplier type (`diligenceTier`, `showQms`, `showExportLicence`, `riskCriteria`, `requiredDocs`), replacing the scattered conditionals (`FULL_DILIGENCE_TYPES`, the per-page `REQUIRED_DOCS` in `documents.js`, the QMS/export-licence visibility checks). Accessors: `getSupplierProfile()`, `requiresFullDiligence()`, `getRiskCriteria()`, `getRequiredDocs()`. `onboard.js`, `pre-trade.js`, and `documents.js` all read from this config.
2. ✅ **Risk assessment criteria set + weighting per supplier type** — done. `RISK_CRITERIA_WEIGHTS` (in `js/portal/supplier-onboarding.js`) drives `computeOverall(scores, criteria)`, which normalises a weighted sum over only the criteria applicable to the supplier's type (per `SUPPLIER_TYPE_PROFILES.riskCriteria`). Per-type criteria: manufacturing/materials_commodities score all 5; logistics drops `continuity`; packaging drops `quality` and `continuity`; service_provider drops `continuity`. **Weights are provisional defaults pending Martyn's review** (financial 25, quality 15, regulatory 25, geographic 15, continuity 20 — sum 100), same status as the existing flagged `FINANCIAL_CRITERION` simplified-track rubric below. **Existing assessments are not recomputed** — completed `supplier_risk_assessment` rows keep their stored `overall_score`/`risk_category` as frozen historical values under the old flat-average model; the weighted/type-aware model applies only to newly created Stage 1 assessments and Stage 2 reviews going forward.
   - **Severity floor** — a single criterion scored 5/5 (e.g. geographic risk for a FATF-blacklisted jurisdiction) forces the overall category to at least "high", and a 4/5 forces at least "medium", regardless of the weighted average — so a severe individual red flag can't be diluted away by a low criterion weight. Implemented in `riskCategory(overall, scores)`; the unescalated value is available via `riskCategoryFromScore(overall)`. When the floor changes the category, the onboard/pre-trade UI shows an "Escalated from {base}…" note under the score. The manual override checkbox remains available on top of this for cases the floor doesn't cover.
3. **Wizard-style step flow with dynamic progress bar** — convert Stage 1/2 from long scrollable pages into a stepper that shows only the steps relevant to the selected supplier type (driven by the config from (1)), updating the progress bar per step.
4. **Sanctions screening UX rework** — replace the single tool/result/notes form with a per-list checklist: determine which lists are required, link out to each, toggle when checked, and a checkbox per list that reveals a detail textbox if a match is found, triggering the appropriate rejection/escalation consequence. Best built as a step within the Stage 8.3 wizard.
5. **Country-based geographic-risk pre-fill** — pre-fill the geographic risk score based on the supplier's country (e.g. UK → low). Needs a country dropdown in Stage 1 (currently free text) and a simple country-risk reference mapping for known trading countries as a v1, rather than sourcing a full country-risk database.

### Stage 9 — Supplier Permissions by Onboarding Stage / Risk Category

Introduce a capability matrix that gates what a supplier can be used for in the portal, derived from its `workflow_stage` and `supplier_risk_assessment.risk_category`. For example, a `stage1_complete` ("Ready to Quote") supplier might have:

- ✅ Receive enquiries
- ✅ Submit indicative pricing
- ✅ Upload product specs
- ❌ No contracts
- ❌ No purchase orders
- ❌ No payments

with additional capabilities (contracts, purchase orders, payments/bank details) unlocking at `stage2_complete` / `trade_ready`, and high-risk suppliers potentially capped below the capabilities their stage would otherwise allow. Needs design work to define the full stage × risk-category capability matrix, where it's enforced (RFQ/supplier-quote selection, supplier PO drafting, payment fields), and how it's surfaced on the supplier detail page (e.g. a "Permissions" panel showing the ✅/❌ list above).

> **Phase 1 done (2026-06-13):** the supplier detail page (`portal/suppliers/detail.html` / `js/portal/suppliers-detail.js`) was rebuilt around this idea as a read-only, derived switchboard — `OnboardingWorkflow.computePermissions()` returns on/off + reason for `appear_in_quotes`/`receive_rfq`, `receive_supplier_po`, and `outbound_payments`, shown in the Overview tab's Permissions card and summarised in the sticky header (`capabilitySummary()`). This is computed on the fly from `workflow_stage`, `approval_status` and `bank_account_verified_in_name` — no new tables, no override UI.
>
> **Follow-up (2026-06-13):** the KYC tab was removed from the supplier detail page entirely (separate from the earlier onboarding-flow KYC removal above — suppliers have no remaining KYC surface). A new **Products** tab lets staff search the product catalogue and link a product line to the supplier via `supplier_quotes` with a new `status = 'pending'` ("permitted to supply, no live quote yet") — a lightweight linking action that doesn't force full quote/pricing entry, with a fallback "Add a new product line" link (`product-lines/index.html?action=new`) if the product doesn't exist yet. Existing `.eq('status','active')` filters across the portal naturally exclude `pending` rows. The Commercial tab gained an **Edit Commercial Terms** action (modal) for editing accepted currencies, default currency, standard incoterm, payment terms, and export licence number post-onboarding — previously these were only set during onboarding with no later edit path.
>
> **Phase 2 (not built):** per `project files/supplier-page-spec.md` §2/§5 —
> - A real `Permissions` table with manual override + reason, recorded as an `EvidenceEvents`-style decision (actor, reason, timestamp) rather than a silent flag flip.
> - Bank-details changes as a **controlled, flagged event**: editing `bank_*` fields on `contacts` should log an evidence entry and reset `bank_account_verified_in_name` pending re-verification, rather than the current quiet form edit (`submitEditBank` in `suppliers-detail.js`).
> - **Screening-decay auto-revert**: when `last_sanctions_screened_at` exceeds the 90-day (pre-trade) / 6-month (periodic) policy windows, automatically flag the supplier (e.g. revert `trade_ready` → `review_required` or an equivalent flag) rather than relying on the staleness badge a human has to notice. The Overview/Compliance tabs currently only *display* staleness (`sanctionsStaleness()`), they don't act on it.
> - Full multi-role `Counterparty` model (`GoodsSupplier`/`LogisticsProvider`/`PackagingSupplier` as roles on one entity) — out of scope while Vertex has a single supplier type in production.

---

## Development Notes

- **No build step** — vanilla HTML/CSS/JS. Files are served as-is. No npm, no bundler. Edit files directly and refresh the browser.
- **Local dev** — VS Code Live Server on port 5500. Share on local network via `http://{your-ip}:5500`.
- **Supabase** — all DB changes require running SQL in the Supabase SQL Editor. Migration files are in `docs/migrations/`. The `supabase-schema.md` schema reference is partially out of date and should be regenerated periodically.
- **CSS** — no hex values outside `css/variables.css`. Use `var(--token-name)` everywhere. Exception: dynamically injected `innerHTML` in JS — use hardcoded hex values (e.g. `#0a1728` for navy) as CSS variables do not reliably resolve in this context.
- **XSS** — all portal JS uses `esc()` helper before writing user data into `innerHTML`. Never use raw string interpolation with DB-sourced values.
- **State machine** — order state transitions go through Supabase RPC functions via `StateMachine.transition()`. Never write directly to `trades.current_state`.
- **Branching** — feature work in named branches, merge to `main` via PR. Current naming convention: descriptive kebab-case (e.g. `RFQ-order-workflow`).
