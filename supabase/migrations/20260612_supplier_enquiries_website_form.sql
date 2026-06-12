-- ============================================================
-- supplier_enquiries — Website Partner Form Wiring
-- Vertex Metals Ltd
-- Migration: 20260612
-- ============================================================
-- 1. Adds the `certifications` column, captured by the
--    partners.html "Register Your Interest" form but missing
--    from the 20260603b extended-fields migration.
-- 2. Allows the anonymous (public website) role to insert
--    enquiries directly into the queue, scoped to website-form
--    submissions in 'new' status only.
-- ============================================================

ALTER TABLE supplier_enquiries
  ADD COLUMN IF NOT EXISTS certifications text;

CREATE POLICY "Anon insert website partner enquiries"
  ON supplier_enquiries FOR INSERT
  TO anon
  WITH CHECK (
    source = 'website_form'
    AND status = 'new'
  );
