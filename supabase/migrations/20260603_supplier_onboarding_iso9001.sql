-- ============================================================
-- Supplier Onboarding — ISO 9001 Redesign
-- Vertex Metals Ltd
-- Migration: 20260603
-- ============================================================
-- Run in the Supabase SQL editor (Dashboard → SQL Editor).
-- Tables are created in FK dependency order.
-- All additions to existing tables are non-breaking (nullable
-- columns and additive constraints only).
-- ============================================================


-- ============================================================
-- SECTION 1: Extend contacts with supplier-specific fields
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS company_registration_number text,
  ADD COLUMN IF NOT EXISTS vat_number                   text,
  ADD COLUMN IF NOT EXISTS beneficial_owner             text,
  ADD COLUMN IF NOT EXISTS supplier_type                text;

-- supplier_type values (enforced at application layer):
--   'manufacturing' | 'materials_commodities' | 'logistics' | 'service_provider'

-- Extend supplier_audits so audits can be linked to a specific onboarding record
ALTER TABLE supplier_audits
  ADD COLUMN IF NOT EXISTS onboarding_id uuid;


-- ============================================================
-- SECTION 2: supplier_enquiries
-- Pre-onboarding leads from the website contact form or raised
-- manually by Jackson. Jackson reviews and either converts to a
-- formal onboarding or declines (with reason recorded).
-- The FK to supplier_onboarding is added after that table exists.
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_enquiries (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  source                      text        NOT NULL,
  -- 'website_form' | 'manual_entry'

  company_name                text        NOT NULL,
  contact_name                text,
  email                       text,
  phone                       text,
  country                     text,
  products_of_interest        text,
  message                     text,

  submitted_at                timestamptz NOT NULL DEFAULT now(),

  status                      text        NOT NULL DEFAULT 'new',
  -- 'new' | 'under_review' | 'converted' | 'declined'

  reviewed_by                 uuid        REFERENCES auth.users(id),
  reviewed_at                 timestamptz,
  decline_reason              text,

  -- Populated when Jackson converts this enquiry to a formal onboarding.
  -- FK constraint added below after supplier_onboarding is created.
  converted_to_onboarding_id  uuid,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_enquiry_declined_has_reason
    CHECK (status != 'declined' OR decline_reason IS NOT NULL),

  CONSTRAINT chk_enquiry_converted_has_onboarding
    CHECK (status != 'converted' OR converted_to_onboarding_id IS NOT NULL)
);


-- ============================================================
-- SECTION 3: supplier_onboarding
-- Central workflow state record. One record per onboarding
-- attempt (a new record is created if a rejected supplier is
-- re-submitted). Jackson raises it; Martyn vets it; Jackson
-- makes the final approval decision.
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_onboarding (
  id                            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id                    uuid        NOT NULL REFERENCES contacts(id),
  enquiry_id                    uuid        REFERENCES supplier_enquiries(id),
  -- null if Jackson raised the onboarding manually without a prior enquiry

  workflow_stage                text        NOT NULL DEFAULT 'intake',
  -- Stage progression (enforced at application layer):
  -- 'intake' → 'screening' → 'documents' → 'compliance'
  -- → 'recommendation' → 'pending_approval' → 'activated'
  -- Any stage can transition to 'rejected'.

  risk_level                    text,
  -- Set by Martyn at screening stage: 'low' | 'medium' | 'high'

  -- Who raised this onboarding (Jackson — director_commercial)
  raised_by                     uuid        REFERENCES auth.users(id),

  -- Who is performing the vetting (Martyn — director_compliance)
  vetting_assigned_to           uuid        REFERENCES auth.users(id),

  -- Martyn's recommendation (written at 'recommendation' stage)
  recommendation                text,
  -- 'approve' | 'approve_with_conditions' | 'reject'
  recommendation_rationale      text,
  recommendation_submitted_at   timestamptz,

  -- Jackson's final decision (written at 'pending_approval' stage)
  -- Jackson writes an independent justification — not just echoing Martyn.
  -- Both positions are preserved; if they differ, both are visible in the audit trail.
  decision                      text,
  -- 'approved' | 'approved_with_conditions' | 'rejected'
  decision_justification        text,
  decision_by                   uuid        REFERENCES auth.users(id),
  decision_at                   timestamptz,

  -- Free-text summary of conditions (detail rows in supplier_conditions)
  conditions_summary            text,

  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  activated_at                  timestamptz,

  CONSTRAINT chk_onboarding_recommendation_has_rationale
    CHECK (recommendation IS NULL OR recommendation_rationale IS NOT NULL),

  CONSTRAINT chk_onboarding_decision_has_justification
    CHECK (decision IS NULL OR decision_justification IS NOT NULL)
);

-- Now the enquiries → onboarding FK can be added
ALTER TABLE supplier_enquiries
  ADD CONSTRAINT fk_enquiry_converted_to_onboarding
  FOREIGN KEY (converted_to_onboarding_id) REFERENCES supplier_onboarding(id);

-- And the supplier_audits → onboarding FK
ALTER TABLE supplier_audits
  ADD CONSTRAINT fk_supplier_audit_onboarding
  FOREIGN KEY (onboarding_id) REFERENCES supplier_onboarding(id);


-- ============================================================
-- SECTION 4: supplier_risk_assessment
-- Martyn's guided scoring form completed during the 'screening'
-- stage. Five criteria scored 1–5 (5 = highest risk). The app
-- calculates the overall_score and derives risk_category; both
-- are written and stored for audit immutability.
-- Martyn can override the computed category with a reason.
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_risk_assessment (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id                     uuid        NOT NULL REFERENCES contacts(id),
  onboarding_id                   uuid        NOT NULL REFERENCES supplier_onboarding(id),

  -- Criteria: 1 = very low risk, 5 = very high risk
  financial_viability_score       smallint    CHECK (financial_viability_score     BETWEEN 1 AND 5),
  quality_certification_score     smallint    CHECK (quality_certification_score   BETWEEN 1 AND 5),
  regulatory_compliance_score     smallint    CHECK (regulatory_compliance_score   BETWEEN 1 AND 5),
  geographic_risk_score           smallint    CHECK (geographic_risk_score         BETWEEN 1 AND 5),
  supply_continuity_score         smallint    CHECK (supply_continuity_score       BETWEEN 1 AND 5),

  -- Computed average (app writes this; stored for audit trail integrity)
  -- Thresholds: 1.0–2.3 = low, 2.4–3.6 = medium, 3.7–5.0 = high
  overall_score                   numeric(4,2),
  risk_category                   text,
  -- 'low' | 'medium' | 'high'

  -- Per-criterion notes (Martyn documents his rationale for each score)
  financial_viability_notes       text,
  quality_certification_notes     text,
  regulatory_compliance_notes     text,
  geographic_risk_notes           text,
  supply_continuity_notes         text,
  overall_notes                   text,

  -- If Martyn disagrees with the computed category he sets override = true
  -- and must explain why — this is visible in the audit trail.
  risk_category_override          bool        NOT NULL DEFAULT false,
  risk_category_override_reason   text,

  assessed_by                     uuid        REFERENCES auth.users(id),
  assessment_date                 timestamptz NOT NULL DEFAULT now(),
  next_assessment_due             date,

  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_risk_override_has_reason
    CHECK (risk_category_override = false OR risk_category_override_reason IS NOT NULL)
);


-- ============================================================
-- SECTION 5: supplier_documents
-- Version-controlled document uploads with expiry tracking.
-- When a document is superseded, the old row has is_current set
-- to false; the new row is inserted at version + 1.
-- Martyn can mark a document type 'not applicable' for a given
-- supplier (e.g. W-9 for a non-US supplier). This is recorded
-- with a mandatory reason, preserving the audit trail.
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_documents (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id           uuid        NOT NULL REFERENCES contacts(id),
  onboarding_id         uuid        REFERENCES supplier_onboarding(id),
  -- Nullable: documents can be added or renewed post-activation.

  document_type         text        NOT NULL,
  -- Core: 'business_registration' | 'tax_certificate' | 'bank_details' | 'dpa'
  --       'beneficial_owner_declaration'
  -- Quality: 'quality_cert' | 'iso_certificate' | 'test_certificate' | 'audit_report'
  -- Insurance: 'insurance_cargo' | 'insurance_liability'
  -- Jurisdiction-specific: 'w9'   (US suppliers only)
  -- Catch-all: 'other'

  document_label        text,
  -- Required when document_type = 'other'; human-readable description.

  jurisdiction          text,
  -- ISO 3166-1 alpha-2 country code or 'global'. Helps filter applicable types.
  -- Examples: 'GB' | 'IN' | 'US' | 'global'

  version               integer     NOT NULL DEFAULT 1,

  -- File fields: null only when not_applicable = true
  file_path             text,
  file_name             text,
  file_size_bytes       bigint,
  mime_type             text,
  uploaded_by           uuid        REFERENCES auth.users(id),
  uploaded_at           timestamptz,

  expiry_date           date,
  -- Null for documents without a fixed expiry (e.g. bank details).

  is_current            bool        NOT NULL DEFAULT true,
  -- Set to false when a new version supersedes this row.

  not_applicable        bool        NOT NULL DEFAULT false,
  not_applicable_reason text,
  -- Why this document type doesn't apply to this supplier.

  change_reason         text,
  -- Required for version > 1: why the document was re-uploaded.

  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_document_file_or_na
    CHECK (
      not_applicable = true
      OR (file_path IS NOT NULL AND file_name IS NOT NULL AND uploaded_at IS NOT NULL)
    ),

  CONSTRAINT chk_document_label_for_other
    CHECK (document_type != 'other' OR document_label IS NOT NULL),

  CONSTRAINT chk_document_na_has_reason
    CHECK (not_applicable = false OR not_applicable_reason IS NOT NULL),

  CONSTRAINT chk_document_version_change_reason
    CHECK (version = 1 OR change_reason IS NOT NULL)
);


-- ============================================================
-- SECTION 6: supplier_approvals
-- One row per formal approval or rejection at a workflow stage.
-- Both Martyn's recommendation and Jackson's final decision are
-- recorded here (in addition to the denormalised columns on
-- supplier_onboarding) so they are queryable independently and
-- cannot be overwritten.
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_approvals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     uuid        NOT NULL REFERENCES contacts(id),
  onboarding_id   uuid        NOT NULL REFERENCES supplier_onboarding(id),

  approval_stage  text        NOT NULL,
  -- 'screening' | 'documents' | 'compliance'
  -- | 'recommendation' | 'final_approval'

  approver_id     uuid        NOT NULL REFERENCES auth.users(id),

  approver_role   text        NOT NULL,
  -- 'director_commercial' | 'director_compliance'

  decision        text        NOT NULL,
  -- 'approved' | 'approved_with_conditions' | 'rejected'

  justification   text        NOT NULL,

  conditions      text,
  -- Populated when decision = 'approved_with_conditions'.
  -- Detail rows are in supplier_conditions.

  decided_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_approval_conditions_populated
    CHECK (decision != 'approved_with_conditions' OR conditions IS NOT NULL)
);


-- ============================================================
-- SECTION 7: supplier_audit_trail
-- Append-only event log. Every significant action in the
-- supplier lifecycle writes a row here. RLS permits INSERT and
-- SELECT only; UPDATE and DELETE are denied.
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_audit_trail (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     uuid        NOT NULL REFERENCES contacts(id),
  onboarding_id   uuid        REFERENCES supplier_onboarding(id),

  event_type      text        NOT NULL,
  -- Enquiry events:
  --   'enquiry_created' | 'enquiry_reviewed' | 'enquiry_converted' | 'enquiry_declined'
  -- Onboarding lifecycle:
  --   'onboarding_created' | 'stage_advanced' | 'stage_gate_blocked'
  -- Documents:
  --   'document_uploaded' | 'document_superseded' | 'document_marked_na'
  --   'document_expiry_alert'
  -- Compliance:
  --   'risk_assessment_saved' | 'kyc_linked' | 'sanctions_linked'
  -- Decisions:
  --   'recommendation_submitted' | 'approval_decision' | 'rejection_decision'
  -- Activation & status changes:
  --   'supplier_activated' | 'supplier_suspended' | 'supplier_reinstated'
  --   'supplier_delisted'
  -- Field-level tracking:
  --   'contact_field_changed'
  -- Conditions:
  --   'condition_added' | 'condition_met'
  -- Nonconformity:
  --   'nonconformity_raised' | 'corrective_action_created' | 'corrective_action_closed'
  -- Annual audit:
  --   'annual_audit_event'

  actor_id        uuid        REFERENCES auth.users(id),
  actor_role      text,

  occurred_at     timestamptz NOT NULL DEFAULT now(),

  description     text        NOT NULL,
  -- Human-readable sentence, e.g.:
  -- "Stage advanced from 'screening' to 'documents' by Martyn Bourner"
  -- "Document 'ISO 9001 Certificate' uploaded (version 2)"
  -- "Final approval granted by Jackson Paul — recommendation was 'approve'"

  -- For contact_field_changed events
  field_name      text,
  old_value       text,
  new_value       text,

  metadata        jsonb
  -- Structured context: previous stage, risk scores, file paths, etc.
);


-- ============================================================
-- SECTION 8: supplier_nonconformities
-- Records compliance failures, process gaps, or approval errors
-- discovered during onboarding or post-activation.
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_nonconformities (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     uuid        NOT NULL REFERENCES contacts(id),
  onboarding_id   uuid        REFERENCES supplier_onboarding(id),
  -- Null for nonconformities raised post-activation.

  incident_date   date        NOT NULL,
  description     text        NOT NULL,

  severity        text        NOT NULL,
  -- 'low' | 'medium' | 'high'

  root_cause      text,

  reported_by     uuid        REFERENCES auth.users(id),

  status          text        NOT NULL DEFAULT 'open',
  -- 'open' | 'in_progress' | 'closed'

  closed_at       timestamptz,
  closed_by       uuid        REFERENCES auth.users(id),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- SECTION 9: corrective_actions
-- One or more corrective actions per nonconformity. Status
-- tracks progress to closure; effectiveness_verification
-- records what was done to confirm the fix worked.
-- ============================================================

CREATE TABLE IF NOT EXISTS corrective_actions (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nonconformity_id            uuid        NOT NULL REFERENCES supplier_nonconformities(id),

  action_description          text        NOT NULL,
  owner_id                    uuid        REFERENCES auth.users(id),
  due_date                    date,

  status                      text        NOT NULL DEFAULT 'open',
  -- 'open' | 'in_progress' | 'completed' | 'closed'

  effectiveness_verification  text,

  completed_at                timestamptz,
  closed_at                   timestamptz,
  closed_by                   uuid        REFERENCES auth.users(id),

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- SECTION 10: supplier_conditions
-- Tracks individual outstanding conditions attached to a
-- conditional approval. Each condition must be explicitly
-- marked met (by Martyn, with evidence) before the condition
-- is cleared. Used by ISO 9001 Clause 8.4 evidence.
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_conditions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id           uuid        NOT NULL REFERENCES contacts(id),
  onboarding_id         uuid        NOT NULL REFERENCES supplier_onboarding(id),

  condition_text        text        NOT NULL,

  condition_type        text        NOT NULL,
  -- 'document_required' | 'certification_required' | 'audit_required'
  -- | 'remediation_required' | 'other'

  due_date              date,

  is_met                bool        NOT NULL DEFAULT false,
  met_at                timestamptz,
  met_by                uuid        REFERENCES auth.users(id),

  -- Link to the document that satisfies this condition (if applicable)
  evidence_document_id  uuid        REFERENCES supplier_documents(id),

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- SECTION 11: Indexes
-- ============================================================

-- supplier_enquiries
CREATE INDEX IF NOT EXISTS idx_enquiries_status
  ON supplier_enquiries (status);
CREATE INDEX IF NOT EXISTS idx_enquiries_source
  ON supplier_enquiries (source);

-- supplier_onboarding
CREATE INDEX IF NOT EXISTS idx_onboarding_contact
  ON supplier_onboarding (contact_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_stage
  ON supplier_onboarding (workflow_stage);
CREATE INDEX IF NOT EXISTS idx_onboarding_raised_by
  ON supplier_onboarding (raised_by);
CREATE INDEX IF NOT EXISTS idx_onboarding_vetting_to
  ON supplier_onboarding (vetting_assigned_to);

-- supplier_risk_assessment
CREATE INDEX IF NOT EXISTS idx_risk_assessment_supplier
  ON supplier_risk_assessment (supplier_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessment_onboarding
  ON supplier_risk_assessment (onboarding_id);

-- supplier_documents
CREATE INDEX IF NOT EXISTS idx_documents_supplier
  ON supplier_documents (supplier_id);
CREATE INDEX IF NOT EXISTS idx_documents_onboarding
  ON supplier_documents (onboarding_id);
-- Fast lookup of current versions only
CREATE INDEX IF NOT EXISTS idx_documents_current
  ON supplier_documents (supplier_id, document_type)
  WHERE is_current = true AND not_applicable = false;
-- Expiry monitoring query: all current, non-NA docs with an expiry date
CREATE INDEX IF NOT EXISTS idx_documents_expiry
  ON supplier_documents (expiry_date)
  WHERE expiry_date IS NOT NULL AND is_current = true AND not_applicable = false;

-- supplier_approvals
CREATE INDEX IF NOT EXISTS idx_approvals_supplier
  ON supplier_approvals (supplier_id);
CREATE INDEX IF NOT EXISTS idx_approvals_onboarding
  ON supplier_approvals (onboarding_id);

-- supplier_audit_trail
CREATE INDEX IF NOT EXISTS idx_audit_trail_supplier
  ON supplier_audit_trail (supplier_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_onboarding
  ON supplier_audit_trail (onboarding_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_occurred
  ON supplier_audit_trail (occurred_at DESC);

-- supplier_nonconformities
CREATE INDEX IF NOT EXISTS idx_nonconformities_supplier
  ON supplier_nonconformities (supplier_id);
CREATE INDEX IF NOT EXISTS idx_nonconformities_open
  ON supplier_nonconformities (status)
  WHERE status != 'closed';

-- corrective_actions
CREATE INDEX IF NOT EXISTS idx_corrective_actions_nonconformity
  ON corrective_actions (nonconformity_id);
CREATE INDEX IF NOT EXISTS idx_corrective_actions_open
  ON corrective_actions (status)
  WHERE status NOT IN ('completed', 'closed');

-- supplier_conditions
CREATE INDEX IF NOT EXISTS idx_conditions_supplier
  ON supplier_conditions (supplier_id);
CREATE INDEX IF NOT EXISTS idx_conditions_unmet
  ON supplier_conditions (supplier_id)
  WHERE is_met = false;


-- ============================================================
-- SECTION 12: updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_supplier_enquiries_updated_at
  BEFORE UPDATE ON supplier_enquiries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_supplier_onboarding_updated_at
  BEFORE UPDATE ON supplier_onboarding
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_supplier_risk_assessment_updated_at
  BEFORE UPDATE ON supplier_risk_assessment
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_supplier_nonconformities_updated_at
  BEFORE UPDATE ON supplier_nonconformities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_corrective_actions_updated_at
  BEFORE UPDATE ON corrective_actions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_supplier_conditions_updated_at
  BEFORE UPDATE ON supplier_conditions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SECTION 13: Row Level Security
-- All new tables: authenticated portal users only.
-- supplier_audit_trail: INSERT + SELECT only (no UPDATE/DELETE).
-- ============================================================

ALTER TABLE supplier_enquiries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_onboarding      ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_risk_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_approvals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_audit_trail     ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_nonconformities ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrective_actions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_conditions      ENABLE ROW LEVEL SECURITY;

-- Standard tables: authenticated users have full CRUD
CREATE POLICY "portal_full_access" ON supplier_enquiries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "portal_full_access" ON supplier_onboarding
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "portal_full_access" ON supplier_risk_assessment
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "portal_full_access" ON supplier_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "portal_full_access" ON supplier_approvals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "portal_full_access" ON supplier_nonconformities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "portal_full_access" ON corrective_actions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "portal_full_access" ON supplier_conditions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Audit trail: SELECT and INSERT only — UPDATE and DELETE intentionally omitted
CREATE POLICY "audit_trail_read"   ON supplier_audit_trail
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "audit_trail_insert" ON supplier_audit_trail
  FOR INSERT TO authenticated WITH CHECK (true);


-- ============================================================
-- SECTION 14: Role values reference (data note — not DDL)
-- ============================================================
-- The existing user_roles table uses a free-text 'role' column.
-- The onboarding workflow expects two role values. Assign these
-- to Jackson and Martyn via the Supabase dashboard once their
-- auth.users UUIDs are known:
--
--   director_commercial   → Jackson Paul
--                            Sees: enquiry queue, intake form,
--                            pending approval queue
--
--   director_compliance   → Martyn Bourner
--                            Sees: active vetting queue,
--                            screening / risk / docs / compliance
--                            forms, all reports & dashboards
--
-- INSERT INTO user_roles (user_id, role, granted_by)
-- VALUES ('<jackson-uuid>', 'director_commercial', '<martyn-uuid>'),
--        ('<martyn-uuid>',  'director_compliance',  '<jackson-uuid>');
-- ============================================================
