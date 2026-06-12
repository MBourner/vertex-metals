-- ============================================================
-- Fix: contacts.approval_status check constraint
-- Vertex Metals Ltd — Migration 20260603c
-- ============================================================
-- The original constraint only allowed the pre-onboarding
-- status values. The new supplier onboarding workflow adds:
--   under_review         — supplier is being vetted
--   pending_approval     — Martyn submitted recommendation,
--                          awaiting Jackson's final decision
--   conditionally_approved — approved with outstanding conditions
--   rejected             — formally rejected at any stage
--
-- This migration drops the old constraint and replaces it
-- with one that covers all required values.
-- ============================================================

-- Step 1: drop the existing constraint (name discovered at runtime)
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname INTO v_constraint
  FROM   pg_constraint
  WHERE  conrelid = 'public.contacts'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%approval_status%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE contacts DROP CONSTRAINT %I', v_constraint);
    RAISE NOTICE 'Dropped constraint: %', v_constraint;
  ELSE
    RAISE NOTICE 'No approval_status check constraint found — nothing to drop.';
  END IF;
END $$;

-- Step 2: add the updated constraint with all required values
ALTER TABLE contacts
  ADD CONSTRAINT contacts_approval_status_check
  CHECK (approval_status IN (
    'prospect',
    'under_review',
    'pending_approval',
    'approved',
    'conditionally_approved',
    'under_audit',
    'rejected',
    'suspended',
    'delisted'
  ));
