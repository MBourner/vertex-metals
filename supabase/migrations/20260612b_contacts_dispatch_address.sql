-- ============================================================
-- contacts — Dispatch / Warehouse Address
-- Vertex Metals Ltd
-- Migration: 20260612b
-- ============================================================
-- contacts already carries a registered/company address
-- (address_line_1, address_line_2, city, postcode, country).
-- This adds an optional separate dispatch/warehouse address,
-- used where goods are shipped from a different location to
-- the supplier's registered company address.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS dispatch_address_line_1 text,
  ADD COLUMN IF NOT EXISTS dispatch_address_line_2 text,
  ADD COLUMN IF NOT EXISTS dispatch_city           text,
  ADD COLUMN IF NOT EXISTS dispatch_postcode       text,
  ADD COLUMN IF NOT EXISTS dispatch_country        text;
