-- =============================================================================
-- Vertex Metals — Migration: Product Families
-- Run in Supabase SQL Editor in one pass.
-- All statements are idempotent (IF NOT EXISTS / ALTER ... IF NOT EXISTS).
-- =============================================================================

CREATE TABLE IF NOT EXISTS product_families (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  description   TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE product_families ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='product_families' AND policyname='pf_auth') THEN
    CREATE POLICY "pf_auth" ON product_families FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
