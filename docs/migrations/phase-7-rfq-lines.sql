-- ============================================================
-- Phase 7: RFQ Line Items Architecture
-- Apply in Supabase SQL Editor
-- ============================================================

-- 1. New table: rfq_lines (backbone of the quoting workflow)
CREATE TABLE IF NOT EXISTS rfq_lines (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id              uuid        NOT NULL REFERENCES rfq_submissions(id) ON DELETE CASCADE,
  line_number         integer     NOT NULL DEFAULT 1,
  product_line_id     uuid        REFERENCES product_lines(id),
  description         text        NOT NULL,
  grade_specification text,
  quantity            numeric(12,4),
  quantity_unit       text        DEFAULT 'MT',  -- MT | kg | pieces | m | m²
  is_alternative      boolean     DEFAULT false,
  alt_reason          text,
  source              text        DEFAULT 'manual',  -- initial_enquiry | manual | supplier_suggested
  notes               text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE rfq_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth full access on rfq_lines"
  ON rfq_lines FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Extend supplier_quotes — link to rfq_line + per-piece pricing
ALTER TABLE supplier_quotes
  ADD COLUMN IF NOT EXISTS rfq_line_id     uuid        REFERENCES rfq_lines(id),
  ADD COLUMN IF NOT EXISTS pricing_basis   text        DEFAULT 'per_mt',
  ADD COLUMN IF NOT EXISTS price_per_piece numeric(14,4),
  ADD COLUMN IF NOT EXISTS quantity_pieces integer;

-- 3. Extend rfq_submissions — store quantity unit from enquiry form
ALTER TABLE rfq_submissions
  ADD COLUMN IF NOT EXISTS quantity_unit text DEFAULT 'MT';

-- 4. Extend customer_quote_lines — link back to source rfq_line
ALTER TABLE customer_quote_lines
  ADD COLUMN IF NOT EXISTS rfq_line_id uuid REFERENCES rfq_lines(id);
