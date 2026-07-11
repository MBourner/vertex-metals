-- Lets "Other Costs" on the RFQ Cost Inputs tab be entered in USD or GBP.
-- amount_gbp remains the authoritative GBP-equivalent value used throughout the
-- pricing calculator; amount_original/currency record what was actually typed in,
-- for display and editing.
ALTER TABLE rfq_overhead_costs
  ADD COLUMN IF NOT EXISTS currency        text CHECK (currency IN ('GBP','USD')) DEFAULT 'GBP',
  ADD COLUMN IF NOT EXISTS amount_original numeric(14,2);
