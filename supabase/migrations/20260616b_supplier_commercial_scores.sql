-- ============================================================
-- Supplier Onboarding Redesign: Commercial Suitability Scores
-- Vertex Metals Ltd — Migration 20260616b
-- ============================================================
-- Second scoring axis alongside compliance risk. Answers "how
-- valuable is this supplier to Vertex?" across six factor groups
-- (product fit, buyer demand, volume, export capability, quality,
-- responsiveness). One row per scoring event (gate 1 or gate 2).
--
-- rating_band: 'Poor Fit' | 'Moderate Fit' | 'Strong Fit' |
--              'Strategic Supplier'
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_commercial_scores (
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
