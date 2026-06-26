-- =============================================================================
-- Vertex Metals — Migration: Lead Notes (activity log)
-- Run in Supabase SQL Editor in one pass.
-- =============================================================================

CREATE TABLE IF NOT EXISTS lead_notes (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id    uuid        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  note       text        NOT NULL,
  author     text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lead_notes' AND policyname = 'portal_full_access'
  ) THEN
    CREATE POLICY "portal_full_access" ON lead_notes
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
