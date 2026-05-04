# Vertex Metals Portal — Claude Context

Internal management portal. Auth-gated. Vanilla HTML/CSS/JS + Supabase. See root `CLAUDE.md` for stack and design system.

## Authentication

`portal-guard.js` is an IIFE that runs on every portal page:

```
body.visibility = hidden
→ requireAuth()  (auth.js)
    ├── session valid → body.visibility = visible → page loads
    └── no session   → redirect to /portal/login.html
```

Never bypass the guard. Always include `portal-guard.js` before any page-specific script.

## CSS

Portal pages use `portal.css` (not `layout.css`). Sidebar and topbar are handled entirely by `portal.css`.

## Portal Module Pattern

Every portal JS file follows this structure:

1. `esc(s)` helper — XSS-safe string escaping. Defined per-file (not a shared import).
2. Optional helpers: `fmt(n, dp)` (number formatting), `fmtDate(d)`, `fmtDateTime(d)` for complex modules.
3. `loadXxx()` — fetches from Supabase, renders into a tbody or container element.
4. `buildXxxForm()` — returns an HTML string for add/edit modals.
5. `submitXxx(event)` — reads form, validates, INSERTs or UPDATEs via Supabase.
6. IIFE at the bottom — calls `getCurrentUser()`, sets email in topbar, then calls `loadXxx()`.

**XSS rule:** Always use `esc()` for any user-supplied or database-sourced data written into `innerHTML`. Never use raw string interpolation with untrusted values.

## State Machine (Orders)

Order state transitions go through Supabase RPC functions (`js/portal/state-machine.js`), never by writing directly to `trades.current_state`. The RPCs are `SECURITY DEFINER` Postgres functions that enforce allowed transitions, four-eyes constraints, and audit logging.

```js
// Correct — always use StateMachine
const result = await StateMachine.transition(tradeId, 'quoted', { notes: '...' });
const result = await StateMachine.decide(queueItemId, 'approved', { notes: '...' });

// Wrong — never do this
await supabaseClient.from('trades').update({ current_state: 'quoted' }).eq('id', tradeId);
```

`StateMachine` also provides `getBadgeClass(state)` and `getAllowedTransitions(state)` for UI rendering.

## Auth Roles

`js/portal/auth-roles.js` provides role-based access control. Use it to conditionally show/hide actions based on the current user's role (e.g. only certain roles can approve state transitions).

## Module Inventory

| Module | Files |
|---|---|
| Dashboard | `dashboard.html`, `js/portal/dashboard.js` |
| RFQs | `rfq/index.html`, `rfq/detail.html`, `js/portal/rfq.js` |
| Quotes | `quotes/index.html`, `quotes/calculator.html`, `js/portal/quotes.js`, `js/portal/calculator.js` |
| Orders | `orders/index.html`, `orders/detail.html`, `orders/new.html`, `orders/supplier-po.html` |
| Orders JS | `js/portal/orders.js`, `orders-detail.js`, `orders-new.js`, `orders-supplier-po.js` |
| Trades | `trades/index.html`, `trades/detail.html`, `js/portal/trades.js` |
| KYC | `kyc/index.html`, `kyc/detail.html`, `js/portal/kyc.js` |
| Contacts | `contacts/index.html`, `js/portal/contacts.js` |
| Suppliers | `suppliers/index.html`, `suppliers/detail.html`, `suppliers/audit.html`, `js/portal/suppliers.js`, `suppliers-detail.js`, `suppliers-audit.js` |
| Disputes | `disputes/index.html`, `disputes/detail.html`, `js/portal/disputes.js` |
| Financials | `financials/index.html`, `js/portal/financials.js` |
| Product Lines | `product-lines/index.html`, `js/portal/product-lines.js` |
| Concessions | `concessions/index.html`, `js/portal/concessions.js` |
| CBAM | `cbam/index.html`, `js/portal/cbam.js` |
| Verification Queue | `verification-queue/index.html`, `js/portal/verification-queue.js` |
| Metrics | `metrics/index.html`, `js/portal/metrics.js` |
| Sanctions Log | `sanctions/log.html`, `js/portal/sanctions.js` |
| Sidebar | `js/portal/sidebar.js` |
| State Machine | `js/portal/state-machine.js` |
| Auth Roles | `js/portal/auth-roles.js` |

## Supabase Pattern

Direct client calls from the browser. RLS policies on Supabase enforce access control server-side — the client does not need to re-check permissions for reads/writes that Supabase RLS already governs. However, UI-level role checks (showing/hiding action buttons) still use `auth-roles.js`.

Full schema: `docs/supabase-schema.md`
