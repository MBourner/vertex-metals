# Vertex Metals Ltd — Portal Order Flow Specification (v3)
## Addendum to Claude Code Project Prompt v2

---

## How to read this document

This is an **addendum** to `vertex-metals-claude-code-prompt-v2.md`. It does not replace that document — it extends it. Where this document and v2 conflict, **this document takes precedence** for anything to do with the order lifecycle, supplier management, document review, dispute handling, four-eyes verification, or audit logging.

The v2 prompt described a flat trades table with seven status values. That model is insufficient for an ISO 9001 / ISO 27001 compliant trading operation. This document replaces it with a state machine, an event log, a verification queue, and several new entity types.

Claude Code should:

1. Read v2 first, then this document
2. Treat the v2 schema as a starting point and apply the additions and revisions below
3. Keep the v2 build order, but insert the new portal modules at the appropriate phase
4. Where v2 specified a feature that this document refines, the refinement wins

---

## 1. Design principles

These principles drive every decision in this spec. When in doubt, return to them.

**1.1 — Orders are state machines, not records with a status field.** A trade moves through a defined sequence of states. Each state transition is an event. Each event is logged immutably. The set of allowed next-states from any current state is enforced at the database level, not at the UI level.

**1.2 — Every commitment requires two people.** Any action that creates an external obligation — sending a supplier PO, releasing a shipment, raising an invoice — requires one person to draft and a second person to approve. The approver must be a different authenticated user from the drafter. This is enforced in the API layer, not just the UI.

**1.3 — The verifier sees everything the drafter saw, plus context.** When a verifier opens an item in the queue, they see the original customer email, all attachments, the order as drafted, the customer's history, the supplier's history, and any flags. They cannot do their job from the order record alone.

**1.4 — Documentation is the QC, audits are the control.** Vertex Metals does not perform physical inspection of goods at supplier facilities for routine orders. The control is the on-site supplier audit performed at approval. The evidence is the mill certificate, certificate of conformity, and other supplier-provided documentation reviewed against the PO before shipment release.

**1.5 — Concessions are first-class records.** When a customer agrees to accept non-conforming goods, that agreement is a structured record, not free text. It captures the original spec, the actual spec, the delta, the customer signatory, and any commercial adjustment.

**1.6 — Sanctions checks are silent gatekeepers.** The system blocks state transitions if either counterparty's sanctions screen is older than the policy threshold (90 days at time of order, plus the schedule defined in the Sanctions Screening Procedure). This is invisible in the happy path. In the unhappy path, the only override is the MLRO.

**1.7 — Audit trail is append-only.** The events table is never updated, never deleted. It is the source of truth for who did what, when, and why. Every other table can be reconstructed from the event log.

**1.8 — Minimise manual data entry, but make the unavoidable manual step bulletproof.** The PO arrives by email. Translating it into a structured order is the highest-error-risk step in the whole flow. Make it visible, queue it for verification, log every keystroke that mattered.

---

## 2. Order lifecycle — the state machine

### 2.1 — States

Each order moves through these states in sequence. Backwards transitions are explicit and audit-logged.

| State | Meaning | Set by |
|---|---|---|
| `enquiry_received` | Customer enquiry or RFQ logged in the portal | System (on RFQ submission) or Sales (manual entry) |
| `quoted` | Quote issued to the customer | Sales |
| `quote_accepted` | Customer has confirmed they want to proceed; PO awaited | Sales |
| `po_received` | Customer PO email received and attached to the order | Sales |
| `order_drafted` | Sales order entered in the portal, awaiting verification | Sales |
| `order_verified` | Four-eyes check on PO translation passed | Verifier (different user from drafter) |
| `kyc_blocked` | Order paused because customer or supplier KYC is incomplete or stale | System |
| `sanctions_blocked` | Order paused because sanctions screen is overdue | System |
| `supplier_po_drafted` | Supplier PO created in the portal, awaiting approval | Procurement |
| `supplier_po_approved` | Four-eyes check on supplier PO passed | Approver (different user from drafter) |
| `supplier_po_issued` | Supplier PO sent to supplier, shipping booked in parallel | System (on approval) |
| `awaiting_supplier_docs` | Supplier preparing goods, mill cert and CoC pending | System |
| `docs_under_review` | Supplier documents received, document review in progress | Quality |
| `non_conforming` | Documents reviewed and product does not match PO spec | Quality |
| `concession_requested` | Customer asked whether they will accept non-conforming goods | Sales |
| `concession_granted` | Customer has signed concession; goods proceed to shipment | Sales |
| `concession_declined` | Customer rejected concession; supplier must re-make | Sales |
| `awaiting_rework` | Supplier re-making to original PO spec | System |
| `release_approved` | Documents conform (or concession granted); shipment authorised | Approver |
| `in_transit` | Goods have left supplier facility | Logistics |
| `delivered` | Customer confirms delivery received | Customer (via portal) or Sales |
| `dispute_open` | Post-delivery issue raised by customer | Sales or Customer |
| `invoice_drafted` | Invoice prepared for customer | Finance |
| `invoice_issued` | Invoice signed off and sent | Finance reviewer |
| `customer_paid` | Customer payment received and matched | Finance |
| `supplier_paid` | Supplier payment sent | Finance |
| `complete` | Settlement complete on both sides, dispute window closed | System |
| `cancelled` | Order cancelled before completion | Sales (with reason) |

### 2.2 — Allowed transitions

Allowed transitions are enforced in the database via a transition table. The application layer checks the table before issuing any state change.

Key allowed transitions (not exhaustive — full list in `docs/state-machine.md`):

```
enquiry_received     → quoted, cancelled
quoted               → quote_accepted, cancelled
quote_accepted       → po_received, cancelled
po_received          → order_drafted
order_drafted        → order_verified, order_drafted (rejected, returned to drafter)
order_verified       → supplier_po_drafted, kyc_blocked, sanctions_blocked
kyc_blocked          → order_verified (when KYC clears)
sanctions_blocked    → order_verified (when sanctions clear or MLRO overrides)
supplier_po_drafted  → supplier_po_approved, supplier_po_drafted (rejected)
supplier_po_approved → supplier_po_issued
supplier_po_issued   → awaiting_supplier_docs
awaiting_supplier_docs → docs_under_review
docs_under_review    → release_approved, non_conforming
non_conforming       → concession_requested, awaiting_rework
concession_requested → concession_granted, concession_declined
concession_granted   → release_approved
concession_declined  → awaiting_rework
awaiting_rework      → docs_under_review
release_approved     → in_transit
in_transit           → delivered
delivered            → invoice_drafted, dispute_open
dispute_open         → invoice_drafted (resolved), cancelled (unresolved)
invoice_drafted      → invoice_issued
invoice_issued       → customer_paid
customer_paid        → supplier_paid
supplier_paid        → complete
```

Any transition not in this list is rejected by the API.

### 2.3 — System-driven transitions

Some transitions are triggered automatically:

- `supplier_po_approved → supplier_po_issued` happens when the system records that the supplier email has been sent (sent timestamp recorded)
- `order_verified → kyc_blocked` happens automatically if either counterparty's KYC `next_review_date` is in the past, or KYC `status` is not `complete`, at the moment of verification
- `order_verified → sanctions_blocked` happens automatically if either counterparty's `last_sanctions_screened_at` is older than 90 days
- `customer_paid` is set automatically when finance matches a bank transfer to an invoice (manual confirmation step)
- `complete` is set automatically once both `supplier_paid` is true and the post-delivery dispute window has closed (default 30 days from `delivered`)

---

## 3. Schema additions and revisions

The v2 schema defined `trades`, `contacts`, `kyc_records`, and others. This section keeps those, but adds, revises, and clarifies.

### 3.1 — Revisions to existing tables

**`trades`** — replace the flat `status` field with a reference to the state machine:

- Remove: `status text` (the v2 enum)
- Add: `current_state text NOT NULL` — must match a value in `order_states.code`
- Add: `customer_po_reference text` — the buyer's own PO number from their system
- Add: `customer_po_email_id uuid` — references the email record holding the original PO
- Add: `cancelled_reason text` — populated only if `current_state = 'cancelled'`
- Add: `dispute_window_closes_at timestamptz` — set when `delivered` is reached
- Keep: all other fields from v2

**`contacts`** — extend to support supplier approval lifecycle:

- Add: `approval_status text` — one of `prospect`, `under_audit`, `approved`, `suspended`, `delisted`
- Add: `approved_at timestamptz`
- Add: `approved_by uuid` — references `auth.users`
- Add: `next_audit_due_date date`
- Add: `last_sanctions_screened_at timestamptz`
- Add: `last_sanctions_result text`
- Keep: `kyc_status` from v2 (now mirrors the latest `kyc_records.risk_rating` for fast lookups)

**`kyc_records`** — keep as defined in v2.

### 3.2 — New tables

**`order_states`** — reference table listing every state in the state machine. One row per state. Includes display name, lane (sales/quality/finance/etc), is-terminal flag, and human-readable description. Loaded once at deploy time.

**`order_state_transitions`** — reference table listing every allowed transition. Columns: `from_state`, `to_state`, `requires_approval` (bool), `required_role` (text — e.g. `verifier`, `approver`, `mlro`), `is_system_triggered` (bool). The API queries this table before performing any state change.

**`order_events`** — append-only audit log. Every state transition, every approval, every override, every concession decision writes a row here.

- `id` uuid primary key
- `created_at` timestamptz
- `trade_id` uuid references `trades(id)`
- `event_type` text — `state_change`, `approval`, `rejection`, `override`, `note`, `document_attached`, `concession_decision`
- `from_state` text
- `to_state` text
- `actor_id` uuid references `auth.users`
- `actor_role` text — snapshot of the actor's role at the time
- `evidence_ref` text — pointer to the document, email, or note that justified the event
- `reason_code` text — controlled vocabulary for rejections and overrides (e.g. `wrong_unit`, `missing_incoterm`, `mlro_override_sanctions`)
- `notes` text — free text additional context

This table is **append-only**. No updates, no deletes. RLS denies UPDATE and DELETE for all roles including service role.

**`verification_queue`** — work queue for four-eyes verifications.

- `id` uuid primary key
- `created_at` timestamptz
- `trade_id` uuid references `trades(id)`
- `queue_type` text — `po_translation`, `supplier_po_approval`, `release_approval`, `invoice_review`
- `drafted_by` uuid references `auth.users`
- `assigned_to` uuid references `auth.users` — nullable; if null, anyone with the role can pick it up
- `priority` text — `routine`, `expedite`
- `sla_due_at` timestamptz
- `status` text — `pending`, `in_review`, `approved`, `rejected`, `cancelled`
- `decision_at` timestamptz
- `decision_by` uuid references `auth.users`
- `decision_reason_code` text
- `decision_notes` text

The `decision_by` user must not equal `drafted_by` — enforced by a check constraint and by the API.

**`order_documents`** — every document attached to an order.

- `id` uuid primary key
- `created_at` timestamptz
- `trade_id` uuid references `trades(id)`
- `document_type` text — `customer_po`, `supplier_quote`, `supplier_po`, `mill_certificate`, `certificate_of_conformity`, `bill_of_lading`, `delivery_note`, `invoice`, `proof_of_delivery`, `concession_form`, `dispute_record`, `other`
- `file_path` text — Supabase storage path
- `file_name` text
- `file_size_bytes` bigint
- `mime_type` text
- `uploaded_by` uuid references `auth.users`
- `source` text — `email_inbound`, `manual_upload`, `supplier_portal`, `system_generated`
- `email_id` uuid — nullable, references `inbound_emails` if applicable
- `notes` text

**`inbound_emails`** — store of customer and supplier emails relevant to orders. Either ingested via Resend inbound or via manual upload of `.eml`/`.msg` files in the early version.

- `id` uuid primary key
- `received_at` timestamptz
- `from_address` text
- `to_address` text
- `subject` text
- `body_text` text
- `body_html` text
- `raw_message_path` text — Supabase storage path to original `.eml`
- `linked_trade_id` uuid — nullable, set when an email is associated with an order
- `direction` text — `inbound` only initially; `outbound` reserved for future
- `processed` boolean

**`concessions`** — formal customer concession records.

- `id` uuid primary key
- `created_at` timestamptz
- `trade_id` uuid references `trades(id)`
- `original_specification` text — what the PO required
- `actual_specification` text — what the supplier produced
- `delta_summary` text — plain-language description of the difference
- `customer_signatory_name` text
- `customer_signatory_email` text
- `customer_signed_at` timestamptz
- `signed_document_path` text — Supabase storage path to the customer's written acceptance
- `commercial_adjustment_gbp` numeric — discount or rebate, if any
- `precedent_acknowledged` boolean — whether the customer has acknowledged that this does not set a precedent
- `notes` text

**`disputes`** — post-delivery quality, quantity, or commercial disputes.

- `id` uuid primary key
- `created_at` timestamptz
- `trade_id` uuid references `trades(id)`
- `raised_by` text — `customer` or `internal`
- `raised_at` timestamptz
- `category` text — `quality`, `quantity`, `documentation`, `delivery_damage`, `commercial`, `other`
- `description` text
- `evidence_documents` uuid[] — array of `order_documents.id`
- `status` text — `open`, `investigating`, `supplier_notified`, `resolved`, `escalated`
- `resolution` text
- `resolved_at` timestamptz
- `cost_attribution` text — `supplier`, `vertex`, `customer`, `shared`
- `corrective_action_required` boolean
- `supplier_re_audit_triggered` boolean

**`supplier_audits`** — supplier on-site audit records.

- `id` uuid primary key
- `created_at` timestamptz
- `supplier_id` uuid references `contacts(id)`
- `audit_date` date
- `audit_type` text — `initial_approval`, `periodic`, `triggered`
- `auditor_name` text
- `audit_report_path` text — Supabase storage path
- `outcome` text — `approved`, `approved_with_conditions`, `not_approved`
- `conditions` text — populated if `approved_with_conditions`
- `next_audit_due_date` date
- `notes` text

**`sanctions_screens`** — screening event log. Replaces the v2 approach of stuffing screening history into the `kyc_records.notes` field.

- `id` uuid primary key
- `created_at` timestamptz
- `subject_type` text — `contact`, `beneficial_owner`, `vessel`, `port`, `bank`
- `subject_id` uuid — references the relevant table
- `subject_name_snapshot` text — the name as screened, frozen at screening time
- `screened_at` timestamptz
- `screened_by` uuid references `auth.users`
- `lists_screened` text[] — `OFSI_UK`, `UN`, `EU`, `OFAC_SDN`, etc.
- `tool_used` text — name and version of the screening tool
- `result` text — `clear`, `potential_match`, `confirmed_match`
- `match_resolution_notes` text
- `evidence_path` text — Supabase storage path to the screenshot or export

### 3.3 — Row Level Security additions

In addition to v2 RLS:

- `order_events`: SELECT for all authenticated users; INSERT for service role only (via API endpoints); UPDATE and DELETE denied for all roles
- `verification_queue`: SELECT for all authenticated users; UPDATE constrained to disallow `decision_by = drafted_by`
- `concessions`, `disputes`, `supplier_audits`, `sanctions_screens`: SELECT and INSERT for authenticated users; UPDATE permitted; DELETE denied
- `inbound_emails`: SELECT for authenticated users; INSERT via service role (Resend webhook) or authenticated user (manual upload)

### 3.4 — Constraints to enforce in SQL, not just code

- `verification_queue.decision_by != drafted_by` — check constraint
- `order_events` has a trigger that prevents UPDATE and DELETE
- `trades.current_state` must reference a row in `order_states`
- A `trades.current_state` change triggers a function that writes an `order_events` row automatically — single source of truth for the audit log

---

## 4. Portal UI — new and revised pages

### 4.1 — New pages to add to v2

```
portal/
├── verification-queue/
│   └── index.html              # NEW — work queue for four-eyes checks
├── orders/
│   ├── index.html              # NEW — replaces v2 trades/index.html
│   ├── detail.html             # NEW — single order full lifecycle view
│   └── new.html                # NEW — order entry form (PO translation step)
├── suppliers/
│   ├── index.html              # NEW — approved suppliers list
│   ├── detail.html             # NEW — supplier with audit history
│   └── audit.html              # NEW — record an on-site audit
├── disputes/
│   ├── index.html              # NEW — open and historical disputes
│   └── detail.html             # NEW — single dispute case file
├── concessions/
│   └── index.html              # NEW — concession register
└── sanctions/
    └── log.html                # NEW — sanctions screening log
```

The existing `portal/trades/index.html` from v2 can be renamed/redirected to `portal/orders/index.html` rather than maintained separately.

### 4.2 — Verification Queue page

This is the most-used page after the dashboard. Every operator opens it many times per day.

**Layout.** Two-column on desktop. Left: filter chips and queue list. Right: detail pane showing the selected queue item's full context.

**Queue list.** Sorted by SLA due time ascending. Each row shows:
- Queue type badge (PO translation / supplier PO / release / invoice)
- Order reference
- Customer or supplier name
- Time since drafted
- SLA due time, with amber if within 1 hour, red if breached
- Drafter name (so a reviewer can see at a glance who drafted)

**Filters.** By queue type, by status (pending / in review / approved / rejected today), by drafter (so a manager can see what their team has drafted), by overdue.

**Detail pane.** When a queue item is selected, the detail pane shows:

For a `po_translation` item:
- The original customer email — full body, attachments, sender, received time
- The PO attachment rendered inline if PDF
- The order as drafted by the operator, side-by-side with extractable fields from the PO
- Customer history: previous orders for this customer (last 10), with their products and prices for context
- Industry context flags: does this match commodity codes the customer normally orders? Is the unit price within 20% of recent quotes for the same product?
- KYC status and last sanctions screen date
- A reason-code dropdown (controlled vocabulary) and free-text notes field
- Two buttons: "Approve" and "Reject — return to drafter"
- The Approve button is disabled if `current_user_id == drafted_by_user_id`

For a `supplier_po_approval` item:
- The full sales order (already verified)
- The supplier PO as drafted, side-by-side with the FOB quote it derives from
- Quote validity check — is the FOB quote still valid?
- Supplier approval status — is the supplier still on the approved list? Is the next audit due?
- Margin calculation — is the margin within expected range for this product?
- KYC and sanctions status of the supplier
- Approve / Reject buttons with the same anti-self-approval rule

For a `release_approval` item:
- Document review summary — mill cert, CoC, any other supplier docs
- Side-by-side comparison: PO spec vs documented spec
- Concession status if any (link to the concession record if `concession_granted`)
- Finance position: customer credit standing, any outstanding balances
- Approve / Reject buttons

For an `invoice_review` item (soft gate):
- The drafted invoice
- The trade record it derives from
- Customer payment terms snapshot
- Sign-off button — does not block, but logs an `approval` event

**Decisions write `order_events` and `verification_queue` rows.** The API enforces the four-eyes constraint and writes both rows in a single transaction.

### 4.3 — Order Detail page

Single-page lifecycle view of an order. The most important page in the portal because everything an operator might want to know about an order should be reachable from here.

**Top bar.** Order reference, customer name, supplier name, current state badge, total value, margin.

**Timeline strip.** Horizontal swimlane showing every state the order has passed through, with timestamps, actor names, and the events that drove transitions. Generated from `order_events`. Read-only.

**Tabs.**
- **Summary** — key fields, current state, next allowed actions for the current user
- **Documents** — every `order_documents` row, grouped by type. Upload, preview, download.
- **Emails** — every `inbound_emails` row linked to this trade
- **Verification log** — every `verification_queue` decision on this order, plus reason codes and notes
- **Concession** — populated if a concession was requested or granted
- **Dispute** — populated if a dispute was raised
- **Audit log** — full `order_events` history, raw, exportable as CSV

**Action panel.** Shows only the actions the current user is authorised to take given the current state. If the order is in `order_drafted`, the drafter sees nothing actionable here (it's in the queue for someone else); a verifier sees an "Open in verification queue" button.

### 4.4 — Order Entry (new order draft) page

The PO translation step. The single highest-error-risk action in the whole flow, so worth making it deliberate and well-instrumented.

**Layout.** Two columns. Left: the customer's PO email and attachments. Right: the order entry form.

**Form fields.**
- Customer (dropdown filtered to approved buyers — locked if entered from an existing RFQ or contact)
- Customer's PO reference (their number from their system — required)
- Customer's PO date
- Product (dropdown of catalogue products)
- Specification (text — exact spec from PO)
- Quantity and unit
- Agreed price and currency
- Incoterms (dropdown: FOB, CIF, DAP, DDP, etc.)
- Delivery destination
- Required delivery date
- Payment terms (defaulted from customer's contract terms)
- Special conditions (free text)
- Attached PO document (upload required before save)
- Operator notes for the verifier

**On save.** Creates a `trades` row in `order_drafted` state, creates a `verification_queue` row of type `po_translation` with SLA based on priority, and writes an `order_events` row.

**No "send to supplier" or "approve" action exists on this page.** The drafter cannot self-approve. They can only save and submit to queue.

### 4.5 — Suppliers index and detail

The approved suppliers list isn't just a contact list — it's a register of who is qualified to receive a supplier PO.

**Index page.** Table of suppliers with columns:
- Company name
- Country (flag + name)
- Approval status badge (`prospect`, `under_audit`, `approved`, `suspended`, `delisted`)
- Last audit date
- Next audit due (amber if within 60 days, red if overdue)
- Last sanctions screen (amber if within 14 days, red if overdue)
- Active orders count
- Concession rate (% of orders in last 12 months that triggered a concession)

The supplier PO drafting flow filters this list to `approval_status = 'approved'` only. A draft supplier PO cannot be saved against a non-approved supplier — enforced at API level.

**Detail page.** All supplier fields, plus:
- Audit history (chronological, from `supplier_audits`)
- Order history (chronological)
- Concession history
- Dispute history
- Sanctions screen history (from `sanctions_screens`)
- KYC record link

### 4.6 — Supplier Audit page

Form for recording an on-site audit visit.

**Fields.**
- Supplier (dropdown)
- Audit date
- Audit type (initial / periodic / triggered)
- Auditor name(s)
- Outcome (approved / approved with conditions / not approved)
- Conditions (visible only if "approved with conditions")
- Audit report upload (PDF)
- Next audit due date
- Notes

**On save.** If outcome is `approved`, sets the supplier's `approval_status` to `approved`, sets `approved_at`, sets `next_audit_due_date`. If outcome is `not_approved`, sets to `prospect` if first audit or `delisted` if existing supplier — second case requires director sign-off and writes an event.

### 4.7 — Disputes index and detail

**Index.** Table of disputes, filterable by status, by category, by counterparty. Open and overdue disputes highlighted.

**Detail.** Full case file showing description, evidence documents, communication history, resolution path, cost attribution, and links to any corrective action records or supplier re-audits triggered.

### 4.8 — Concessions register

Read-mostly page listing every concession granted, with filters by customer, supplier, product, and date range. Useful for periodic management review and for spotting suppliers whose products consistently miss spec.

### 4.9 — Sanctions log

Append-only view of `sanctions_screens`. Filterable by subject, date, result. Each row links to the evidence document. Used for regulator audits and for periodic MLRO review.

### 4.10 — Dashboard revisions

Replace the v2 dashboard cards with these:

- **Pending verifications** (count of `verification_queue.status = 'pending'`)
- **Verifications overdue** (SLA breached) — red if non-zero
- **Orders in transit** (current state `in_transit`)
- **Disputes open** — amber if non-zero
- **Suppliers with audits due in 30 days** — amber if non-zero
- **Orders blocked on KYC or sanctions** — red if non-zero

Recent activity panel shows the last 10 `order_events`.

---

## 5. Authorisation model

ISO 27001 requires segregation of duties to be a technical control, not a procedural one. Define these roles in the application:

| Role | Permissions |
|---|---|
| `sales` | Create RFQs, draft orders, request concessions, raise dispute records |
| `procurement` | Draft supplier POs |
| `quality` | Review documents, mark conformity, draft release decisions |
| `verifier` | Approve PO translations and other drafted documents (different user from drafter) |
| `approver` | Approve supplier POs, approve releases (different user from drafter) |
| `finance` | Draft invoices, mark customer payments, mark supplier payments |
| `finance_reviewer` | Sign off invoices |
| `mlro` | Override sanctions blocks; approve KYC records |
| `director` | All of the above plus delisting suppliers |

In the early days with two users, both directors will hold most of these roles. The point is that the permission structure exists so that as the team grows, roles separate cleanly.

Implementation: store role assignments in a `user_roles` table. Each user can hold multiple roles. Every mutating API call checks the required role for that operation. The four-eyes constraints check role *and* user identity (drafter ≠ approver), not role alone.

---

## 6. Logging, monitoring, and audit hooks

### 6.1 — Event logging

Every state transition writes one `order_events` row. Every approval and rejection writes one. Every document upload writes one (`event_type = document_attached`). Every concession decision writes one. Every override writes one with `event_type = override` and a mandatory `reason_code`.

### 6.2 — Reason code vocabulary

Maintain a controlled vocabulary in a `reason_codes` reference table. Examples:

For PO translation rejection:
- `wrong_unit` — quantity unit mistranslated
- `wrong_incoterm` — incoterm not matching PO
- `missing_field` — required field not populated
- `price_mismatch` — entered price differs from PO
- `customer_mismatch` — wrong customer selected
- `other` — free text required

For sanctions override:
- `mlro_override_pending_screen` — MLRO approves transaction; screen will be repeated within 24 hours

Reason codes are enums in the database. Adding a new code requires a migration, not a free-text entry. This keeps reporting and process improvement metrics meaningful.

### 6.3 — Metrics for ISO 9001 monitoring (clause 9.1)

Build these as Supabase views, surfaced on a `portal/metrics/index.html` page:

- Verification turnaround time (median, p90) by queue type, by month
- Rejection rate by queue type, by drafter, by reason code
- Rework cycles per order (count of times an order returned to a previous state)
- Concession rate per supplier per quarter
- Dispute rate per supplier per quarter
- Average days to settle on each side (customer payment days, supplier payment days)
- SLA breach count per queue type per week

These feed the management review (clause 9.3).

### 6.4 — ISO 27001 hooks

- Every mutating API call writes a row to a separate `access_log` table: `(timestamp, user_id, ip_address, endpoint, method, resource_id, result)`
- Failed authentication attempts log to the same place with `result = 'auth_failed'`
- Privileged operations (MLRO override, supplier delisting, KYC approval) trigger an email to the directors in addition to logging
- Quarterly access review: report of who has which role, who logged in when, who used override permissions

---

## 7. Email ingestion

Customers will email POs in. A clean way to handle this:

**Phase 1 (now).** Manual: operator drags the email into the portal as a `.eml` or `.msg`, or uploads PDFs of the email body and PO attachment. The portal extracts attachments, stores them, creates an `inbound_emails` row, and offers a "Create order from this email" action.

**Phase 2 (next).** Resend inbound webhook on a dedicated address (e.g. `orders@vertexmetalsltd.com`). Webhook writes to `inbound_emails` automatically and runs basic classification (sender domain matches an existing customer? attachment looks like a PO?). Operator confirms the match and proceeds to order entry.

**Phase 3 (future).** OCR and field extraction on the PO PDF — pre-fills the order entry form with proposed values. The operator still has to review and submit to verification queue. The verifier still has to approve. The OCR is a productivity layer, not a control.

For v3, build phase 1 properly. Phases 2 and 3 are noted in the roadmap but out of scope for this build.

---

## 8. Tests and acceptance criteria

The vanilla-JS constraint from v2 makes traditional test runners awkward, but the following must be demonstrable manually before this build is considered done:

**State machine integrity**
1. Attempt to transition an order from `enquiry_received` directly to `in_transit` via a forged API call. API rejects.
2. Attempt to update a row in `order_events`. Database rejects.
3. Attempt to delete a row in `order_events`. Database rejects.

**Four-eyes enforcement**
1. User A drafts an order. User A attempts to approve it in the verification queue. UI hides the button; if the API call is forged, the API rejects.
2. User A drafts an order. User B approves it. Order moves to `order_verified`. `order_events` shows both actors.

**KYC and sanctions blocks**
1. Order verified for a counterparty whose `next_review_date` is in the past. Order automatically transitions to `kyc_blocked`. Supplier PO drafting is impossible.
2. Order verified for a counterparty whose `last_sanctions_screened_at` is older than 90 days. Order auto-transitions to `sanctions_blocked`. Only an MLRO override (logged with reason code) clears it.

**Concession flow**
1. Document review marks order non-conforming. Concession requested. Customer agrees in writing (uploaded). Concession record created. Order proceeds to `release_approved` with the concession linked. Concession appears in the concessions register.

**Dispute flow**
1. Customer raises a quality issue 10 days post-delivery. Dispute record created in `dispute_open`. Order's invoice issuance is blocked until dispute is resolved or commercial decision made.

**Audit trail**
1. Order goes from start to finish. The order's audit log can be exported as CSV showing every state change, every actor, every reason code.

---

## 9. Things this spec deliberately does not cover

To keep scope tight, these are explicitly out:

- Live FX rates (continue with manual entry)
- Multi-line POs (one product per order for v3; multi-line in a future spec)
- Customer self-service portal access for buyers to track their own orders
- Automated supplier portal for suppliers to upload their own documents
- LC (letter of credit) workflow integration with banks
- CBAM submission preparation and HMRC return generation (the data is being captured; the submission flow is later)
- ERP-style accounting integration
- Automated email parsing / OCR (noted in section 7 as a future phase)

These are real things that will need to be built. They are not in this build.

---

## 10. Build order suggestion

After v2 is complete, build in this order:

1. Reference tables: `order_states`, `order_state_transitions`, `reason_codes`. Load seed data.
2. Schema migrations: add `order_events`, `verification_queue`, `order_documents`, `inbound_emails`, `concessions`, `disputes`, `supplier_audits`, `sanctions_screens`. Update `trades` and `contacts`.
3. RLS policies and database constraints (especially the append-only triggers and the four-eyes check constraint).
4. API helper layer: a small `js/portal/state-machine.js` module that wraps state transitions, performs the allowed-transition check, writes to `order_events`, and updates `verification_queue` atomically.
5. Order Entry page (`portal/orders/new.html`).
6. Verification Queue page (`portal/verification-queue/index.html`).
7. Order Detail page (`portal/orders/detail.html`).
8. Suppliers index and detail with audit recording.
9. Concessions and disputes pages.
10. Sanctions log page.
11. Dashboard updates.
12. Metrics views and page.

Each of these can be a separate Claude Code session, with this document and v2 in context, plus the SVG flow diagram as visual reference.

---

## Appendix A — Related documents

- `vertex-metals-claude-code-prompt-v2.md` — base build specification (this document extends it)
- `Vertex_Metals_AML_KYC_CDD_Policy.md` — drives KYC, EDD, and onboarding rules
- `Vertex_Metals_Sanctions_Screening_Procedure.md` — drives sanctions screening frequency, list scope, match handling
- `vertex_metals_order_flow_with_four_eyes_gates.svg` — visual reference for the order flow
- `Orders__process_flow.pdf` — original informal process description (now superseded by section 2 of this document)

---

*Vertex Metals Ltd — Portal Order Flow Specification v3 — Addendum to v2 — May 2026*
