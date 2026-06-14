-- ============================================================
-- supplier_risk_assessment — Stage 2 review columns
-- Vertex Metals Ltd
-- Migration: 20260612e
-- ============================================================
-- Supports the single-assessment model: the risk assessment row
-- is scored preliminarily during Stage 1 (reviewed_at IS NULL),
-- then reviewed/refined by the compliance director during Stage 2
-- for full-diligence suppliers (reviewed_at/reviewed_by set).
-- ============================================================

ALTER TABLE supplier_risk_assessment
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);
