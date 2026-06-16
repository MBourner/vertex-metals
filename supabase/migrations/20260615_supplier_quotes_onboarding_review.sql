-- ============================================================
-- Supplier Onboarding: Products Offered review
-- Vertex Metals Ltd — Migration 20260615
-- ============================================================
-- Stage 1a (onboard.html) lets the supplier registration capture
-- the product lines a supplier is offering to supply, linked via
-- a supplier_quotes row (status = 'pending', as already used by
-- the supplier detail page's "Products" tab).
--
-- These two new columns let the compliance director review and
-- approve/reject each product line individually during Stage 1b
-- (compliance-review.html), independently of the commercial
-- `status` field (pending|active|expired|used).
--
-- App-enforced enum, no CHECK constraint (matches the
-- workflow_stage pattern):
--   onboarding_review_status: NULL (not part of an onboarding
--     review — e.g. added later via the detail page) |
--     'pending_review' | 'approved' | 'rejected'
-- ============================================================

ALTER TABLE supplier_quotes
  ADD COLUMN IF NOT EXISTS onboarding_review_status text,
  ADD COLUMN IF NOT EXISTS onboarding_review_notes text;
