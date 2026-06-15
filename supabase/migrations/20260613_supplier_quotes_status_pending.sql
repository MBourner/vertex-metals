-- ============================================================
-- Fix: supplier_quotes.status check constraint
-- Vertex Metals Ltd — Migration 20260613
-- ============================================================
-- The supplier detail page's new "Products" tab links a product
-- line to a supplier before any pricing has been agreed, using
-- status = 'pending' ("permitted to supply, no live quote yet").
-- The original constraint only allowed 'active' | 'expired' | 'used'.
--
-- This migration drops the old constraint and replaces it with
-- one that also permits 'pending'.
-- ============================================================

DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname INTO v_constraint
  FROM   pg_constraint
  WHERE  conrelid = 'public.supplier_quotes'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%status%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE supplier_quotes DROP CONSTRAINT %I', v_constraint);
    RAISE NOTICE 'Dropped constraint: %', v_constraint;
  ELSE
    RAISE NOTICE 'No status check constraint found on supplier_quotes — nothing to drop.';
  END IF;
END $$;

ALTER TABLE supplier_quotes
  ADD CONSTRAINT supplier_quotes_status_check
  CHECK (status IN ('pending', 'active', 'expired', 'used'));
