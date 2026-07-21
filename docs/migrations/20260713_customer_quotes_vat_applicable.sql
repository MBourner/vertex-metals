-- Lets a specific RFQ/quote be marked VAT-exempt (VM is not yet VAT
-- registered, and some trades are 'string' chain trades that never touch
-- the UK). When false, the customer-facing quote omits the VAT column,
-- VAT summary, and VAT total row entirely rather than showing 0%.
ALTER TABLE customer_quotes
  ADD COLUMN IF NOT EXISTS vat_applicable boolean NOT NULL DEFAULT true;
