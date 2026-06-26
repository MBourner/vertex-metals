-- =============================================================================
-- Vertex Metals — Migration: Leads Hub
-- Run in Supabase SQL Editor in one pass.
-- =============================================================================

CREATE TABLE IF NOT EXISTS leads (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name         text        NOT NULL,
  contact_name         text,
  job_title            text,
  email                text,
  phone                text,
  website              text,
  country              text,
  region               text,
  stage                text        NOT NULL DEFAULT 'potential'
                                   CHECK (stage IN (
                                     'potential', 'contacted', 'interested',
                                     'not_interested', 'not_suitable', 'not_replied',
                                     'discussion', 'converted'
                                   )),
  product_interests    text[],
  source               text        CHECK (source IN (
                                     'research', 'referral', 'linkedin',
                                     'trade_show', 'conference', 'other'
                                   )),
  notes                text,
  next_action          text,
  assigned_to          text,
  last_contacted_at    date,
  converted_contact_id uuid        REFERENCES contacts(id),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'portal_full_access'
  ) THEN
    CREATE POLICY "portal_full_access" ON leads
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
