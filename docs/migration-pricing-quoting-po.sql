-- =============================================================================
-- Vertex Metals — Migration: Pricing, Quoting & PO Chain
-- Run in Supabase SQL Editor in one pass.
-- All statements are idempotent (IF NOT EXISTS / ALTER ... IF NOT EXISTS).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. contacts — add logistics type
-- -----------------------------------------------------------------------------
-- Drop the existing CHECK constraint and replace it to include 'logistics'.
-- Supabase generates constraint names — find and replace yours:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'contacts'::regclass;
-- Then replace 'contacts_type_check' below with your actual constraint name.

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_type_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_type_check
  CHECK (type IN ('buyer', 'supplier', 'logistics', 'other'));


-- -----------------------------------------------------------------------------
-- 2. product_lines — hierarchy, pricing reference, logistics defaults
-- -----------------------------------------------------------------------------

ALTER TABLE product_lines
  ADD COLUMN IF NOT EXISTS metal_family                TEXT,
  ADD COLUMN IF NOT EXISTS sub_type                    TEXT,
  ADD COLUMN IF NOT EXISTS standard_sell_price_gbp     NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS pricing_last_reviewed       DATE,
  ADD COLUMN IF NOT EXISTS market_reference_price_gbp  NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS market_price_updated_date   DATE,
  ADD COLUMN IF NOT EXISTS default_origin_country      TEXT,
  ADD COLUMN IF NOT EXISTS default_destination         TEXT;


-- -----------------------------------------------------------------------------
-- 3. logistics_quotes — new table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS logistics_quotes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  origin_country       TEXT NOT NULL,
  destination_country  TEXT NOT NULL,
  origin_port          TEXT,
  destination_port     TEXT,
  mode                 TEXT NOT NULL DEFAULT 'sea'
                         CHECK (mode IN ('sea','air','road','rail')),
  container_type       TEXT,
  price_per_mt_usd     NUMERIC(12,2),
  min_qty_mt           NUMERIC(12,3),
  validity_date        DATE,
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','expired','used')),
  rfq_id               UUID REFERENCES rfq_submissions(id) ON DELETE SET NULL,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS logistics_quotes_updated_at ON logistics_quotes;
CREATE TRIGGER logistics_quotes_updated_at
  BEFORE UPDATE ON logistics_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE logistics_quotes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='logistics_quotes' AND policyname='lq_auth') THEN
    CREATE POLICY "lq_auth" ON logistics_quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 4. supplier_quotes — link to RFQ and product line
-- -----------------------------------------------------------------------------

ALTER TABLE supplier_quotes
  ADD COLUMN IF NOT EXISTS rfq_id          UUID REFERENCES rfq_submissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_line_id UUID REFERENCES product_lines(id)   ON DELETE SET NULL;


-- -----------------------------------------------------------------------------
-- 5. customer_quotes — new table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customer_quotes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id                UUID REFERENCES rfq_submissions(id)  ON DELETE SET NULL,
  product_line_id       UUID REFERENCES product_lines(id)    ON DELETE SET NULL,
  supplier_quote_id     UUID REFERENCES supplier_quotes(id)  ON DELETE SET NULL,
  logistics_quote_id    UUID REFERENCES logistics_quotes(id) ON DELETE SET NULL,
  sell_price_per_mt_gbp NUMERIC(14,2) NOT NULL,
  quantity_mt           NUMERIC(12,3),
  total_value_gbp       NUMERIC(14,2),
  validity_date         DATE,
  pricing_model         TEXT CHECK (pricing_model IN ('standard','best','market')),
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  sent_date             DATE,
  response_date         DATE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS customer_quotes_updated_at ON customer_quotes;
CREATE TRIGGER customer_quotes_updated_at
  BEFORE UPDATE ON customer_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE customer_quotes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_quotes' AND policyname='cq_auth') THEN
    CREATE POLICY "cq_auth" ON customer_quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 6. trades — link back to RFQ and customer quote
-- -----------------------------------------------------------------------------

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS rfq_id            UUID REFERENCES rfq_submissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_quote_id UUID REFERENCES customer_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS logistics_arrangement TEXT
                             CHECK (logistics_arrangement IN ('supplier','vertex')),
  ADD COLUMN IF NOT EXISTS logistics_quote_id UUID REFERENCES logistics_quotes(id) ON DELETE SET NULL;


-- -----------------------------------------------------------------------------
-- 7. supplier_pos — new table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS supplier_pos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id         UUID REFERENCES trades(id)        ON DELETE SET NULL,
  po_reference     TEXT UNIQUE NOT NULL,
  supplier_id      UUID REFERENCES contacts(id)       ON DELETE SET NULL,
  product_line_id  UUID REFERENCES product_lines(id)  ON DELETE SET NULL,
  product_spec     TEXT,
  quantity_mt      NUMERIC(12,3),
  unit_price_usd   NUMERIC(14,4),
  total_value_usd  NUMERIC(14,2),
  incoterm         TEXT,
  delivery_port    TEXT,
  shipment_date    DATE,
  payment_terms    TEXT,
  conditions       TEXT,
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','sent','acknowledged','in_production','shipped','cancelled')),
  pdf_url          TEXT,
  sent_date        DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS supplier_pos_updated_at ON supplier_pos;
CREATE TRIGGER supplier_pos_updated_at
  BEFORE UPDATE ON supplier_pos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE supplier_pos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='supplier_pos' AND policyname='spo_auth') THEN
    CREATE POLICY "spo_auth" ON supplier_pos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 8. rfq_submissions — add 'quoted' status
-- -----------------------------------------------------------------------------

ALTER TABLE rfq_submissions DROP CONSTRAINT IF EXISTS rfq_submissions_status_check;
ALTER TABLE rfq_submissions ADD CONSTRAINT rfq_submissions_status_check
  CHECK (status IN ('new','reviewing','quoted','responded','closed'));


-- =============================================================================
-- Done. Verify with:
--   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- =============================================================================
