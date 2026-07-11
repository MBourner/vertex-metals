-- Persists the RFQ pricing calculator's last-used settings (previously held only
-- in an in-memory JS variable, so they silently reset to defaults every time the
-- operator navigated away from the RFQ and back in).
ALTER TABLE rfq_submissions
  ADD COLUMN IF NOT EXISTS pricing_scenario_supplier_id uuid REFERENCES contacts(id),
  ADD COLUMN IF NOT EXISTS pricing_logistics_quote_id   uuid REFERENCES logistics_quotes(id),
  ADD COLUMN IF NOT EXISTS pricing_fx_rate               numeric(10,4),
  ADD COLUMN IF NOT EXISTS pricing_insurance_pct         numeric(6,3),
  ADD COLUMN IF NOT EXISTS pricing_model                 text,
  ADD COLUMN IF NOT EXISTS pricing_markup_pct             numeric(6,2);
