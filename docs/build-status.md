# Vertex Metals Portal — Build Status

Single source of truth for what's implemented, what's partial, and what's queued.
Update this file whenever a feature is completed, scoped, or deprioritised.

---

## Legend
- ✅ Complete — production-ready
- 🔶 Partial — built but gaps noted
- 🔲 Pending — scoped, not yet started
- 💡 Idea — raised but not formally scoped

---

## Core Infrastructure

| Item | Status | Notes |
|---|---|---|
| Authentication (login / session guard) | ✅ | `auth.js`, `portal-guard.js` |
| Sidebar navigation | ✅ | `sidebar.js` — single source of truth for nav |
| Role-based access control | ✅ | `auth-roles.js` |
| State machine (order lifecycle) | ✅ | `state-machine.js` wraps 3 Supabase SECURITY DEFINER RPCs |

---

## Operations

| Item | Status | Notes |
|---|---|---|
| Orders — list | ✅ | Filter by state, search, click-through |
| Orders — new / draft | ✅ | Multi-panel form, PO upload, submits to verification queue |
| Orders — detail | ✅ | Full lifecycle action panel: all 12 remaining state transitions wired up with data-capture forms |
| Orders — supplier PO draft | ✅ | Full form, saves to `supplier_pos`, state machine / re-queue on rejection |
| Orders — supplier PO PDF | ✅ | html2pdf.js, A4 Vertex letterhead template, downloads as `VM-SPO-*.pdf` |
| Verification queue | ✅ | Two-eyes approval, SLA badges, claim/review/decide |
| RFQ inbox — list | ✅ | Filter by status/type |
| RFQ inbox — detail | ✅ | Enquiry info, recommended price panel, linked supplier/logistics quotes, create customer quote modal, auto-advance to `quoted` status |
| Supplier quotes — list | ✅ | FOB quotes, status filter, inline detail expand |
| Supplier quotes — calculator (pricing) | ✅ | Full rebuild: product cascade, 3 pricing models, override slider, save as standard |
| Logistics quotes | ✅ | New module: provider, route, mode, price/MT, links to RFQ |
| Customer quotes | ✅ | Created from RFQ detail; stored in `customer_quotes` table |
| Customer quote → Order conversion | ✅ | Mark quote sent/accepted; "Create Order →" button converts accepted quote to a trade in the verification queue |
| Product lines | ✅ | Metal family / subtype hierarchy, standard price, market reference price |
| Trades — list | ✅ | |
| Trades — detail | 🔶 | Page exists; relationship to Orders/current_state flow needs clarifying |

---

## Compliance & Counterparties

| Item | Status | Notes |
|---|---|---|
| Contacts (CRM) | ✅ | Types: buyer, supplier, logistics, other |
| KYC records — list | ✅ | Status, risk rating, overdue highlighting |
| KYC records — detail | 🔶 | Page exists; content not fully implemented |
| Supplier register — list | ✅ | Status, audit due, sanctions screen date |
| Supplier register — detail | ✅ | Tabbed: Profile, Audits, Orders, Concessions, Disputes, Sanctions, KYC |
| Supplier audit form | ✅ | |
| Disputes — list | ✅ | Filter by status and category |
| Disputes — detail | 🔶 | Page exists; content not fully implemented |
| Sanctions log | ✅ | Append-only, OFSI/UN/EU/OFAC |
| CBAM tracker | ✅ | UK CBAM (effective 2027), CN codes, tCO₂e |
| Concessions register | ✅ | |

---

## Finance & Reporting

| Item | Status | Notes |
|---|---|---|
| Financials dashboard | ✅ | Period KPIs, P&L table, VAT return panel, trade payment tracking |
| Metrics (ISO 9001) | ✅ | Verification turnaround, rejection rates, SLA breach, payment days, concession/dispute rates |
| Dashboard (executive summary) | ✅ | KPI cards, pending verifications, open disputes, supplier audits due |

---

## Schema & Data

| Item | Status | Notes |
|---|---|---|
| SQL migration — pricing/quoting/PO chain | ✅ | `docs/migration-pricing-quoting-po.sql` — run in Supabase SQL Editor |
| Backfill `product_line_id` on existing supplier quotes | 🔲 | Required for pricing calculator quote dropdowns to populate |
| `supabase-schema.md` — new tables documented | 🔲 | `logistics_quotes`, `customer_quotes`, `supplier_pos` not yet in schema doc |
| Trades vs Orders ambiguity | 🔶 | Both `trades/` and `orders/` modules exist. `trades` is the primary DB table; `orders/` is the newer workflow-driven UI. Needs a decision on whether `trades/` list/detail pages are kept or deprecated. |

---

## Not Yet Started

| Item | Priority | Notes |
|---|---|---|
| Customer quote → Order/trade conversion | ✅ | Done |
| Order detail page — complete | ✅ | Done — all state transitions, inline forms, invoice, payment |
| User roles — Supabase setup + actor_role display | 🔲 Medium | Users need roles assigned in Supabase so actor_role logs correctly in order events / timeline (currently shows 'sales' regardless). Requires user records + roles configured in Supabase Auth / user_roles table. |
| Sidebar role label — dynamic from actual user role | ✅ | `sidebar.js` now has `id="user-role"`; `portal-guard.js` sets it from `PortalRoles.getRoles()` after auth. Falls back to "Director" until `user_roles` table is populated. |
| Email notifications | 🔲 Medium | Supabase DB webhook → Edge Function → Resend. Triggers: RFQ received, quote sent, PO approval decision, order state changes |
| Verification queue — filter reason codes by queue type | 🔲 Medium | Rejection reason codes in the decision modal are currently unfiltered — the same list appears for all queue types. Reason codes should be scoped to the queue type: PO translation reasons for `po_translation`, shipping/doc reasons for `release_approval`, etc. Requires either a `queue_type` column on `reason_codes` table, or a mapping in the verification queue JS. |
| Dispute detail page — complete | 🔲 Medium | |
| KYC detail page — complete | 🔲 Low | |
| Supplier quotes — link product line | ✅ | Quotes list shows Product Line column; add form includes Product Line dropdown; inline detail allows linking/updating on existing quotes |
| `supabase-schema.md` update | 🔲 Low | Document the 3 new tables from the pricing/PO migration |
| Trades list/detail — deprecate or integrate | 🔲 Low | Decide if `trades/` pages are replaced by `orders/` workflow |

---

## Migrations Applied

| File | Description | Applied |
|---|---|---|
| `docs/migrations/phase-1-v3-schema.sql` | Core schema (contacts, trades, rfq, product_lines, etc.) | ✅ |
| `docs/migrations/phase-3-trades-columns.sql` | Extended trades columns (pricing, invoice, payment) | ✅ |
| `docs/migrations/phase-5-logistics.sql` | Logistics-related columns | ✅ |
| `docs/migrations/phase-6-metrics-views.sql` | Metrics reporting views | ✅ |
| `docs/migration-pricing-quoting-po.sql` | logistics_quotes, customer_quotes, supplier_pos, new FK columns | ✅ Pending — run in Supabase |
| `docs/migrations/phase-7-unblock-transitions.sql` | Unblock state machine transitions + shipment/delivery trades columns | 🔲 Pending — run in Supabase |
