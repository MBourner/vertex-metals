# Vertex Metals Admin Portal — Supplier Page Specification

**Status:** Draft for review
**Purpose:** Brief for the planning agent. This document specifies the **supplier record page** of the Vertex Metals admin portal. It is a basis for review and an implementation plan — not a finished implementation doc. Treat the data-model and gating-logic sections as constraints; treat the layout as the intended shape, open to refinement.

---

## 1. Context

Vertex Metals Ltd is an Isle of Man–incorporated metals trading **intermediary** — it connects approved overseas suppliers (mills, miners, processors) with UK buyers, managing sourcing, compliance, logistics and documentation. Settlement is strictly non-cash (bank transfer and irrevocable / back-to-back letters of credit). The company is in pre-trading setup, onboarding its first suppliers.

The admin portal is the company's **overall operating platform**, not a compliance tool. It manages the day-to-day business: suppliers, buyers, RFQs, quotes, orders, shipping and finance. Compliance is a hard gate within it, but it must not dominate the experience.

**Primary users:** 2 directors who run the business end-to-end — sales, business development and operations — and who also hold compliance responsibilities (one as MLRO, one as Deputy MLRO). The portal must serve those commercial and operational roles first; the compliance function is one duty among several, not the directors' primary work. Low user count, high trust, but the portal is the system of record and must produce an audit trail.

### Design balance (important)

The portal is a **commercial workspace first, with compliance as an enforced gate behind it.** The resolution adopted here:

- The page surfaces **what a user can do with a supplier** (a *Permissions* switchboard) as the readable layer.
- Compliance state is one of several **inputs** that compute those permissions. It is authoritative but compressed — it shows up as the *reason* a permission is on or off, plus one dedicated module for detail. It does not occupy the main surface.

Do not over-index the page on compliance. The daily surface should read commercial.

---

## 2. Core design principles

These are architectural constraints, established prior to this spec. Honour them in the plan.

1. **Base entity is `Counterparty`, not `Supplier`.** A counterparty carries one or more **roles** (e.g. `GoodsSupplier`, `LogisticsProvider`, `PackagingSupplier`). The role — not a tag — carries the lifecycle, gates, modules and permissions. A freight forwarder and a metals mill are different lifecycles, not two skins of one onboarding flow.

2. **Two kinds of gate — keep them distinct.**
   - **Soft / commercial gates** (e.g. *quote-eligible*) are progressive and may be shown as a percentage / progress bar.
   - **Hard / legal gates** (e.g. *trade-approved* = on the Approved Supplier List) are **binary and MLRO-controlled**. Never render a hard gate as a percentage — show it as on/off with a checklist of what's outstanding. A supplier is approved or not; there is no "80% approved."

3. **Approval decays — model time on the approval itself, not just on documents.** Trade-approval has a shelf-life driven by policy:
   - Pre-trade sanctions screening must be ≤ 90 days old at the point of a new trade.
   - Periodic re-screen at least every 6 months.
   - On-site re-audit every 2 years.
   - Annual document refresh.

   The order flow must check screening currency as a gate. A stale screen should auto-flag and revert trade-readiness rather than relying on a human to remember.

4. **Documents ≠ evidence.**
   - **Documents** are refreshable files with expiry/status (registration cert, mill cert, bank letter, ESG policy). States: *missing / pending / verified / expiring / expired*.
   - **Evidence** is an immutable record that a check happened (e.g. "sanctions screen run 2026-06-13 vs OFSI/UN/EU/OFAC, no match, by MLRO"). It is never edited — you append a new record. The activity/evidence feed is **append-only with provenance** (actor, action, timestamp, source, result) and is the audit trail. Design this immutability in from the start; retrofitting it later is costly.

5. **Bank details are a controlled field.** A change to supplier banking is a **flagged, logged, re-verified event**, never a quiet form edit. (Third-party / changed payee is a known fraud and SAR vector.)

6. **Permissions are computed, not stored as free-standing flags.** Derive them from a requirements engine over the counterparty's state. A manual override is allowed but is recorded as a decision, not a silent flag flip. This prevents drift (e.g. "verified bank = false" but "outbound payments = on").

---

## 3. Page anatomy

The supplier page has five regions: **Header**, **Overview cards**, **Modules**, **Quick actions**, **Permissions**.

### 3.1 Sticky header (always visible)

| Zone | Contents |
|---|---|
| Left | Logo / initials, legal name, country flag, role tags (multiple allowed, e.g. `Goods supplier`, `Logistics`) |
| Centre | Lifecycle status badge (`Prospect` → `Quote-eligible` → `Trade-approved` → `Suspended`) + one-line capability summary derived from permissions (e.g. "Quoting on · Ordering off") |
| Right | Context-aware quick actions (§3.4) |

### 3.2 Overview cards (at-a-glance row — business first)

Order deliberately leads with operational, not compliance:

1. **Commercial snapshot** — commodities, capacity, incoterms, lead time, currency, supplier's payment terms to us.
2. **Activity snapshot** — open RFQs, live orders, last contact.
3. **Performance** (once trading) — on-time %, quality acceptance %, orders completed, total value.
4. **Permissions summary** — condensed switchboard (full version in module §3.5).
5. **Compliance snapshot** — risk tier, screening valid-until, trade-approval state. One card among several — not the hero.

### 3.3 Modules (left-nav / tabbed; cards-not-forms)

Inside each module, prefer cards with click-to-edit panels over large monolithic forms.

**Common to all supplier roles:**
`Overview` · `Commercial` · `Documents` · `Finance` · `Activity` · `Permissions` · `Compliance`

> The `Compliance` module holds the trade-approval gate, the outstanding-items checklist, and the append-only evidence feed. It is available but **out of the daily path** — users do not need to enter it to do commercial work.

**Type-dependent modules (revealed by role):**

| Role | Modules |
|---|---|
| Goods supplier (metals/minerals) | Products & grades · Quality (assays / COA) · Export & logistics |
| Logistics / shipping | Transport capability · Coverage · Operations & SLA · Licences & cargo insurance |
| Packaging | Packaging capability · Production · Technical & certs |

A counterparty with multiple roles shows the union of relevant modules.

### 3.4 Quick actions (header, context-aware)

Show only actions valid for the current state. **Disable with a tooltip reason rather than hide**, so users learn the gates.

| Context | Actions |
|---|---|
| Always | Edit · Add note · Request docs/info · View activity |
| Quote-eligible | Create quote · Add to RFQ |
| Trade-approved | Create supplier PO · Add to shipping request · Add opportunity |
| MLRO / authorised | Submit for approval · Approve · Suspend · Re-screen now |

Action verbs map to the order process flow: enquiry/quote → RFQ → supplier PO → shipping request → pay supplier.

### 3.5 Permissions (type-dependent switchboard)

The heart of the page and the bridge between compliance and usability. Each capability shows an **on/off state** and, when off, **why** and **what unblocks it**.

- Permissions are **derived** from the requirements engine (§5).
- An authorised user may **manually suspend or override** a permission; the override is recorded with actor + reason.
- Distinguish lock types in the UI:
  - **Derived lock** — cannot be toggled on; the prerequisite must be satisfied.
  - **Manual lock** — can be lifted by an authorised role.

**Goods supplier — example permission set:**

| Capability | State | Gated by |
|---|---|---|
| Appear in customer quotes | On | Product + pricing data complete |
| Receive RFQs | On | Status ≥ quote-eligible |
| Receive supplier PO (ordering) | Off | Requires trade-approved (audit outstanding) |
| Outbound payments | Off | Requires trade-approved + verified bank |
| Preferred / strategic supplier | Off | Manual flag |

**Logistics / shipping — example permission set:**

| Capability | State | Gated by |
|---|---|---|
| Provide freight quotes | On | — |
| Book shipment | On | Valid licences + cargo insurance current |
| Outbound payments | Off | Requires verified bank |

Each row: state pill · gated-by reason · (for authorised roles) suspend/allow toggle. This is what lets compliance stay authoritative without crowding the page — the gate result appears as a single "Off" with a reason, not a wall of CDD detail.

---

## 4. Data model implications

Plan the schema for this even where the UI is initially thin — it is cheap to design now and expensive to migrate later.

```
Counterparty (base entity)
├── roles: [GoodsSupplier | LogisticsProvider | PackagingSupplier | ...]   (many)
│     └── each role: own readiness, gates, modules, permission set
├── ComplianceState
│     ├── riskTier (standard | elevated | high)  → drives Standard vs Enhanced DD
│     ├── ddRecords (standard / enhanced, completion + approver)
│     ├── auditRecords (on-site; date; grandfathered exception flag)
│     └── screeningEvents []   ← append-only, dated; scope: entity, directors,
│                                  UBOs ≥25%, signatories, parent/group
├── Documents []        (file, type, status, expiry)
├── EvidenceEvents []    ← APPEND-ONLY, immutable: actor, action, timestamp, source, result
├── BankDetails         ← CONTROLLED: change = flagged event + re-verify, logged as evidence
├── Permissions         ← COMPUTED from requirements engine; manual overrides recorded
└── Commercial / Products / Performance (role-dependent)
```

Notes:
- `trade_approved` is **derived state set only by an MLRO approval action**, and decays (see §2.3). It is not a plain boolean a user can edit.
- The **approvable unit** for a goods supplier is effectively `(counterparty, role, commodity)` — keep room for commodity-level scoping even if the first build approves at role level.
- `EvidenceEvents` and `screeningEvents` are never updated in place.

---

## 5. Gating logic / requirements engine

Permissions and hard gates are computed by a rules engine over counterparty state. Express rules as data, not hardcoded forms, so onboarding stays maintainable as new roles/commodities appear.

**Hard gate — `trade_approved` (goods supplier):** set true only by MLRO approval action, requiring *all* of:
- Standard (or Enhanced, where risk tier elevated/high) DD complete
- Sanctions screen clear across entity + directors + UBOs ≥25% + signatories + parent, within currency window
- ESG / responsible-sourcing evidence on file (stricter for high-risk materials)
- On-site facility audit complete — **unless** grandfathered (prior trading history accepted as alternative assurance; audit then due within 12 months)

**Auto-revert:** `trade_approved` → `review_required` when screening exceeds 90 days at next-trade, periodic re-screen overdue, audit cycle lapsed, or any material adverse change (sanctions proximity, ownership change, adverse media, quality incident).

**Example permission rules (pseudocode):**

```
appear_in_quotes      := products.pricing.complete
receive_rfq           := status >= quote_eligible
place_supplier_po     := role == GoodsSupplier AND trade_approved
outbound_payment      := trade_approved AND bank_details.status == verified
book_shipment         := role == LogisticsProvider
                         AND licences.valid AND cargo_insurance.current
```

Manual override: any permission may be force-suspended (always allowed) or force-enabled (only where a derived lock permits override), each recorded as a decision with actor + reason + timestamp in `EvidenceEvents`.

---

## 6. Build phasing (recommendation for the plan)

The company has one supplier and two users. Avoid building the full engine and all role modules on day one — but get the schema right.

**Phase 1 (build now):**
- Schema per §4 (counterparty/roles/gates/screening events/append-only evidence/controlled bank/computed permissions).
- One goods-supplier record: Overview, Commercial, Documents, Products, Activity, Compliance, Permissions.
- Binary trade-approval gate (MLRO action) + outstanding-items checklist.
- Screening-currency surfacing (valid-until / re-screen due) with auto-flag.
- Permissions switchboard, derived, with manual override + reason logging.

**Defer (schema should leave room, so adding them is not a migration):**
- Logistics / packaging role modules.
- Editable rules-engine UI (rules can start as code/config).
- Performance analytics.

**Related, out of scope for this page but recommended early:** a **global worklist** ("what needs the MLRO today" across all counterparties), seen before navigating into any record. Higher daily value than the per-record action rail at this scale.

---

## 7. Non-goals

- This is the **supplier** page. Buyer onboarding, credit framework, order lifecycle, and shipping are separate specs (referenced here only where they consume supplier permissions).
- Not a CRM clone — do not import generic contact-management assumptions that conflict with the counterparty/role model.

---

## 8. For the planning agent

Please produce:
1. A short **review** of this spec — gaps, ambiguities, anything that conflicts with a clean implementation.
2. A **phased implementation plan** aligned to §6, with the data model (§4) and gating logic (§5) as fixed constraints and the layout (§3) as the intended shape.
3. Flag any rule in §5 that needs a product decision before it can be implemented.
