-- ============================================================
-- Supplier Onboarding Redesign: Compliance Risk Scores
-- Vertex Metals Ltd — Migration 20260616a
-- ============================================================
-- Replaces the 1–5 weighted supplier_risk_assessment model with
-- an additive factor-selection model. One row per scoring event
-- (gate 1 or gate 2), versioned — previous rows are retained for
-- audit. The old supplier_risk_assessment table stays readable
-- for any in-flight records during transition.
--
-- rating_band: 'Low Risk' | 'Medium Risk' | 'High Risk' |
--              'Very High Risk' | 'Prohibited'
-- components:  [{group, factor_key, label, score}] — full
--              factor breakdown so scores can be explained and
--              recomputed deterministically.
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_compliance_scores (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   uuid        REFERENCES contacts(id),
  onboarding_id uuid        REFERENCES supplier_onboarding(id),
  gate          smallint    NOT NULL,
  total_score   int         NOT NULL,
  rating_band   text        NOT NULL,
  components    jsonb       NOT NULL DEFAULT '[]',
  computed_at   timestamptz NOT NULL DEFAULT now(),
  computed_by   uuid        REFERENCES auth.users(id)
);
