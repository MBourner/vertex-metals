-- ============================================================
-- Vertex Metals Portal — Phase 5 Logistics Migration
-- Adds shipments and shipment_legs tables.
-- Run in Supabase SQL Editor before using the logistics features.
-- ============================================================

CREATE TABLE IF NOT EXISTS shipments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  trade_id              uuid NOT NULL REFERENCES trades(id) ON DELETE RESTRICT,
  -- onward_only: supplier delivers to UK port, VM arranges last-mile to buyer
  -- full_freight: supplier delivers to export port, VM arranges full sea + road
  logistics_model       text NOT NULL CHECK (logistics_model IN ('onward_only','full_freight')),
  freight_forwarder     text,
  booking_reference     text,
  eta_uk_port           date,
  eta_delivery          date,
  total_freight_cost_gbp numeric(14,2),
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','booked','in_transit','arrived_uk','delivered')),
  notes                 text
);

CREATE TABLE IF NOT EXISTS shipment_legs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  shipment_id      uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  -- sea_freight: export port -> UK port
  -- onward_road:  UK port -> buyer delivery address
  leg_type         text NOT NULL CHECK (leg_type IN ('sea_freight','onward_road')),
  origin           text,
  destination      text,
  carrier          text,
  booking_reference text,
  departure_date   date,
  arrival_date     date,
  cost_gbp         numeric(14,2),
  notes            text
);

-- RLS
ALTER TABLE shipments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_legs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipments_auth"     ON shipments     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shipment_legs_auth" ON shipment_legs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipments_trade_id      ON shipments (trade_id);
CREATE INDEX IF NOT EXISTS idx_shipment_legs_shipment  ON shipment_legs (shipment_id);
