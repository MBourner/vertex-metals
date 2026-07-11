-- Adds a "Type" (physical form — bar, rod, ingot, powder, etc.) field to the
-- product catalogue, and lets the customer-facing quote show Product/Type
-- alongside the existing Specification (grade_specification) per line.
ALTER TABLE product_lines
  ADD COLUMN IF NOT EXISTS physical_form text;

ALTER TABLE customer_quote_lines
  ADD COLUMN IF NOT EXISTS product_family text,
  ADD COLUMN IF NOT EXISTS product_type   text;
