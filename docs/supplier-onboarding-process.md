# Supplier Onboarding Process — Vertex Metals Portal

**Version:** 2.0 (ISO 9001 Redesign)  
**Last updated:** June 2026  
**Supersedes:** Original process doc (fragmented CRM/KYC/Sanctions/Audit modules)

---

## Roles

| Role | Person | Portal Role Value | Responsibilities |
|------|--------|-------------------|------------------|
| Director — Commercial | Jackson Paul | `director_commercial` | Supplier identification, enquiry assessment, intake request, final approval/rejection decision, annual audit of sample onboarding decisions |
| Director — Operations & Compliance | Martyn Bourner | `director_compliance` | All vetting: screening, risk assessment, document collection, KYC, sanctions. Submits recommendation. |

---

## Process Overview

```
Website contact form  ──► Supplier Enquiry (portal)
                                   │
                         Jackson reviews enquiry
                                   │
              ┌────────────────────┴────────────────────┐
              │                                         │
           Decline                                   Convert
     (reason recorded)                                  │
                                              Formal Onboarding created
                                                        │
                                              ┌─────────▼─────────┐
                                              │   STAGE 1: INTAKE  │
                                              │      (Jackson)     │
                                              └─────────┬─────────┘
                                                        │
                                              ┌─────────▼──────────────────┐
                                              │ STAGE 2: SCREENING &       │
                                              │         RISK ASSESSMENT    │
                                              │           (Martyn)         │
                                              └─────────┬──────────────────┘
                                                        │
                                              ┌─────────▼──────────────────┐
                                              │ STAGE 3: DOCUMENT          │
                                              │         COLLECTION         │
                                              │           (Martyn)         │
                                              └─────────┬──────────────────┘
                                                        │
                                              ┌─────────▼──────────────────┐
                                              │ STAGE 4: COMPLIANCE        │
                                              │         REVIEW             │
                                              │           (Martyn)         │
                                              └─────────┬──────────────────┘
                                                        │
                                              ┌─────────▼──────────────────┐
                                              │ STAGE 5: MARTYN'S          │
                                              │         RECOMMENDATION     │
                                              └─────────┬──────────────────┘
                                                        │  Handed to Jackson
                                              ┌─────────▼──────────────────┐
                                              │  JACKSON'S FINAL DECISION  │
                                              └─────────┬──────────────────┘
                                                        │
                              ┌─────────────────────────┼──────────────────────┐
                              │                         │                      │
                          Rejected              Conditionally              Approved
                     (reason recorded)           Approved              (Activated)
                                             (conditions tracked)
```

Any stage may result in rejection. The rejection reason is mandatory and recorded in `supplier_audit_trail`.

---

## Pre-Stage: Supplier Enquiry

### Source 1 — Website contact form (Partners/Suppliers page)

Submission creates a `supplier_enquiries` row with `source = 'website_form'` and `status = 'new'`. The portal surfaces this in Jackson's **Enquiry Queue**.

### Source 2 — Manual entry by Jackson

Jackson can also raise an enquiry manually in the portal (`source = 'manual_entry'`) for suppliers he has identified directly.

### Jackson's review

Jackson reviews each enquiry and takes one of two actions:

**Decline:** Sets `status = 'declined'`, enters a decline reason. The enquiry record is retained with full audit trail. No further action.

**Convert:** Creates a formal `supplier_onboarding` record, links it via `converted_to_onboarding_id`, sets `status = 'converted'`. The onboarding is assigned to Martyn for vetting.

---

## Stage 1 — Intake (Jackson)

Jackson completes the supplier record with the mandatory fields required to begin vetting:

- Company name
- Legal registration / company number
- Country of registration
- Supplier type (`manufacturing` | `materials_commodities` | `logistics` | `service_provider`)
- Primary contact name, email, phone
- Initial risk category (Jackson's commercial assessment: `low` | `medium` | `high`)

**Stage gate:** All mandatory fields must be populated before the onboarding can advance.

**Audit event written:** `onboarding_created`

---

## Stage 2 — Screening & Risk Assessment (Martyn)

Martyn performs the initial screening and formal risk assessment.

### Sanctions screening

- Martyn screens the supplier against applicable lists (OFAC, UK HMT, EU, UN)
- Result recorded in `sanctions_screens` (existing table) linked to this supplier
- A `sanctions_linked` audit event is written to `supplier_audit_trail`
- If a confirmed match: supplier is rejected at this stage with full documentation

### Risk assessment

Martyn completes the guided risk scoring form in `supplier_risk_assessment`:

| Criterion | Score (1–5) | 1 = Very Low Risk, 5 = Very High Risk |
|-----------|-------------|---------------------------------------|
| Financial viability | | Payment history, credit exposure, company age |
| Quality certification | | ISO 9001, IATF, BIS, or equivalent held |
| Regulatory compliance | | Licensing, permits, export controls |
| Geographic risk | | Country sanctions exposure, political stability |
| Supply continuity | | Single-source risk, production capacity |

The portal computes the overall average score and derives a risk category:

| Score | Risk Category |
|-------|--------------|
| 1.0 – 2.3 | Low |
| 2.4 – 3.6 | Medium |
| 3.7 – 5.0 | High |

Martyn documents rationale notes for each criterion. If he disagrees with the computed category he can override it — but the override reason is mandatory and visible in the audit trail.

**Stage gate:** Sanctions result recorded AND risk assessment saved before advancing.

**Audit events written:** `risk_assessment_saved`, `sanctions_linked`

---

## Stage 3 — Document Collection (Martyn)

The portal presents a mandatory document checklist based on supplier type. Martyn requests and uploads required documents, or marks document types as Not Applicable (with a mandatory reason).

### Document types by supplier type

| Document | Manufacturing | Materials / Commodities | Logistics | Service Provider |
|---|:---:|:---:|:---:|:---:|
| Business registration certificate | ✓ | ✓ | ✓ | ✓ |
| Beneficial owner declaration | ✓ | ✓ | ✓ | ✓ |
| Bank details | ✓ | ✓ | ✓ | ✓ |
| Data Processing Agreement (DPA/GDPR) | ✓ | ✓ | ✓ | ✓ |
| Tax certificate (VAT/GST/jurisdiction) | ✓ | ✓ | ✓ | ✓ |
| Quality certificate (ISO/BIS/IATF) | ✓ | ✓ | — | — |
| Test / mill certificates | ✓ | ✓ | — | — |
| Insurance — cargo | — | ✓ | ✓ | — |
| Insurance — liability | ✓ | ✓ | ✓ | ✓ |
| Audit report | ✓ | — | — | — |
| W-9 (US suppliers only) | N/A* | N/A* | N/A* | N/A* |

*W-9 is available as a document type but should be marked Not Applicable for non-US suppliers.

### Document version control

Each uploaded document row in `supplier_documents` carries a version number. When a document is renewed:
1. Martyn uploads the new file
2. The portal sets `is_current = false` on the previous row
3. A new row is inserted at `version + 1` with a mandatory `change_reason`

### Expiry tracking

Documents with an `expiry_date` are flagged 30 days before expiry. An expired required document blocks the stage gate and, post-activation, is surfaced on the supplier record as a compliance alert.

**Stage gate:** All mandatory document types either uploaded (not expired) or marked Not Applicable before advancing.

**Audit events written:** `document_uploaded`, `document_superseded`, `document_marked_na`

---

## Stage 4 — Compliance Review (Martyn)

Martyn completes the KYC and final compliance confirmation.

### KYC record

- Martyn creates (or updates) the KYC record in `kyc_records` for this supplier
- Fields: KYC status, risk rating, beneficial owner verified, last screened date, next review date
- A `kyc_linked` audit event is written once the KYC record is linked to this onboarding

### Final sanctions confirmation

- Martyn confirms the sanctions screen result is still current (dated within 12 months)
- If the original screen is older than 12 months, a new screen must be performed first

**Stage gate:** KYC record linked AND sanctions screen result dated within 12 months.

**Audit events written:** `kyc_linked`, `sanctions_linked` (if refreshed)

---

## Stage 5 — Martyn's Recommendation

Martyn submits his vetting findings as a formal recommendation to Jackson.

The recommendation form captures:

- **Recommendation:** `Approve` | `Approve with Conditions` | `Reject`
- **Rationale:** free text, mandatory — Martyn explains his reasoning referencing the evidence gathered
- **Conditions:** if recommending conditional approval, each condition is entered individually (creates rows in `supplier_conditions`)

On submission:
- `supplier_onboarding.recommendation` and `recommendation_rationale` are set
- `recommendation_submitted_at` is recorded
- A `supplier_approvals` row is written (`approval_stage = 'recommendation'`, `approver_role = 'director_compliance'`)
- A `recommendation_submitted` audit event is written
- The onboarding moves to `workflow_stage = 'pending_approval'`
- Jackson sees it in his **Pending Approval** queue

**Martyn's vetting work is locked from further edits after submission.** If a correction is needed, a nonconformity should be raised and the decision discussed between directors.

---

## Stage 5 (continued) — Jackson's Final Decision

Jackson reviews Martyn's recommendation alongside all linked evidence: risk assessment, document checklist, sanctions result, KYC record, and Martyn's rationale.

Jackson writes an **independent justification** — his own assessment, not a restatement of Martyn's. Both positions are preserved in the audit trail. If Jackson's decision differs from Martyn's recommendation, both are visible to any future auditor with the reasons for each.

**Decision options:**

| Decision | Effect |
|---|---|
| **Approved** | Supplier status set to `approved`; activated |
| **Approved with Conditions** | Status `conditionally_approved`; conditions tracked in `supplier_conditions`; Martyn monitors until met |
| **Rejected** | Status `rejected`; reason recorded; supplier can be resubmitted after issues are resolved |

On decision:
- `supplier_onboarding.decision`, `decision_justification`, `decision_by`, `decision_at` are set
- A `supplier_approvals` row is written (`approval_stage = 'final_approval'`, `approver_role = 'director_commercial'`)
- An `approval_decision` or `rejection_decision` audit event is written
- `contacts.approval_status` is updated to reflect the outcome

---

## Activation

On approval, the supplier is activated:
- `supplier_onboarding.activated_at` is set
- `workflow_stage` becomes `'activated'`
- `contacts.approval_status` becomes `'approved'` or `'conditionally_approved'`
- A `supplier_activated` audit event is written

The supplier can now receive supplier quotes and be linked to trades. The system enforces that only `approved` or `conditionally_approved` suppliers can be attached to a new trade.

---

## Post-Activation

### Conditional approvals

Outstanding conditions in `supplier_conditions` are monitored by Martyn. When each condition is satisfied:
- Martyn links the evidence document and marks `is_met = true`
- A `condition_met` audit event is written
- If all conditions are met, the supplier status may be upgraded to `approved` (Jackson's decision)

### Document expiry monitoring

Martyn reviews the document expiry report periodically. Expired documents on active suppliers must be renewed. A renewed document creates a new version row; the expired row is retained in history.

### Periodic KYC re-screening

The `kyc_records.next_review_date` field triggers a reminder. Martyn performs re-screening and updates the KYC record.

### Supplier suspension / delisting

Either director can suspend or delist a supplier at any time. A mandatory reason is required. The portal writes a `supplier_suspended` or `supplier_delisted` audit event and updates `contacts.approval_status` accordingly. All in-progress orders referencing the supplier are flagged for review.

---

## Annual Internal Audit (ISO 9001 Clause 9.2)

Once per year, Jackson conducts an internal audit of a sample of completed supplier onboardings (target: 20–25% of onboardings completed that year). For each sampled supplier Jackson reviews:

1. Did the onboarding progress through all required stages?
2. Were all mandatory documents collected, current, and non-expired at time of approval?
3. Was the sanctions screen dated within 12 months at the time of compliance sign-off?
4. Was Martyn's risk assessment rationale sufficient for the risk category assigned?
5. Is Jackson's own approval justification substantive and independent?

Any findings are raised as nonconformities in `supplier_nonconformities` with corrective actions assigned. The audit event is recorded in `supplier_audit_trail` with `event_type = 'annual_audit_event'`.

This cross-director structure — Martyn vets, Jackson approves, Jackson audits Martyn's vetting — provides the independence required by ISO 9001:2015 Clause 9.2 without requiring external auditor resource for the internal audit function.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `contacts` | Supplier master record (extended with registration, VAT, beneficial owner, supplier type) |
| `supplier_enquiries` | Pre-onboarding leads; source and conversion tracking |
| `supplier_onboarding` | Workflow state machine; recommendations and decisions |
| `supplier_risk_assessment` | Martyn's scored risk assessment per onboarding |
| `supplier_documents` | Version-controlled document uploads with expiry |
| `supplier_approvals` | Immutable approval/rejection records per stage |
| `supplier_audit_trail` | Append-only event log (RLS: INSERT + SELECT only) |
| `supplier_nonconformities` | Compliance failures and process gaps |
| `corrective_actions` | Tracked remediation for each nonconformity |
| `supplier_conditions` | Individual conditions on conditional approvals |
| `kyc_records` | KYC records (existing) — linked at Stage 4 |
| `sanctions_screens` | Sanctions screening records (existing) — linked at Stage 2 |
| `supplier_audits` | Audit records (existing) — linkable to onboarding via `onboarding_id` |

Full column definitions: `docs/supabase-schema.md`  
Migration SQL: `supabase/migrations/20260603_supplier_onboarding_iso9001.sql`
