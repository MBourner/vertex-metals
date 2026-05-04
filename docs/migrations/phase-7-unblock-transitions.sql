-- =============================================================================
-- Phase 7: Unblock order state transitions + new trades shipment/delivery columns
--
-- Run in Supabase SQL Editor.
--
-- Problem: Several transitions were either missing from order_state_transitions
-- or flagged is_system_triggered = true (intended for future email automation),
-- which caused getAllowedTransitions() to return nothing for those states.
-- The most visible symptom: orders stuck at supplier_po_approved with no actions.
--
-- Design decisions:
--   - required_role = null for all rows: for a 2-person team, per-transition role
--     gating is unnecessary and would silently block the journey. Four-eyes is
--     enforced by the verification queue mechanism where it counts.
--   - docs_under_review → release_approved intentionally omitted: that path is
--     owned by the request_release_approval RPC and must not appear as a button.
-- =============================================================================

-- Safe pattern: delete conflicting rows first (table may lack a unique constraint)
DELETE FROM order_state_transitions
WHERE (from_state, to_state) IN (
  ('supplier_po_approved',   'supplier_po_issued'),
  ('supplier_po_issued',     'awaiting_supplier_docs'),
  ('awaiting_supplier_docs', 'docs_under_review'),
  ('docs_under_review',      'non_conforming'),
  ('non_conforming',         'concession_requested'),
  ('non_conforming',         'awaiting_rework'),
  ('concession_requested',   'concession_granted'),
  ('concession_requested',   'concession_declined'),
  ('concession_granted',     'release_approved'),
  ('concession_declined',    'awaiting_rework'),
  ('awaiting_rework',        'docs_under_review'),
  ('release_approved',       'in_transit'),
  ('in_transit',             'delivered'),
  ('delivered',              'invoice_drafted'),
  ('delivered',              'dispute_open'),
  ('invoice_drafted',        'invoice_issued'),
  ('invoice_issued',         'customer_paid'),
  ('customer_paid',          'supplier_paid'),
  ('supplier_paid',          'complete'),
  ('dispute_open',           'invoice_drafted'),
  ('dispute_open',           'cancelled')
);

INSERT INTO order_state_transitions
  (from_state, to_state, requires_approval, required_role, is_system_triggered)
VALUES
  ('supplier_po_approved',   'supplier_po_issued',      false, null, false),
  ('supplier_po_issued',     'awaiting_supplier_docs',  false, null, false),
  ('awaiting_supplier_docs', 'docs_under_review',       false, null, false),
  ('docs_under_review',      'non_conforming',          false, null, false),
  ('non_conforming',         'concession_requested',    false, null, false),
  ('non_conforming',         'awaiting_rework',         false, null, false),
  ('concession_requested',   'concession_granted',      false, null, false),
  ('concession_requested',   'concession_declined',     false, null, false),
  ('concession_granted',     'release_approved',        false, null, false),
  ('concession_declined',    'awaiting_rework',         false, null, false),
  ('awaiting_rework',        'docs_under_review',       false, null, false),
  ('release_approved',       'in_transit',              false, null, false),
  ('in_transit',             'delivered',               false, null, false),
  ('delivered',              'invoice_drafted',         false, null, false),
  ('delivered',              'dispute_open',            false, null, false),
  ('invoice_drafted',        'invoice_issued',          false, null, false),
  ('invoice_issued',         'customer_paid',           false, null, false),
  ('customer_paid',          'supplier_paid',           false, null, false),
  ('supplier_paid',          'complete',                false, null, false),
  ('dispute_open',           'invoice_drafted',         false, null, false),
  ('dispute_open',           'cancelled',               false, null, false);

-- New columns for shipment and delivery data capture
-- invoice_number, invoice_date, vat_amount_gbp, payment_received_date,
-- payment_received_gbp, supplier_payment_date, supplier_payment_gbp
-- already exist from phase-3-trades-columns.sql
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS po_sent_date             DATE,
  ADD COLUMN IF NOT EXISTS bl_reference             TEXT,
  ADD COLUMN IF NOT EXISTS carrier_name             TEXT,
  ADD COLUMN IF NOT EXISTS estimated_arrival        DATE,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_date  DATE;

-- Verify: should return 21 rows with is_system_triggered = false
-- SELECT from_state, to_state, is_system_triggered FROM order_state_transitions
-- WHERE from_state IN ('supplier_po_approved','supplier_po_issued','awaiting_supplier_docs',
--   'docs_under_review','non_conforming','concession_requested','concession_granted',
--   'concession_declined','awaiting_rework','release_approved','in_transit',
--   'delivered','invoice_drafted','invoice_issued','customer_paid','supplier_paid',
--   'dispute_open')
-- ORDER BY from_state, to_state;
