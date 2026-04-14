/**
 * Vertex Metals Portal — Financials
 * Revenue tracking, margin analysis, collections and VAT return helper.
 * VAT: cash accounting basis — VAT due when payment is received, not when invoiced.
 * No input VAT: all supplier purchases are from non-UK (Indian) suppliers.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMon(yyyymm) {
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

// ── Period helpers ────────────────────────────────────────────────────────────

let _period = 'month';
let _trades  = [];

function getPeriodRange(period) {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = now.getMonth(); // 0-based

  if (period === 'month') {
    const label = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0, 23, 59, 59), label };
  }
  if (period === 'quarter') {
    const q      = Math.floor(m / 3);
    const qNames = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)'];
    return {
      from:  new Date(y, q * 3, 1),
      to:    new Date(y, q * 3 + 3, 0, 23, 59, 59),
      label: qNames[q] + ' ' + y,
      q, y,
    };
  }
  if (period === 'year') {
    return { from: new Date(y, 0, 1), to: new Date(y, 11, 31, 23, 59, 59), label: y.toString() };
  }
  return { from: null, to: null, label: 'All Time' };
}

function inRange(dateStr, range) {
  if (!range.from) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= range.from && d <= range.to;
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadFinancials() {
  const { data, error } = await supabaseClient
    .from('trades')
    .select(`
      id, reference, product, quantity_mt, status, created_at,
      sell_price_gbp, cost_price_gbp, vat_amount_gbp, vat_rate,
      invoice_number, invoice_date,
      payment_received_date, payment_received_gbp,
      supplier_payment_date, supplier_payment_gbp,
      buyer:contacts!trades_buyer_id_fkey(company_name),
      supplier:contacts!trades_supplier_id_fkey(company_name)
    `)
    .order('created_at', { ascending: false });

  const container = document.getElementById('fin-content');
  if (error) {
    container.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`;
    return;
  }
  _trades = data || [];
  renderAll();
}

function renderAll() {
  const range = getPeriodRange(_period);
  document.getElementById('period-label').textContent = range.label;
  renderKPIs(range);
  renderPL(range);
  renderVAT(range);
  renderTradeTable();
}

// ── Period selector ───────────────────────────────────────────────────────────

function setPeriod(p) {
  _period = p;
  document.querySelectorAll('.period-tab').forEach(btn => {
    btn.className = 'period-tab btn btn-sm ' + (btn.dataset.period === p ? 'btn-primary' : 'btn-ghost');
  });
  renderAll();
}

// ── KPI cards ─────────────────────────────────────────────────────────────────

const PIPELINE_STATUSES = ['enquiry', 'quoted', 'confirmed', 'in_transit', 'delivered'];

function kpiCard(label, value, sub, subColor) {
  const color = subColor ? `style="color:${subColor}"` : '';
  return `
    <div class="stat-card">
      <div class="stat-card__label">${label}</div>
      <div class="stat-card__value" style="font-size:var(--text-2xl)">${value}</div>
      <div class="stat-card__sub" ${color}>${sub}</div>
    </div>`;
}

function renderKPIs(range) {
  // Pipeline: always current — active deals not yet invoiced
  const pipeline    = _trades.filter(t => PIPELINE_STATUSES.includes(t.status));
  const pipelineVal = pipeline.reduce((s, t) => s + (t.sell_price_gbp || 0), 0);
  const pipelineN   = pipeline.length;

  // Revenue in period: trades with invoice_date in range
  const invoicedInPeriod = _trades.filter(t => t.invoice_date && inRange(t.invoice_date, range));
  const revenueInPeriod  = invoicedInPeriod.reduce((s, t) => s + (t.sell_price_gbp || 0), 0);
  const vatInvoiced      = invoicedInPeriod.reduce((s, t) => s + (t.vat_amount_gbp || 0), 0);

  // Collected in period: payment_received_date in range
  const collectedInPeriod = _trades.filter(t => t.payment_received_date && inRange(t.payment_received_date, range));
  const collectedVal      = collectedInPeriod.reduce((s, t) => s + (t.payment_received_gbp || 0), 0);

  // Outstanding: invoiced but payment not yet fully recorded (all time)
  const outstandingVal = _trades
    .filter(t => t.status === 'invoiced' || (t.invoice_date && !t.payment_received_date))
    .reduce((s, t) => {
      const total = (t.sell_price_gbp || 0) + (t.vat_amount_gbp || 0);
      const paid  = t.payment_received_gbp || 0;
      return s + Math.max(0, total - paid);
    }, 0);

  // Gross margin in period (by invoice_date)
  const marginVal  = invoicedInPeriod.reduce((s, t) => s + (t.sell_price_gbp || 0) - (t.cost_price_gbp || 0), 0);
  const marginPct  = revenueInPeriod > 0 ? (marginVal / revenueInPeriod * 100) : 0;

  // VAT due in period: cash basis — payment_received_date in range
  const vatDue = _trades
    .filter(t => t.payment_received_date && inRange(t.payment_received_date, range))
    .reduce((s, t) => s + (t.vat_amount_gbp || 0), 0);

  const row1 = document.getElementById('kpi-row-1');
  const row2 = document.getElementById('kpi-row-2');

  row1.innerHTML =
    kpiCard('Pipeline (active)', '£' + fmt(pipelineVal), pipelineN + ' deal' + (pipelineN !== 1 ? 's' : '') + ' in progress') +
    kpiCard('Revenue (ex‑VAT)', revenueInPeriod ? '£' + fmt(revenueInPeriod) : '—',
      invoicedInPeriod.length + ' invoice' + (invoicedInPeriod.length !== 1 ? 's' : '') + (vatInvoiced ? ' · £' + fmt(vatInvoiced) + ' VAT' : '')) +
    kpiCard('Collected', collectedVal ? '£' + fmt(collectedVal) : '—',
      collectedInPeriod.length + ' payment' + (collectedInPeriod.length !== 1 ? 's' : '') + ' received');

  row2.innerHTML =
    kpiCard('Outstanding (all time)', outstandingVal ? '£' + fmt(outstandingVal) : '£0.00',
      'Invoiced but not yet paid', outstandingVal > 0 ? 'var(--color-warning)' : null) +
    kpiCard('Gross Margin', marginVal ? '£' + fmt(marginVal) : '—',
      fmt(marginPct, 1) + '% margin', marginVal < 0 ? 'var(--color-danger)' : null) +
    kpiCard('Output VAT Due', vatDue ? '£' + fmt(vatDue) : '£0.00',
      'Cash basis · Box 1 of VAT return');

  row1.querySelectorAll('.stat-card').forEach(c => row1.appendChild(c));
}

// ── Monthly P&L table ─────────────────────────────────────────────────────────

function renderPL(range) {
  const tbody  = document.getElementById('pl-body');
  const header = document.getElementById('pl-header');

  // Group by invoice_date month
  const invoiced = _trades.filter(t => t.invoice_date);

  // Determine months to show
  let months;
  if (!range.from) {
    const set = new Set(invoiced.map(t => t.invoice_date.slice(0, 7)));
    months = [...set].sort();
    header.textContent = 'Monthly Breakdown — All Time';
  } else {
    months = [];
    const d = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
    const end = range.to;
    while (d <= end) {
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d.setMonth(d.getMonth() + 1);
    }
    header.textContent = 'Monthly Breakdown — ' + range.label;
  }

  if (months.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-6)">No invoiced trades yet. Record invoice dates on trades to populate this table.</td></tr>`;
    return;
  }

  let totalRev = 0, totalCost = 0, totalN = 0;
  const rows = months.map(mon => {
    const group   = invoiced.filter(t => t.invoice_date.startsWith(mon));
    const rev     = group.reduce((s, t) => s + (t.sell_price_gbp || 0), 0);
    const cost    = group.reduce((s, t) => s + (t.cost_price_gbp || 0), 0);
    const gp      = rev - cost;
    const gpPct   = rev > 0 ? (gp / rev * 100) : 0;
    totalRev += rev; totalCost += cost; totalN += group.length;
    if (group.length === 0) {
      return `<tr><td>${fmtMon(mon)}</td><td colspan="5" style="color:var(--color-text-muted);font-size:var(--text-sm)">No invoiced trades</td></tr>`;
    }
    return `<tr>
      <td>${fmtMon(mon)}</td>
      <td style="text-align:center">${group.length}</td>
      <td>£${fmt(rev)}</td>
      <td>£${fmt(cost)}</td>
      <td style="font-weight:600;color:${gp >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">£${fmt(gp)}</td>
      <td>${fmt(gpPct, 1)}%</td>
    </tr>`;
  });

  // Totals row (only if more than one month or all time)
  const totalGP    = totalRev - totalCost;
  const totalGPPct = totalRev > 0 ? (totalGP / totalRev * 100) : 0;
  const totalsRow  = months.length > 1 ? `
    <tr style="border-top:2px solid var(--color-border);background:var(--color-surface);font-weight:700">
      <td>Total</td>
      <td style="text-align:center">${totalN}</td>
      <td>£${fmt(totalRev)}</td>
      <td>£${fmt(totalCost)}</td>
      <td style="color:${totalGP >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">£${fmt(totalGP)}</td>
      <td>${fmt(totalGPPct, 1)}%</td>
    </tr>` : '';

  tbody.innerHTML = rows.join('') + totalsRow;
}

// ── VAT return panel ──────────────────────────────────────────────────────────

function renderVAT(range) {
  const panel = document.getElementById('vat-body');

  // Cash basis: VAT due = vat_amount_gbp where payment_received_date in period
  const vatTrades = _trades.filter(t => t.payment_received_date && inRange(t.payment_received_date, range));
  const box1  = vatTrades.reduce((s, t) => s + (t.vat_amount_gbp  || 0), 0);
  const box6  = vatTrades.reduce((s, t) => s + (t.sell_price_gbp  || 0), 0);
  const box7  = vatTrades.reduce((s, t) => s + (t.cost_price_gbp  || 0), 0);

  const vatRow = (box, label, value, bold, color) => `
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border)">
      <span style="font-size:var(--text-sm);color:var(--color-text-muted)">${box ? `<span style="font-family:var(--font-display);font-size:var(--text-xs);color:var(--color-text-muted);margin-right:var(--space-2)">${box}</span>` : ''}${label}</span>
      <span style="font-family:var(--font-display);font-size:var(--text-sm);font-weight:${bold ? 700 : 500};color:${color || 'var(--color-text-primary)'}">${value}</span>
    </div>`;

  const isQuarter = _period === 'quarter';
  const note = isQuarter
    ? `<div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--color-border)">Based on payments received in ${range.label}. Cash accounting basis.</div>`
    : `<div style="font-size:var(--text-xs);color:var(--color-accent-dark);background:rgba(122,184,212,0.1);border-radius:var(--radius-sm);padding:var(--space-2) var(--space-3);margin-top:var(--space-3)">Switch to <strong>This Quarter</strong> for VAT return figures.</div>`;

  panel.innerHTML = `
    <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-4)">Cash accounting · No input VAT</p>
    ${vatRow('Box 1', 'Output VAT due', '£' + fmt(box1), true, box1 > 0 ? 'var(--color-danger)' : null)}
    ${vatRow('Box 4', 'Input VAT (reclaimed)', '£0.00', false)}
    ${vatRow('Box 5', 'Net VAT to pay', '£' + fmt(box1), true, box1 > 0 ? 'var(--color-danger)' : null)}
    <div style="border-top:2px solid var(--color-border);margin:var(--space-3) 0"></div>
    ${vatRow('Box 6', 'Total sales ex‑VAT', '£' + fmt(box6), false)}
    ${vatRow('Box 7', 'Total purchases ex‑VAT', '£' + fmt(box7), false)}
    ${note}`;
}

// ── Trade financials table ────────────────────────────────────────────────────

function renderTradeTable() {
  const tbody = document.getElementById('trade-fin-body');

  if (_trades.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No trades yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = _trades.map(t => {
    const invoiceTotal = (t.sell_price_gbp || 0) + (t.vat_amount_gbp || 0);
    const collected    = t.payment_received_gbp || 0;
    const balance      = invoiceTotal - collected;

    let payBadge;
    if (!t.invoice_date) {
      payBadge = '<span class="badge badge-neutral">Not invoiced</span>';
    } else if (collected >= invoiceTotal && invoiceTotal > 0) {
      payBadge = '<span class="badge badge-success">Paid</span>';
    } else if (collected > 0) {
      payBadge = `<span class="badge badge-warning">Partial</span>`;
    } else {
      payBadge = '<span class="badge badge-info">Invoiced</span>';
    }

    const supplierPaid = t.supplier_payment_gbp
      ? `<span style="color:var(--color-success)">£${fmt(t.supplier_payment_gbp)}</span>`
      : '<span style="color:var(--color-text-muted)">—</span>';

    return `<tr>
      <td><a href="../trades/detail.html?id=${esc(t.id)}" style="font-family:var(--font-display);font-weight:600;color:var(--color-accent-dark)">${esc(t.reference || t.id.slice(0,8))}</a></td>
      <td>${esc(t.buyer?.company_name || '—')}</td>
      <td style="font-size:var(--text-sm)">${esc(t.invoice_number || '—')}<br><span style="color:var(--color-text-muted)">${fmtDate(t.invoice_date)}</span></td>
      <td>${t.sell_price_gbp ? '£' + fmt(invoiceTotal) : '—'}<br><span style="font-size:var(--text-xs);color:var(--color-text-muted)">${t.sell_price_gbp ? '£' + fmt(t.sell_price_gbp) + ' ex‑VAT' : ''}</span></td>
      <td>${collected ? '£' + fmt(collected) : '—'}<br><span style="font-size:var(--text-xs);color:var(--color-text-muted)">${fmtDate(t.payment_received_date)}</span></td>
      <td>${supplierPaid}<br><span style="font-size:var(--text-xs);color:var(--color-text-muted)">${fmtDate(t.supplier_payment_date)}</span></td>
      <td>${payBadge}</td>
      <td style="text-align:right"><button class="btn btn-ghost btn-sm" onclick="openRecordModal('${esc(t.id)}')">Record</button></td>
    </tr>`;
  }).join('');
}

// ── Record modal ──────────────────────────────────────────────────────────────

function openRecordModal(id) {
  const t = _trades.find(x => x.id === id);
  if (!t) return;

  const invoiceTotal = (t.sell_price_gbp || 0) + (t.vat_amount_gbp || 0);

  document.getElementById('record-modal-title').textContent =
    'Record — ' + (t.reference || t.id.slice(0, 8)) + (t.buyer?.company_name ? ' · ' + t.buyer.company_name : '');

  document.getElementById('record-modal-body').innerHTML = `
    <form id="record-form" onsubmit="submitRecord(event,'${esc(id)}')">

      <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-3)">Invoice</p>
      ${invoiceTotal > 0 ? `<p style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-3)">Invoice total (inc. VAT): <strong>£${fmt(invoiceTotal)}</strong></p>` : ''}
      <div class="form-grid" style="margin-bottom:var(--space-5)">
        <div class="form-group">
          <label class="form-label">Invoice Number</label>
          <input type="text" class="form-input" id="rec-inv-num" value="${esc(t.invoice_number || '')}" placeholder="e.g. VM-INV-001" />
        </div>
        <div class="form-group">
          <label class="form-label">Invoice Date</label>
          <input type="date" class="form-input" id="rec-inv-date" value="${t.invoice_date || ''}" />
        </div>
      </div>

      <hr style="border:none;border-top:1px solid var(--color-border);margin:0 0 var(--space-5)" />
      <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-3)">Payment Received from Buyer</p>
      <div class="form-grid" style="margin-bottom:var(--space-5)">
        <div class="form-group">
          <label class="form-label">Date Received</label>
          <input type="date" class="form-input" id="rec-pay-date" value="${t.payment_received_date || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Amount Received (£)</label>
          <input type="number" class="form-input" id="rec-pay-amt" value="${t.payment_received_gbp || ''}" step="0.01" min="0" placeholder="e.g. ${fmt(invoiceTotal)}" />
        </div>
      </div>

      <hr style="border:none;border-top:1px solid var(--color-border);margin:0 0 var(--space-5)" />
      <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-3)">Payment to Supplier</p>
      <div class="form-grid" style="margin-bottom:var(--space-5)">
        <div class="form-group">
          <label class="form-label">Date Paid</label>
          <input type="date" class="form-input" id="rec-sup-date" value="${t.supplier_payment_date || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Amount Paid (£)</label>
          <input type="number" class="form-input" id="rec-sup-amt" value="${t.supplier_payment_gbp || ''}" step="0.01" min="0" placeholder="e.g. ${fmt(t.cost_price_gbp || 0)}" />
        </div>
      </div>

      <div id="record-alert" class="alert" style="display:none;margin-bottom:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3)">
        <button type="submit" class="btn btn-primary">Save</button>
        <button type="button" class="btn btn-ghost" onclick="closeRecordModal()">Cancel</button>
      </div>
    </form>`;

  document.getElementById('record-modal').classList.add('open');
}

function closeRecordModal() {
  document.getElementById('record-modal').classList.remove('open');
}

async function submitRecord(e, id) {
  e.preventDefault();
  const alertEl = document.getElementById('record-alert');

  const invNum  = document.getElementById('rec-inv-num').value.trim()  || null;
  const invDate = document.getElementById('rec-inv-date').value         || null;
  const payDate = document.getElementById('rec-pay-date').value         || null;
  const payAmt  = parseFloat(document.getElementById('rec-pay-amt').value) || null;
  const supDate = document.getElementById('rec-sup-date').value         || null;
  const supAmt  = parseFloat(document.getElementById('rec-sup-amt').value) || null;

  // Update trade status automatically when payment received
  const trade   = _trades.find(t => t.id === id);
  const updates = {
    invoice_number:         invNum,
    invoice_date:           invDate,
    payment_received_date:  payDate,
    payment_received_gbp:   payAmt,
    supplier_payment_date:  supDate,
    supplier_payment_gbp:   supAmt,
  };

  // Auto-advance status
  if (payAmt && trade) {
    const total = (trade.sell_price_gbp || 0) + (trade.vat_amount_gbp || 0);
    if (payAmt >= total && !['complete'].includes(trade.status)) {
      updates.status = 'complete';
    } else if (invDate && trade.status === 'delivered') {
      updates.status = 'invoiced';
    }
  }

  const { error } = await supabaseClient.from('trades').update(updates).eq('id', id);
  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
  } else {
    closeRecordModal();
    loadFinancials();
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  document.getElementById('user-email').textContent = user?.email || '';
  loadFinancials();
})();
