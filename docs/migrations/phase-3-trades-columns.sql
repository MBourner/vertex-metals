-- ============================================================
-- Vertex Metals Portal — Phase 3 Supplementary Migration
-- Adds order-entry fields to the trades table needed by
-- portal/orders/new.html.
--
-- Run in Supabase SQL Editor before using the new order form.
-- Safe to run multiple times (IF NOT EXISTS on all columns).
-- ============================================================

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS specification          text,
  ADD COLUMN IF NOT EXISTS incoterms              text
    CHECK (incoterms IN ('FOB','CIF','DAP','DDP','EXW','CPT','FCA','CIP')),
  ADD COLUMN IF NOT EXISTS delivery_destination   text,
  ADD COLUMN IF NOT EXISTS required_delivery_date date,
  ADD COLUMN IF NOT EXISTS customer_po_date       date,
  ADD COLUMN IF NOT EXISTS payment_terms          text,
  ADD COLUMN IF NOT EXISTS special_conditions     text;

-- Also create the Supabase Storage bucket for order documents.
-- Run this separately in the Supabase Storage UI (Supabase does not
-- support CREATE BUCKET via SQL):
--
--   Bucket name: order-documents
--   Public:      false
--   Allowed MIME types: application/pdf, image/*, message/rfc822, application/octet-stream
--
-- Then add this RLS policy on the bucket so authenticated users can
-- upload and download:
--
--   Policy name: order_documents_auth
--   Target:      authenticated
--   Operations:  SELECT, INSERT
--   USING:       bucket_id = 'order-documents'
--   WITH CHECK:  bucket_id = 'order-documents'
