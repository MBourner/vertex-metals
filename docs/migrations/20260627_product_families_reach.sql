-- =============================================================================
-- Vertex Metals — Migration: UK REACH flag on product_families
-- Run in Supabase SQL Editor in one pass.
-- =============================================================================

ALTER TABLE product_families
  ADD COLUMN IF NOT EXISTS reach_regulated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reach_notes     text;
