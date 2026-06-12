-- ============================================================
-- supplier_enquiries — Extended Fields
-- Vertex Metals Ltd
-- Migration: 20260603b
-- ============================================================
-- Adds the additional fields captured by the website partner
-- enquiry form (partners.html). Run after 20260603.
-- All columns are nullable — existing rows are unaffected.
-- ============================================================

ALTER TABLE supplier_enquiries
  ADD COLUMN IF NOT EXISTS hq_address           text,
  ADD COLUMN IF NOT EXISTS website              text,
  ADD COLUMN IF NOT EXISTS position_title       text,
  ADD COLUMN IF NOT EXISTS supply_capacity_mt   text,
  -- Stored as text: suppliers may provide a range ("200–500 MT/month")
  ADD COLUMN IF NOT EXISTS export_markets       text,
  ADD COLUMN IF NOT EXISTS testing_procedures   text,
  ADD COLUMN IF NOT EXISTS shipping_terms       text;
  -- Incoterm code or 'Open': 'FOB' | 'CIF' | 'CFR' | 'FCA' | 'EXW' | 'DDP' | 'Open'
