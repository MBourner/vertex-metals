-- ============================================================
-- Vertex Metals Portal — Phase 6 Metrics Views
-- ISO 9001 clause 9.1 monitoring metrics surfaced on the
-- portal/metrics/index.html page.
--
-- Run in Supabase SQL Editor.
-- Views are read-only and accessible to authenticated users.
-- ============================================================

-- 1. Verification turnaround time (median and p90 hours) by queue type and month
CREATE OR REPLACE VIEW v_verification_turnaround AS
SELECT
  queue_type,
  DATE_TRUNC('month', decision_at)::date                                        AS month,
  COUNT(*)                                                                       AS decisions,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (decision_at - created_at)) / 3600
  )::numeric, 1)                                                                AS median_hours,
  ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (decision_at - created_at)) / 3600
  )::numeric, 1)                                                                AS p90_hours
FROM verification_queue
WHERE status IN ('approved','rejected')
  AND decision_at IS NOT NULL
GROUP BY queue_type, DATE_TRUNC('month', decision_at)
ORDER BY month DESC, queue_type;


-- 2. Rejection rate by queue type and reason code
CREATE OR REPLACE VIEW v_verification_rejection_rates AS
SELECT
  queue_type,
  COALESCE(decision_reason_code, '(none)')                                      AS reason_code,
  COUNT(*) FILTER (WHERE status = 'rejected')                                   AS rejections,
  COUNT(*)                                                                       AS total_decisions,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'rejected') * 100.0
    / NULLIF(COUNT(*), 0)
  , 1)                                                                           AS rejection_rate_pct
FROM verification_queue
WHERE status IN ('approved','rejected')
GROUP BY queue_type, COALESCE(decision_reason_code, '(none)')
ORDER BY rejections DESC;


-- 3. SLA breach count by queue type and week
CREATE OR REPLACE VIEW v_sla_breach_summary AS
SELECT
  queue_type,
  DATE_TRUNC('week', sla_due_at)::date                                          AS week_starting,
  COUNT(*) FILTER (
    WHERE status NOT IN ('approved','rejected','cancelled')
    AND   sla_due_at < NOW()
  )                                                                              AS active_breaches,
  COUNT(*) FILTER (
    WHERE decision_at IS NOT NULL
    AND   decision_at > sla_due_at
  )                                                                              AS historical_breaches,
  COUNT(*)                                                                       AS total
FROM verification_queue
GROUP BY queue_type, DATE_TRUNC('week', sla_due_at)
ORDER BY week_starting DESC, queue_type;


-- 4. Customer and supplier payment days per trade
CREATE OR REPLACE VIEW v_payment_days AS
SELECT
  t.id,
  t.reference,
  t.invoice_date,
  t.payment_received_date,
  t.supplier_payment_date,
  (t.payment_received_date - t.invoice_date)                                    AS customer_payment_days,
  (t.supplier_payment_date - t.invoice_date)                                    AS supplier_payment_days,
  b.company_name                                                                AS buyer,
  s.company_name                                                                AS supplier
FROM trades t
LEFT JOIN contacts b ON b.id = t.buyer_id
LEFT JOIN contacts s ON s.id = t.supplier_id
WHERE t.invoice_date IS NOT NULL;


-- 5. Concession rate per supplier per quarter
CREATE OR REPLACE VIEW v_concession_rate_by_supplier AS
SELECT
  s.company_name                                                                AS supplier,
  DATE_TRUNC('quarter', t.created_at)::date                                    AS quarter,
  COUNT(DISTINCT t.id)                                                          AS total_orders,
  COUNT(DISTINCT c.id)                                                          AS concessions,
  ROUND(
    COUNT(DISTINCT c.id) * 100.0 / NULLIF(COUNT(DISTINCT t.id), 0)
  , 1)                                                                           AS concession_rate_pct
FROM trades t
JOIN contacts s ON s.id = t.supplier_id
LEFT JOIN concessions c ON c.trade_id = t.id
GROUP BY s.company_name, DATE_TRUNC('quarter', t.created_at)
ORDER BY quarter DESC, concession_rate_pct DESC;


-- 6. Dispute rate per supplier per quarter
CREATE OR REPLACE VIEW v_dispute_rate_by_supplier AS
SELECT
  s.company_name                                                                AS supplier,
  DATE_TRUNC('quarter', t.created_at)::date                                    AS quarter,
  COUNT(DISTINCT t.id)                                                          AS total_orders,
  COUNT(DISTINCT d.id)                                                          AS disputes,
  ROUND(
    COUNT(DISTINCT d.id) * 100.0 / NULLIF(COUNT(DISTINCT t.id), 0)
  , 1)                                                                           AS dispute_rate_pct
FROM trades t
JOIN contacts s ON s.id = t.supplier_id
LEFT JOIN disputes d ON d.trade_id = t.id
GROUP BY s.company_name, DATE_TRUNC('quarter', t.created_at)
ORDER BY quarter DESC, dispute_rate_pct DESC;
