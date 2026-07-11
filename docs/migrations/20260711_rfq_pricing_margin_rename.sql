-- Reverts the RFQ pricing calculator's customer-facing input back to Gross
-- Margin % (was briefly switched to Markup %) — see DEVELOPMENT.md. Renaming
-- the column back so its name matches what it actually stores.
ALTER TABLE rfq_submissions
  RENAME COLUMN pricing_markup_pct TO pricing_margin_pct;
