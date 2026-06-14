-- ============================================================
-- contacts — Onboarding v2 fields (3-stage redesign)
-- Vertex Metals Ltd
-- Migration: 20260612c
-- ============================================================
-- Adds the fields required by the UAT-driven 3-stage onboarding
-- redesign: Stage 1 identity/licensing/QMS, Stage 2 ESG and bank
-- details, Stage 3 commercial terms.
-- ============================================================

-- Stage 1 — identity / reference / licensing
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS company_phone         text,
  ADD COLUMN IF NOT EXISTS supplier_reference    text,
  ADD COLUMN IF NOT EXISTS export_licence_number text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_supplier_reference_unique
  ON contacts (supplier_reference)
  WHERE supplier_reference IS NOT NULL;

-- Stage 1 — QMS / quality certification
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS qms_certification   text,
  -- 'none' | 'iso_9001' | 'iatf_16949' | 'other'
  ADD COLUMN IF NOT EXISTS qms_certificate_ref text,
  ADD COLUMN IF NOT EXISTS qms_expiry          date;

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS chk_qms_certification;
ALTER TABLE contacts
  ADD CONSTRAINT chk_qms_certification
  CHECK (qms_certification IS NULL OR qms_certification IN ('none','iso_9001','iatf_16949','other'));

-- Stage 2 — ESG / environmental (lightweight)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS esg_policy_in_place         bool,
  ADD COLUMN IF NOT EXISTS carbon_reporting_available  bool,
  ADD COLUMN IF NOT EXISTS esg_notes                   text,
  ADD COLUMN IF NOT EXISTS environmental_permit_ref    text,
  ADD COLUMN IF NOT EXISTS environmental_permit_expiry date;

-- Stage 2 — Bank details (structured, masked client-side)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS bank_account_name             text,
  ADD COLUMN IF NOT EXISTS bank_account_number           text,
  ADD COLUMN IF NOT EXISTS bank_sort_code                text,
  ADD COLUMN IF NOT EXISTS bank_iban                     text,
  ADD COLUMN IF NOT EXISTS bank_swift_bic                text,
  ADD COLUMN IF NOT EXISTS bank_name                     text,
  ADD COLUMN IF NOT EXISTS bank_account_verified_in_name bool NOT NULL DEFAULT false;

-- Stage 3 — Commercial terms
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS accepted_currencies      text[],
  ADD COLUMN IF NOT EXISTS default_currency         text,
  ADD COLUMN IF NOT EXISTS payment_terms_initial    text,
  ADD COLUMN IF NOT EXISTS payment_terms_subsequent text,
  ADD COLUMN IF NOT EXISTS standard_incoterm        text;
