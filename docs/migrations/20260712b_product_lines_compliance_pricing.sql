-- Adds compliance tracking (UK/EU REACH, other import restrictions) and a
-- sourced market price reference (Fastmarkets/SMM code + last-updated date)
-- to product_lines, for the new Product Line detail page.
--
-- Note: product_families already has a family-level `reach_regulated` /
-- `reach_notes` flag (20260627_product_families_reach.sql) — that stays as
-- the family default shown for context. These new columns are product-line
-- specific (a single product within a family can differ from the family norm).
ALTER TABLE product_lines
  ADD COLUMN IF NOT EXISTS reach_uk_regulated         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reach_uk_notes             text,
  ADD COLUMN IF NOT EXISTS reach_eu_regulated         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reach_eu_notes             text,
  ADD COLUMN IF NOT EXISTS import_restrictions_notes  text,
  ADD COLUMN IF NOT EXISTS price_reference_source     text,  -- 'fastmarkets' | 'smm' | 'manual'
  ADD COLUMN IF NOT EXISTS price_reference_code       text,  -- e.g. Fastmarkets/SMM ticker or code
  ADD COLUMN IF NOT EXISTS price_reference_updated_at date;  -- when market_reference_price_* was last refreshed
