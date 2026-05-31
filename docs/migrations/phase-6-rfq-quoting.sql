-- ============================================================
-- Phase 6: RFQ Quoting Workflow Enhancement
-- Apply in Supabase SQL Editor
-- ============================================================

-- 0. Add product line link + specifications to rfq_submissions
ALTER TABLE rfq_submissions
  ADD COLUMN IF NOT EXISTS product_line_id uuid REFERENCES product_lines(id);
ALTER TABLE rfq_submissions
  ADD COLUMN IF NOT EXISTS specifications text;

-- 1. Add address + VAT fields to contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS address_line_1 text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS city           text,
  ADD COLUMN IF NOT EXISTS postcode       text,
  ADD COLUMN IF NOT EXISTS vat_number     text;

-- 2. Extend customer_quotes with full quote fields
ALTER TABLE customer_quotes
  ADD COLUMN IF NOT EXISTS quote_reference          text,
  ADD COLUMN IF NOT EXISTS magic_link_token         uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS issued_date              date,
  ADD COLUMN IF NOT EXISTS customer_name            text,
  ADD COLUMN IF NOT EXISTS customer_company         text,
  ADD COLUMN IF NOT EXISTS customer_address_line_1  text,
  ADD COLUMN IF NOT EXISTS customer_address_line_2  text,
  ADD COLUMN IF NOT EXISTS customer_city            text,
  ADD COLUMN IF NOT EXISTS customer_postcode        text,
  ADD COLUMN IF NOT EXISTS customer_country         text,
  ADD COLUMN IF NOT EXISTS customer_vat_number      text,
  ADD COLUMN IF NOT EXISTS payment_terms            text,
  ADD COLUMN IF NOT EXISTS lead_time                text,
  ADD COLUMN IF NOT EXISTS terms_conditions         text,
  ADD COLUMN IF NOT EXISTS subtotal_gbp             numeric(14,2),
  ADD COLUMN IF NOT EXISTS vat_total_gbp            numeric(14,2),
  ADD COLUMN IF NOT EXISTS total_gbp                numeric(14,2);
-- validity_date already exists — used as expiry date
-- status free text: existing values draft/sent/accepted/rejected/expired, add 'issued'

-- Backfill magic_link_token for any existing rows that have it null
UPDATE customer_quotes SET magic_link_token = gen_random_uuid() WHERE magic_link_token IS NULL;

-- 3. New table: customer_quote_lines (multi-line quote support)
CREATE TABLE IF NOT EXISTS customer_quote_lines (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_quote_id   uuid        NOT NULL REFERENCES customer_quotes(id) ON DELETE CASCADE,
  line_number         integer     NOT NULL DEFAULT 1,
  item_code           text,
  description         text        NOT NULL,
  grade_specification text,
  quantity            numeric(12,4),
  unit                text        DEFAULT 'MT',
  unit_price_gbp      numeric(14,2),
  amount_gbp          numeric(14,2),
  vat_rate            numeric     DEFAULT 20,
  vat_amount_gbp      numeric(14,2),
  is_alternative      boolean     DEFAULT false,
  supplier_quote_id   uuid        REFERENCES supplier_quotes(id),
  product_line_id     uuid        REFERENCES product_lines(id),
  notes               text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE customer_quote_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth full access on customer_quote_lines"
  ON customer_quote_lines FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon can read lines for published quotes (filtered by customer_quote_id in client)
CREATE POLICY "Anon read customer_quote_lines"
  ON customer_quote_lines FOR SELECT
  TO anon
  USING (true);

-- 4. New table: rfq_overhead_costs (flat-fee additional costs per RFQ)
CREATE TABLE IF NOT EXISTS rfq_overhead_costs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id              uuid        NOT NULL REFERENCES rfq_submissions(id) ON DELETE CASCADE,
  customer_quote_id   uuid        REFERENCES customer_quotes(id),
  description         text        NOT NULL,
  amount_gbp          numeric(14,2) NOT NULL,
  notes               text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE rfq_overhead_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth full access on rfq_overhead_costs"
  ON rfq_overhead_costs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Extend logistics_quotes with flat-fee pricing option + rfq link + doc upload
ALTER TABLE logistics_quotes
  ADD COLUMN IF NOT EXISTS pricing_type   text    DEFAULT 'per_mt',
  ADD COLUMN IF NOT EXISTS price_flat_gbp numeric(14,2),
  ADD COLUMN IF NOT EXISTS rfq_id         uuid    REFERENCES rfq_submissions(id),
  ADD COLUMN IF NOT EXISTS document_path  text;

-- 6. Extend supplier_quotes with rfq link + doc upload
ALTER TABLE supplier_quotes
  ADD COLUMN IF NOT EXISTS rfq_id        uuid REFERENCES rfq_submissions(id),
  ADD COLUMN IF NOT EXISTS document_path text;

-- 7. RLS: allow anon to read published customer_quotes (for magic link page)
-- The magic_link_token UUID (128-bit) is unguessable; anon reads only issued/accepted quotes
CREATE POLICY "Anon read published customer_quotes"
  ON customer_quotes FOR SELECT
  TO anon
  USING (status IN ('issued', 'accepted', 'rejected', 'expired'));
