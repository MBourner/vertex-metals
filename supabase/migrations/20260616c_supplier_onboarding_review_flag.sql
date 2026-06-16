-- ============================================================
-- Supplier Onboarding Redesign: Meaningful-Change Review Flag
-- Vertex Metals Ltd — Migration 20260616c
-- ============================================================
-- review_required is set true when an ad-hoc edit to a supplier
-- field causes a compliance or commercial rating-band change,
-- a newly-triggered auto-reject factor, or a commercial-band
-- drop. Used by Phase D (ad-hoc recompute + notifications).
-- ============================================================

ALTER TABLE supplier_onboarding
  ADD COLUMN IF NOT EXISTS review_required        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_required_reason text;
