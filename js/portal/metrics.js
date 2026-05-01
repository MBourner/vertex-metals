/**
 * Vertex Metals Portal — Management Metrics
 * ISO 9001 clause 9.1 monitoring data.
 * Queries the six v_ views created by phase-6-metrics-views.sql.
 */

function esc(s) { if (s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(n, dp=1) { if (n==null||isNaN(n)) return '—'; return Number(n).toLocaleString('en-GB',{minimumFractionDigits:dp,maximumFractionDigits:dp}); }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB',{month:'short',year:'numeric'}); }
function fmtQuarter(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `Q${Math.ceil((dt.getMonth()+1)/3)} ${dt.getFullYear()}`;
}
function fmtWeek(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}

const QUEUE_LABELS = {
  po_translation:'PO Translation', supplier_po_approval:'Supplier PO',
  release_approval:'Release', invoice_review:'Invoice Review',
};

function emptyState(msg) {
  return `<p style="color:var(--color-text-muted);font-size:var(--text-sm);padding:var(--space-4) 0">${esc(msg)}</p>`;
}

async function loadAll() {
  const [turnaround, rejections, sla, payment, concessions, disputes] = await Promise.all([
    supabaseClient.from('v_verification_turnaround').select('*').order('month', {ascending:false}),
    supabaseClient.from('v_verification_rejection_rates').select('*').order('rejections', {ascending:false}),
    supabaseClient.from('v_sla_breach_summary').select('*').order('week_starting', {ascending:false}).limit(20),
    supabaseClient.from('v_payment_days').select('buyer, supplier, invoice_date, customer_payment_days, supplier_payment_days').not('invoice_date','is',null).order('invoice_date', {ascending:false}).limit(50),
    supabaseClient.from('v_concession_rate_by_supplier').select('*').order('quarter', {ascending:false}),
    supabaseClient.from('v_dispute_rate_by_supplier').select('*').order('quarter', {ascending:false}),
  ]);

  renderTurnaround(turnaround.data || []);
  renderRejections(rejections.data || []);
  renderSla(sla.data || []);
  renderPaymentDays(payment.data || []);
  renderConcessionRate(concessions.data || []);
  renderDisputeRate(disputes.data || []);
}

function renderTurnaround(rows) {
  const el = document.getElementById('m-turnaround');
  if (!rows.length) { el.innerHTML = emptyState('No completed verifications yet. Data will appear once queue items are approved or rejected.'); return; }
  el.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Month</th><th>Queue Type</th><th>Decisions</th><th>Median (hrs)</th><th>P90 (hrs)</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td style="font-size:var(--text-sm)">${fmtDate(r.month)}</td>
      <td style="font-size:var(--text-sm)">${esc(QUEUE_LABELS[r.queue_type]||r.queue_type)}</td>
      <td style="font-size:var(--text-sm)">${r.decisions}</td>
      <td style="font-size:var(--text-sm)">${fmt(r.median_hours)}</td>
      <td style="font-size:var(--text-sm)">${fmt(r.p90_hours)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderRejections(rows) {
  const el = document.getElementById('m-rejections');
  if (!rows.length) { el.innerHTML = emptyState('No rejection data yet.'); return; }
  el.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Queue Type</th><th>Reason Code</th><th>Rejections</th><th>Total</th><th>Rate</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td style="font-size:var(--text-sm)">${esc(QUEUE_LABELS[r.queue_type]||r.queue_type)}</td>
      <td style="font-size:var(--text-sm)">${esc(r.reason_code)}</td>
      <td style="font-size:var(--text-sm)">${r.rejections}</td>
      <td style="font-size:var(--text-sm)">${r.total_decisions}</td>
      <td><span style="font-size:var(--text-sm);font-weight:600;color:${Number(r.rejection_rate_pct)>20?'var(--color-danger)':Number(r.rejection_rate_pct)>10?'#d97706':'inherit'}">${fmt(r.rejection_rate_pct)}%</span></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderSla(rows) {
  const el = document.getElementById('m-sla');
  if (!rows.length) { el.innerHTML = emptyState('No SLA data yet.'); return; }
  el.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Week</th><th>Queue Type</th><th>Active Breaches</th><th>Historical Breaches</th><th>Total Items</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td style="font-size:var(--text-sm)">${fmtWeek(r.week_starting)}</td>
      <td style="font-size:var(--text-sm)">${esc(QUEUE_LABELS[r.queue_type]||r.queue_type)}</td>
      <td style="font-size:var(--text-sm);color:${r.active_breaches>0?'var(--color-danger)':'inherit'};font-weight:${r.active_breaches>0?'600':'400'}">${r.active_breaches}</td>
      <td style="font-size:var(--text-sm);color:${r.historical_breaches>0?'#d97706':'inherit'}">${r.historical_breaches}</td>
      <td style="font-size:var(--text-sm)">${r.total}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderPaymentDays(rows) {
  const el = document.getElementById('m-payment-days');
  if (!rows.length) { el.innerHTML = emptyState('No invoiced trades yet. Data appears once trades have an invoice date.'); return; }
  const custDays = rows.filter(r => r.customer_payment_days != null).map(r => r.customer_payment_days);
  const suppDays = rows.filter(r => r.supplier_payment_days != null).map(r => r.supplier_payment_days);
  const avg = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : '—';

  el.innerHTML = `
    <div style="display:flex;gap:var(--space-6);margin-bottom:var(--space-5)">
      <div class="stat-card" style="flex:1;min-width:0">
        <div class="stat-card__label">Avg Customer Payment Days</div>
        <div class="stat-card__value">${avg(custDays)}</div>
        <div class="stat-card__sub">From invoice to receipt</div>
      </div>
      <div class="stat-card" style="flex:1;min-width:0">
        <div class="stat-card__label">Avg Supplier Payment Days</div>
        <div class="stat-card__value">${avg(suppDays)}</div>
        <div class="stat-card__sub">From invoice to payment</div>
      </div>
    </div>
    <div class="table-wrapper"><table>
      <thead><tr><th>Invoice Date</th><th>Buyer</th><th>Supplier</th><th>Customer Days</th><th>Supplier Days</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td style="font-size:var(--text-sm)">${new Date(r.invoice_date).toLocaleDateString('en-GB')}</td>
        <td style="font-size:var(--text-sm)">${esc(r.buyer||'—')}</td>
        <td style="font-size:var(--text-sm)">${esc(r.supplier||'—')}</td>
        <td style="font-size:var(--text-sm)">${r.customer_payment_days ?? '—'}</td>
        <td style="font-size:var(--text-sm)">${r.supplier_payment_days ?? '—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

function renderConcessionRate(rows) {
  const el = document.getElementById('m-concession-rate');
  if (!rows.length) { el.innerHTML = emptyState('No supplier order history yet.'); return; }
  el.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Quarter</th><th>Supplier</th><th>Orders</th><th>Concessions</th><th>Rate</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td style="font-size:var(--text-sm)">${fmtQuarter(r.quarter)}</td>
      <td style="font-size:var(--text-sm)">${esc(r.supplier)}</td>
      <td style="font-size:var(--text-sm)">${r.total_orders}</td>
      <td style="font-size:var(--text-sm)">${r.concessions}</td>
      <td><span style="font-size:var(--text-sm);font-weight:600;color:${Number(r.concession_rate_pct)>15?'var(--color-danger)':Number(r.concession_rate_pct)>5?'#d97706':'inherit'}">${fmt(r.concession_rate_pct)}%</span></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderDisputeRate(rows) {
  const el = document.getElementById('m-dispute-rate');
  if (!rows.length) { el.innerHTML = emptyState('No supplier order history yet.'); return; }
  el.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Quarter</th><th>Supplier</th><th>Orders</th><th>Disputes</th><th>Rate</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td style="font-size:var(--text-sm)">${fmtQuarter(r.quarter)}</td>
      <td style="font-size:var(--text-sm)">${esc(r.supplier)}</td>
      <td style="font-size:var(--text-sm)">${r.total_orders}</td>
      <td style="font-size:var(--text-sm)">${r.disputes}</td>
      <td><span style="font-size:var(--text-sm);font-weight:600;color:${Number(r.dispute_rate_pct)>15?'var(--color-danger)':Number(r.dispute_rate_pct)>5?'#d97706':'inherit'}">${fmt(r.dispute_rate_pct)}%</span></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  await StateMachine.loadReference();
  await loadAll();
})();
