-- ============================================================
-- supplier_onboarding — TOB tracking + workflow_stage remap
-- Vertex Metals Ltd
-- Migration: 20260612d
-- ============================================================
-- Adds Terms of Business (TOB) tracking columns and remaps the
-- existing 8-value workflow_stage data to the new 7-value,
-- 3-phase model (draft / stage1_complete / pending_stage2 /
-- awaiting_supplier_info / stage2_complete / trade_ready / rejected).
-- workflow_stage is app-enforced (no DB CHECK constraint).
-- ============================================================

-- TOB tracking
ALTER TABLE supplier_onboarding
  ADD COLUMN IF NOT EXISTS tob_status       text NOT NULL DEFAULT 'not_generated',
  ADD COLUMN IF NOT EXISTS tob_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS tob_sent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS tob_confirmed_at timestamptz;

ALTER TABLE supplier_onboarding DROP CONSTRAINT IF EXISTS chk_tob_status;
ALTER TABLE supplier_onboarding
  ADD CONSTRAINT chk_tob_status
  CHECK (tob_status IN ('not_generated','generated','sent','confirmed'));

-- workflow_stage remap: old 8-stage values -> new 7-value model
UPDATE supplier_onboarding SET workflow_stage = 'draft'       WHERE workflow_stage = 'intake';
UPDATE supplier_onboarding SET workflow_stage = 'trade_ready' WHERE workflow_stage = 'activated';

UPDATE supplier_onboarding SET workflow_stage = 'pending_stage2'
  WHERE workflow_stage IN ('screening','documents','compliance');

UPDATE supplier_onboarding SET workflow_stage = 'pending_stage2'
  WHERE workflow_stage IN ('recommendation','pending_approval') AND decision IS NULL;

UPDATE supplier_onboarding SET workflow_stage = 'stage2_complete'
  WHERE workflow_stage IN ('recommendation','pending_approval')
    AND decision IN ('approved','approved_with_conditions');

UPDATE supplier_onboarding SET workflow_stage = 'rejected'
  WHERE workflow_stage IN ('recommendation','pending_approval') AND decision = 'rejected';
-- rows already 'rejected' are unaffected (no matching WHERE clause above)
