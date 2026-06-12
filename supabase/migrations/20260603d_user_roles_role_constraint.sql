-- ============================================================
-- Fix: user_roles.role check constraint
-- Vertex Metals Ltd — Migration 20260603d
-- ============================================================
-- The original constraint only allowed the pre-onboarding role
-- values. The new supplier onboarding workflow adds:
--   director_commercial  — Jackson's onboarding role
--   director_compliance  — Martyn's onboarding role
-- ============================================================

DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname INTO v_constraint
  FROM   pg_constraint
  WHERE  conrelid = 'public.user_roles'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%role%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE user_roles DROP CONSTRAINT %I', v_constraint);
    RAISE NOTICE 'Dropped constraint: %', v_constraint;
  ELSE
    RAISE NOTICE 'No role check constraint found — nothing to drop.';
  END IF;
END $$;

ALTER TABLE user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN (
    'director',
    'director_commercial',
    'director_compliance',
    'approver',
    'verifier',
    'sales',
    'procurement',
    'quality',
    'finance',
    'finance_reviewer',
    'logistics',
    'mlro'
  ));
