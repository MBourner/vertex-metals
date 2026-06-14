# Supplier Onboarding Process — Vertex Metals Portal

**Version:** 3.0 (3-Phase / Trading-Readiness Redesign)
**Last updated:** June 2026
**Supersedes:** Version 2.0 (ISO 9001 8-stage redesign)

---

## Roles

| Role | Person | Portal Role Value | Responsibilities |
|------|--------|-------------------|------------------|
| Director — Commercial | Jackson Paul | `director_commercial` | Supplier identification, enquiry assessment, intake, Stage 1 registration, final approval/rejection decision, annual audit of sample onboarding decisions |
| Director — Operations & Compliance | Martyn Bourner | `director_compliance` | Sanctions screening, risk assessment, document collection, ESG/bank/TOB vetting, recommendation |

Either director can complete Stage 1 or Stage 2 — role-specific form sections (recommendation vs. final decision) are gated inside `onboard.js`/`pre-trade.js`, not by page access.

---

## Why this redesign

UAT of the earlier 8-stage ISO 9001 workflow found it too granular and front-loaded too much compliance work before a supplier could even be quoted. Onboarding is now organised around **trading readiness**:

- **Stage 1 — Quoting Only**: a baseline compliance check (sanctions screening, a preliminary risk assessment, QMS capture) clears before a supplier is "Ready to Quote". Vertex Metals should never issue a quote to a sanctioned entity, but full vetting doesn't need to block quoting.
- **Stage 2 — Pre-Trade**: a consolidated vetting refinement pass — ESG, bank details + verification, Terms of Business (TOB), and the recommendation/decision — plus, for full-diligence suppliers, a review of the Stage 1 sanctions/risk work.
- **Stage 3 — Trade Ready**: final commercial sign-off (currencies, payment terms, incoterm, DPA) before the supplier can be attached to a trade.

> **Flagged for review (2026-06-13):** a separate KYC layer for suppliers was removed as redundant — Stage 1/2 sanctions screening and risk assessment already cover supplier due diligence. The standalone KYC module (`portal/kyc/`, `js/portal/kyc.js`, `kyc_records` table) is unchanged and remains in use for **buyers**; a follow-up task should review how/where it fits the buyer onboarding process.

---

## Workflow Stages

`supplier_onboarding.workflow_stage` is a 7-value, app-enforced enum (no DB CHECK constraint):

```
draft                   ──► Stage 1 in progress ("Pending Stage 1" on the pipeline)
stage1_complete         ──► Stage 1 Complete (Ready to Quote)
pending_stage2          ──► Stage 2 in progress
awaiting_supplier_info  ──► Stage 2 paused, waiting on the supplier
stage2_complete         ──► Stage 2 Complete
trade_ready             ──► Final — supplier can be attached to trades
rejected                ──► Terminal — reachable from any non-terminal stage
```

```
Website contact form ──► Supplier Enquiry (portal)
                                │
                      Jackson reviews enquiry
                                │
            ┌───────────────────┴───────────────────┐
          Decline                                  Convert
    (reason recorded)                                 │
                                          ┌────────────▼────────────┐
                                          │   STAGE 1 — onboard.html │
                                          │   "Quoting Only"         │
                                          │   workflow_stage:        │
                                          │   draft → stage1_complete│
                                          └────────────┬────────────┘
                                                        │  Ready to Quote
                                          ┌─────────────▼─────────────┐
                                          │  STAGE 2 — pre-trade.html  │
                                          │  "Pre-Trade Vetting"       │
                                          │  pending_stage2 ⇄          │
                                          │  awaiting_supplier_info    │
                                          │  → stage2_complete         │
                                          └─────────────┬─────────────┘
                                                        │
                                          ┌─────────────▼─────────────┐
                                          │ STAGE 3 — trade-ready.html │
                                          │  "Trade Ready Sign-off"    │
                                          │  → trade_ready             │
                                          └─────────────┬─────────────┘
                                                        │
                                                  Trade Ready
```

Any non-terminal stage may end in **Rejected**. A rejection reason is mandatory and recorded in `supplier_audit_trail` (`rejection_decision`). Jackson (a `director_commercial` user) can start a new onboarding for a rejected supplier if circumstances change.

---

## Diligence Tiers

`contacts.supplier_type` determines which Stage 1 / Stage 2 sections apply:

| Tier | Supplier types | Programme |
|---|---|---|
| **Full** | `manufacturing`, `materials_commodities` | Stage 2 includes the Sanctions Screening Review and Risk Assessment Review panels — the Stage 1 sanctions screen must be re-confirmed (re-screened if >12 months old) and the preliminary risk assessment must be marked `reviewed_at` before `stage2_complete`. |
| **Simplified** | `logistics`, `packaging`, `service_provider` | Stage 2 Sanctions Screening Review and Risk Assessment Review panels are hidden entirely; the Stage 1 sanctions screen and preliminary risk assessment stand as-is. |

Sanctions screening and the preliminary risk assessment are required for **all** supplier types at Stage 1. QMS capture is required for all types **except `packaging`**, where the QMS field is hidden entirely (not a meaningful signal for that supplier type). The Export Licence Number field is shown only for full-diligence suppliers (`manufacturing`, `materials_commodities`) — only suppliers exporting goods themselves need it, so it's hidden for `logistics`, `packaging`, and `service_provider`.

> *Future enhancement (out of scope for this version):* a per-country list of export-licensing/regulatory requirements. Stage 1 currently captures a single generic "Export Licence Number (if applicable)" field (`contacts.export_licence_number`).

---

## Pre-Stage: Supplier Enquiry

### Source 1 — Website contact form (Partners/Suppliers page)

Submission creates a `supplier_enquiries` row with `source = 'website_form'` and `status = 'new'`. The portal surfaces this in Jackson's **Enquiry Queue**.

### Source 2 — Manual entry by Jackson

Jackson can also raise an enquiry manually in the portal (`source = 'manual_entry'`) for suppliers he has identified directly.

### Jackson's review

**Decline:** Sets `status = 'declined'`, enters a decline reason. The enquiry record is retained with full audit trail. No further action.

**Convert:** Creates a formal `supplier_onboarding` record (`workflow_stage = 'draft'`), links it via `converted_to_onboarding_id`, sets `status = 'converted'`, and opens Stage 1 (`onboard.html`).

---

## Stage 1 — Quoting Only (`portal/suppliers/onboard.html`, `js/portal/onboard.js`)

Stage 1 is a multi-panel page. A draft can be saved and resumed at any point ("Save Progress & Exit" → `workflow_stage = 'draft'`).

### 1. Company Details

- Company name, registration/incorporation number, country, supplier type, VAT number, website, beneficial owner
- **Company Main Phone Number** (`contacts.company_phone`)
- **Export Licence Number (if applicable)** (`contacts.export_licence_number`) — generic field, no country-specific validation. Shown only for full-diligence suppliers (`manufacturing`, `materials_commodities`); hidden for `logistics`, `packaging`, `service_provider`, which don't export goods themselves
- **Quality Management System** (`contacts.qms_certification`): `None` / `ISO 9001` / `IATF 16949` / `Other`, with conditional certificate reference (`qms_certificate_ref`) and expiry date (`qms_expiry`) shown unless "None". Hidden entirely for `packaging` suppliers
- **Supplier Reference** (`contacts.supplier_reference`, read-only) — generated on first save via `OnboardingWorkflow.generateSupplierReference()` (format `VS-YYYY-XXXXX`), unique across `contacts`

### 2. Company Address (+ optional dispatch/warehouse)

Registered/HQ address (line 1/2, city, postcode, country). A separate dispatch/warehouse address is only captured if it differs from the registered address.

### 3. Primary Contact

Primary contact name, email, phone.

### 4. Sanctions Screening (all supplier types)

Martyn or Jackson screens the supplier against:

| List | |
|---|---|
| UK | UK Sanctions List (UKSL) — replaced the OFSI Consolidated List from 28 January 2026 |
| UN | Security Council Consolidated List |
| EU | Sanctions Map |

Result (`result`, `screened_at`, `tool_used`, `match_resolution_notes`) is recorded as a `sanctions_screens` row (`subject_type = 'contact'`, `subject_id = contacts.id`). A confirmed match triggers rejection (`OnboardingWorkflow.rejectOnboarding`) rather than allowing Stage 1 to complete.

### 5. Preliminary Risk Assessment (all supplier types)

Guided scoring form, written to a new `supplier_risk_assessment` row (`onboarding_id` = this onboarding):

| Criterion | Score (1–5) | 1 = Very Low Risk, 5 = Very High Risk |
|-----------|-------------|---------------------------------------|
| Financial viability | | Definition is tier-dependent — see below |
| Quality certification | | ISO 9001, IATF, or equivalent held — informed by (but not a copy of) the QMS field above |
| Regulatory compliance | | Licensing, permits, export controls |
| Geographic risk | | Country sanctions exposure, political stability |
| Supply continuity | | Single-source risk, production capacity |

**Financial viability — full-diligence (`manufacturing`, `materials_commodities`)**: these suppliers are settled by Irrevocable Letter of Credit, which hedges Vertex Metals' capital exposure if goods are not shipped — so the score reflects counterparty integrity and fraud/sanctions risk rather than balance-sheet strength:

| Score | Definition |
|-------|------------|
| 1 — Strong | Publicly listed, state-owned enterprise, or provides full audited accounts (e.g. SAIL) |
| 2 — Good | Private entity, but provides verified tax certificates, active export licences, and evidence of recent international shipments |
| 3 — Acceptable (with LC) | Private entity, limited public footprint, but banking details match corporate registry and quality is independently verified (e.g. ASI reports) |
| 4 — Elevated risk | Newly incorporated (under 12 months), missing tax documentation, or pushing for non-standard payment terms — requires MLRO sign-off |
| 5 — Unacceptable | Cannot provide basic corporate registration, requests third-party payments, or matched on adverse media/sanctions |

**Financial viability — simplified track (`logistics`, `packaging`, `service_provider`)**: these suppliers are paid directly by Vertex on standard terms, so traditional creditworthiness applies. Definition unchanged for now (1 = strong/audited accounts … 5 = no financial information obtainable) — *under review, may be revised separately*.

The Stage 1 form (`onboard.html`) swaps the Financial Viability description and score options automatically based on the selected supplier type. The Stage 2 Risk Assessment Review panel (`pre-trade.html`, full-diligence only) always shows the LC-based definitions.

Overall score (average) and derived category:

| Score | Risk Category |
|-------|--------------|
| 1.0 – 2.3 | Low |
| 2.4 – 3.6 | Medium |
| 3.7 – 5.0 | High |

The assessor can override the computed category with a mandatory reason (`risk_category_override`, `risk_category_override_reason`). For full-diligence suppliers this assessment is **preliminary** — it is reviewed and refined in Stage 2 (see below). For simplified-track suppliers, this assessment stands as final.

### Completing Stage 1

**"Complete Stage 1 — Ready to Quote"** runs `checkGates(onboarding, contact, 'stage1_complete')`, which requires:

- Company name, registration number, country, supplier type, primary contact name, email, supplier reference all set
- `qms_certification` recorded (any of the four values, including `'none'`, satisfies the gate) — **not required for `packaging` suppliers**, where the field is hidden
- A `sanctions_screens` row exists for this contact
- A `supplier_risk_assessment` row exists for this onboarding

On success: `workflow_stage → 'stage1_complete'`, `vetting_assigned_to` set, `stage_advanced` (+ `onboarding_created` / `enquiry_converted` where applicable) logged. The supplier is now **Ready to Quote** — `supplier_quotes` can reference it — and appears with a "Begin Stage 2 — Pre-Trade Vetting →" action on its detail page.

---

## Stage 2 — Pre-Trade Vetting (`portal/suppliers/pre-trade.html`, `js/portal/pre-trade.js`)

URL: `pre-trade.html?supplier_id={contactId}&onboarding_id={onboardingId}`. On load, if `workflow_stage === 'stage1_complete'`, the page auto-advances to `pending_stage2`.

### 1. Sanctions Screening Review (full-diligence only)

Read-only summary of the Stage 1 sanctions screen date/result. If the sanctions screen is more than 12 months old, a "Re-screen" action opens the same screening form used in Stage 1 and inserts a fresh `sanctions_screens` row.

### 2. Risk Assessment Review (full-diligence only)

Loads the Stage 1 `supplier_risk_assessment` row for this onboarding in an editable form (same scoring UI as Stage 1). **"Mark Risk Assessment Reviewed"** sets `reviewed_at = now()` and `reviewed_by = <current user>` on the same row (plus any score edits) — this is the Stage 2 gate for full-diligence suppliers. Simplified-track suppliers skip this panel; their Stage 1 preliminary assessment stands.

### 3. ESG / Environmental (all supplier types, net new)

Saved independently via its own "Save" button, writing to `contacts`:

- `esg_policy_in_place` (checkbox)
- `carbon_reporting_available` (checkbox)
- `esg_notes` (free text)
- `environmental_permit_ref`, `environmental_permit_expiry`

### 4. Bank Details (all supplier types, net new, masked)

Structured fields on `contacts`: `bank_account_name`, `bank_account_number`, `bank_sort_code` ("Sort Code / Routing Number"), `bank_iban`, `bank_swift_bic`, `bank_name`, and a mandatory checkbox **"I confirm this bank account is held in the exact name of the registered company above"** (`bank_account_verified_in_name`).

If bank data exists, the account number/IBAN are displayed masked via `maskAccountNumber()` (last 4 digits visible) with a client-side show/hide toggle. No bank-details document upload — these are structured fields only.

### 5. Terms of Business (TOB) (all supplier types, net new)

`OnboardingWorkflow.buildTobHtml(contact, onboarding)` generates a TOB document (currently **placeholder/boilerplate** — clearly marked "PLACEHOLDER — pending final Terms of Business document"; the gating logic is independent of the template content, so the real text can be swapped in later without code changes). Tracked via `supplier_onboarding.tob_status`:

```
not_generated → generated → sent → confirmed
```

- "Generate / Preview TOB" → opens the document in a new tab, calls `markTobGenerated()` (first time only)
- "Mark as Sent to Supplier" → `markTobSent()` (enabled once generated)
- "Mark TOB Agreement Confirmed" → `markTobConfirmed()` (enabled once sent) — satisfies the `tob_status === 'confirmed'` Stage 2 gate

Each transition writes a `tob_generated` / `tob_sent` / `tob_confirmed` event to `supplier_audit_trail`.

### 6. Recommendation (Martyn) and 7. Final Decision (Jackson)

Relocated from the old detail-page forms (`buildRecommendationForm`/`submitRecommendation`/`buildDecisionForm`/`submitDecision`, now in `pre-trade.js`). These populate `recommendation` / `recommendation_rationale` / `decision` / `decision_justification` and write `supplier_approvals` rows — they **do not** change `workflow_stage`, **except** a `'rejected'` decision, which immediately sets `workflow_stage = 'rejected'` via `rejectOnboarding()`.

| Decision | Effect |
|---|---|
| **Approved** | `decision = 'approved'`; `workflow_stage` unchanged until "Complete Stage 2" passes |
| **Approved with Conditions** | `decision = 'approved_with_conditions'`; conditions tracked in `supplier_conditions` |
| **Rejected** | `workflow_stage → 'rejected'` immediately via `rejectOnboarding()`; reason recorded |

### Pausing and resuming Stage 2

**"Save Progress & Exit"** sets `workflow_stage = 'awaiting_supplier_info'` (optional reason prompt) and logs the pause. The supplier's detail page then shows an **"Awaiting Supplier Info"** badge and a **"Resume Vetting"** button (`OnboardingWorkflow.resumeFromAwaitingInfo`), which sets `workflow_stage → 'pending_stage2'` and re-opens `pre-trade.html`.

### Completing Stage 2

**"Complete Stage 2 →"** runs `checkGates(onboarding, contact, 'stage2_complete')`, which requires:

- `bank_account_number` or `bank_iban` present
- `bank_account_verified_in_name === true`
- `tob_status === 'confirmed'`
- `recommendation` + `recommendation_rationale` present
- `decision` + `decision_justification` present
- **Full-diligence only:**
  - A `sanctions_screens` row dated within 12 months
  - The `supplier_risk_assessment` row has `reviewed_at IS NOT NULL`

On success: `workflow_stage → 'stage2_complete'`, `activated_at = now()` (reused column, meaning "Stage 2 complete" timestamp), `contacts.approval_status` set to `approved` or `conditionally_approved` (per `decision`), `stage_advanced` logged. The supplier now shows "Begin Stage 3 — Trade Ready Sign-off →".

---

## Stage 3 — Trade Ready Sign-off (`portal/suppliers/trade-ready.html`, `js/portal/trade-ready.js`)

URL: `trade-ready.html?supplier_id={contactId}&onboarding_id={onboardingId}`.

### 1. Commercial Terms

Written to `contacts`:

- **Accepted currencies** (`accepted_currencies`, `text[]`) — checkbox group: USD, GBP, EUR, INR, CNY, AED
- **Default currency** (`default_currency`) — must be one of the checked currencies
- **Initial / subsequent payment terms** (`payment_terms_initial`, `payment_terms_subsequent`)
- **Standard incoterm** (`standard_incoterm`)

"Save Commercial Terms" persists these fields without changing `workflow_stage`.

### 2. DPA Document

Read-only summary of the current `supplier_documents` row where `document_type = 'dpa'` and `is_current = true`, with an "Upload DPA →" link to `documents.html?supplier_id=...&onboarding_id=...`.

### 3. Final Sign-off

Pass/fail summary of the `trade_ready` gates. **"Mark Trade Ready →"** runs `checkGates(onboarding, contact, 'trade_ready')`:

- `workflow_stage === 'stage2_complete'`
- `accepted_currencies` non-empty, `default_currency`, `payment_terms_initial`, `payment_terms_subsequent`, `standard_incoterm` all set
- A current `supplier_documents` row with `document_type = 'dpa'`, `is_current = true`

On success: `workflow_stage → 'trade_ready'`. The supplier can now be attached to trades and receive supplier quotes against any `accepted_currencies`.

---

## Document Checklist (`portal/suppliers/documents.html`, `js/portal/documents.js`)

`documents.html` is a general checklist/upload tool linked from Stage 1/2/3 pages — it no longer drives stage advancement (the old `advanceFromDocuments()` and its "Advance" button have been removed in favour of "← Back to Supplier").

### Required documents by supplier type

| Document | Manufacturing | Materials / Commodities | Logistics | Packaging | Service Provider |
|---|:---:|:---:|:---:|:---:|:---:|
| Business registration certificate | ✓ | ✓ | ✓ | ✓ | ✓ |
| Beneficial owner declaration | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tax certificate (VAT/GST/jurisdiction) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Quality certificate (ISO/BIS/IATF) | ✓ | ✓ | — | — | — |
| Audit report | ✓ | — | — | — | — |
| Data Processing Agreement (DPA/GDPR) | ✓ | ✓ | ✓ | ✓ | ✓ |

`dpa` is the only document type that gates a stage transition (`trade_ready`, Stage 3). Cargo/liability insurance, test/mill certificates, and bank details document uploads from the earlier version have been removed — bank details are now structured fields on `contacts` (Stage 2). `DOC_LABELS` retains entries for these removed types for historical rows.

### Upload behaviour

- File input accepts multiple files (`multiple`). Each selected file becomes its own `supplier_documents` row at the chosen `document_type`, sharing one incrementing `version` per batch; the previous-current row(s) are superseded once per batch (not per file).
- If `expiry_date` is left blank, it defaults to +12 months from the upload date, applied to the whole batch.
- "Other (Manual Entry)" requires a `document_label`.
- `change_reason` is required (and the field shown) only when `version > 1`.

---

## Onboarding Pipeline (`portal/suppliers/onboarding-pipeline.html`, `js/portal/onboarding-pipeline.js`)

```js
ACTIVE_STAGES    = ['draft','stage1_complete','pending_stage2','awaiting_supplier_info','stage2_complete']
COMPLETED_STAGES = ['trade_ready','rejected']
```

- **KPI cards**: Active Onboardings (count of `ACTIVE_STAGES`), Awaiting Supplier Info (count of `awaiting_supplier_info`), Avg Days in Vetting, Approved (`trade_ready`, last 90 days), Rejected (last 90 days)
- **Stage breakdown**: one bar per `ACTIVE_STAGES` value, labelled via `OnboardingWorkflow.pipelineColumnLabel()` (`draft` displays as "Pending Stage 1")
- **Pipeline table** (not Kanban): filterable by stage, risk level, and supplier name; rows for `awaiting_supplier_info` are highlighted with an "Awaiting supplier" indicator
- **Completed table**: onboardings in `COMPLETED_STAGES` updated within the last 90 days, with an "Approved"/"Rejected" outcome badge

---

## Supplier Detail Page (`portal/suppliers/detail.html`, `js/portal/suppliers-detail.js`)

### Header

- `supplier_reference` shown as a mono badge under the company name
- `company_phone` shown as "Main Phone" in the contact-info grid
- `qms_certification` (+ certificate reference and expiry, if set) shown as a summary line
- **Bank Details** section — masked `bank_account_number`/`bank_iban` (show/hide toggle via duplicated `maskAccountNumber()`), `bank_name`, sort code, SWIFT/BIC, and a "Not on file" / "Unverified" / "Verified" badge driven by `bank_account_verified_in_name`
- **"Edit Bank Details"** button opens `#edit-bank-modal`, mirroring the existing `#edit-address-modal` pattern

### Onboarding tab — stage-routed actions

| `workflow_stage` | Action shown |
|---|---|
| `draft` | "Continue Stage 1 →" → `onboard.html?supplier_id=...` |
| `stage1_complete` | "Ready to Quote" badge + "Begin Stage 2 — Pre-Trade Vetting →" → `pre-trade.html?supplier_id=...&onboarding_id=...` |
| `pending_stage2` | "Continue Stage 2 →" → `pre-trade.html?...` |
| `awaiting_supplier_info` | "Awaiting Supplier Info" badge + "Continue Stage 2 →" + **"Resume Vetting"** (→ `resumeFromAwaitingInfo`) |
| `stage2_complete` | "Stage 2 Complete" badge + "Begin Stage 3 — Trade Ready Sign-off →" → `trade-ready.html?supplier_id=...&onboarding_id=...` |
| `trade_ready` / `rejected` | Terminal — no advance action. `rejected` shows "Start New Onboarding →" (commercial role only) |

"Reject" is available on all non-terminal stages and opens a reason prompt before calling `rejectOnboarding()`.

The 5-step progress bar (`OnboardingWorkflow.renderProgressSteps`) covers `draft → stage1_complete → pending_stage2 → stage2_complete → trade_ready`; `awaiting_supplier_info` displays at the `pending_stage2` step with its own "Awaiting Supplier Info" badge rendered alongside.

---

## Post-Activation (Trade Ready suppliers)

### Conditional approvals

Outstanding conditions in `supplier_conditions` (from a `decision = 'approved_with_conditions'`) are monitored by Martyn. When each condition is satisfied, the evidence document is linked and `is_met = true` is set, writing a `condition_met` audit event.

### Document expiry monitoring

Expired documents on `trade_ready` suppliers must be renewed; a renewed document creates a new version row (`is_current = true`), and the expired row is retained in history.

### Supplier suspension / delisting

Either director can suspend or delist a `trade_ready` supplier at any time. A mandatory reason is required, a `supplier_suspended`/`supplier_delisted` audit event is written, and `contacts.approval_status` is updated accordingly. All in-progress orders referencing the supplier are flagged for review.

---

## Annual Internal Audit (ISO 9001 Clause 9.2)

Once per year, Jackson conducts an internal audit of a sample of completed onboardings (target: 20–25% of onboardings completed that year). For each sampled supplier Jackson reviews:

1. Did Stage 1 capture sanctions screening, QMS status, and a preliminary risk assessment before "Ready to Quote"?
2. For full-diligence suppliers, was the risk assessment reviewed (`reviewed_at` set) and the sanctions screen current (≤12 months) before `stage2_complete`?
3. Were bank details verified in the registered company name, and was the TOB confirmed, before `stage2_complete`?
4. Were all required documents (incl. DPA) current and non-expired at `trade_ready`?
5. Is Jackson's decision justification substantive and independent of Martyn's recommendation?

Findings are raised as nonconformities in `supplier_nonconformities` with corrective actions assigned. The audit event is recorded in `supplier_audit_trail` with `event_type = 'annual_audit_event'`.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `contacts` | Supplier master record — registration, VAT, beneficial owner, supplier type, addresses, QMS, ESG, bank details, commercial terms |
| `supplier_enquiries` | Pre-onboarding leads; source and conversion tracking |
| `supplier_onboarding` | Workflow state machine (7-value `workflow_stage`); recommendation, decision, TOB tracking |
| `supplier_risk_assessment` | Single row per onboarding — preliminary (Stage 1) and reviewed (Stage 2, full-diligence) risk scoring |
| `supplier_documents` | Version-controlled document uploads with expiry; `dpa` gates `trade_ready` |
| `supplier_approvals` | Immutable approval/rejection records (recommendation + final decision) |
| `supplier_audit_trail` | Append-only event log (RLS: INSERT + SELECT only) |
| `supplier_nonconformities` | Compliance failures and process gaps |
| `corrective_actions` | Tracked remediation for each nonconformity |
| `supplier_conditions` | Individual conditions on conditionally-approved suppliers |
| `sanctions_screens` | Sanctions screening records — Stage 1, re-screened at Stage 2 if stale (full-diligence) |
| `supplier_audits` | Audit records (existing) — linkable to onboarding via `onboarding_id` |

Full column definitions: `docs/supabase-schema.md`
Migrations: `supabase/migrations/20260612c_contacts_onboarding_v2_fields.sql`, `20260612d_supplier_onboarding_v2_stages.sql`, `20260612e_supplier_risk_assessment_review.sql`
