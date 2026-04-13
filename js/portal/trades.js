/**
 * Vertex Metals Portal — Trades
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function tradeStatusBadge(status) {
  const map = {
    enquiry:    'neutral',
    quoted:     'info',
    confirmed:  'accent',
    in_transit: 'warning',
    delivered:  'success',
    invoiced:   'warning',
    complete:   'success',
  };
  const label = status ? status.replace('_', ' ') : '—';
  return `<span class="badge badge-${map[status] || 'neutral'}">${esc(label)}</span>`;
}

const STATUS_OPTIONS = ['enquiry','quoted','confirmed','in_transit','delivered','invoiced','complete'];

async function loadTrades() {
  const statusFilter = document.getElementById('filter-status')?.value || '';
  const tbody = document.getElementById('trades-body');

  let query = supabaseClient
    .from('trades')
    .select(`
      id, reference, product, quantity_mt, sell_price_gbp, cost_price_gbp, status, created_at,
      buyer:contacts!trades_buyer_id_fkey(company_name),
      supplier:contacts!trades_supplier_id_fkey(company_name)
    `)
    .order('created_at', { ascending: false });

  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No trades found.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(t => {
    const margin = (t.sell_price_gbp != null && t.cost_price_gbp != null)
      ? t.sell_price_gbp - t.cost_price_gbp : null;
    const marginClass = margin != null && margin < 0 ? 'style="color:var(--color-danger)"' : '';
    return `<tr style="cursor:pointer" onclick="window.location.href='detail.html?id=${esc(t.id)}'">
      <td style="font-family:var(--font-display);font-weight:600">${esc(t.reference || t.id.slice(0,8))}</td>
      <td>${esc(t.buyer?.company_name || '—')}</td>
      <td>${esc(t.supplier?.company_name || '—')}</td>
      <td>${esc(t.product || '—')}</td>
      <td>${fmt(t.quantity_mt, 0)}</td>
      <td>${t.sell_price_gbp != null ? '£' + fmt(t.sell_price_gbp) : '—'}</td>
      <td ${marginClass}>${margin != null ? '£' + fmt(margin) : '—'}</td>
      <td>${tradeStatusBadge(t.status)}</td>
    </tr>`;
  }).join('');
}

// ── New Trade Form ──────────────────────────────────────────────────────────

async function buildTradeForm(buyers, suppliers) {
  return `
    <form id="new-trade-form" onsubmit="submitTrade(event)">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Reference <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-input" id="trade-reference" placeholder="e.g. VM-2025-001" required />
        </div>
        <div class="form-group">
          <label class="form-label">Product <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-input" id="trade-product" placeholder="e.g. Aluminium Alloy Core Wire EC" required />
        </div>
        <div class="form-group">
          <label class="form-label">Buyer</label>
          <select class="form-select" id="trade-buyer">
            <option value="">— Select buyer —</option>
            ${buyers.map(c => `<option value="${esc(c.id)}">${esc(c.company_name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Supplier</label>
          <select class="form-select" id="trade-supplier">
            <option value="">— Select supplier —</option>
            ${suppliers.map(c => `<option value="${esc(c.id)}">${esc(c.company_name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Quantity (MT)</label>
          <input type="number" class="form-input" id="trade-qty" step="0.001" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Sell Price (GBP total)</label>
          <input type="number" class="form-input" id="trade-sell" step="0.01" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Cost Price (GBP total)</label>
          <input type="number" class="form-input" id="trade-cost" step="0.01" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" id="trade-status">
            ${STATUS_OPTIONS.map(s => `<option value="${s}"${s==='enquiry'?' selected':''}>${s.replace('_',' ')}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-top:var(--space-2)">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="trade-notes" rows="3" placeholder="Additional details…"></textarea>
      </div>
      <div id="trade-form-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Create Trade</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('new-trade-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;
}

async function submitTrade(e) {
  e.preventDefault();
  const alertEl = document.getElementById('trade-form-alert');

  const reference = document.getElementById('trade-reference').value.trim();
  const product   = document.getElementById('trade-product').value.trim();
  const buyer_id  = document.getElementById('trade-buyer').value || null;
  const supplier_id = document.getElementById('trade-supplier').value || null;
  const quantity_mt  = parseFloat(document.getElementById('trade-qty').value) || null;
  const sell_price_gbp = parseFloat(document.getElementById('trade-sell').value) || null;
  const cost_price_gbp = parseFloat(document.getElementById('trade-cost').value) || null;
  const status   = document.getElementById('trade-status').value;
  const notes    = document.getElementById('trade-notes').value.trim() || null;

  if (!reference || !product) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Reference and product are required.'; return;
  }

  const { error } = await supabaseClient.from('trades').insert([{
    reference, product, buyer_id, supplier_id, quantity_mt,
    sell_price_gbp, cost_price_gbp, status, notes
  }]);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
  } else {
    document.getElementById('new-trade-modal').classList.remove('open');
    loadTrades();
  }
}

// ── Trade Detail page ───────────────────────────────────────────────────────

async function loadTradeDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { document.getElementById('trade-title').textContent = 'Trade not found'; return; }

  const { data: t, error } = await supabaseClient
    .from('trades')
    .select(`
      *,
      buyer:contacts!trades_buyer_id_fkey(id, company_name, email, phone),
      supplier:contacts!trades_supplier_id_fkey(id, company_name, email, phone)
    `)
    .eq('id', id)
    .single();

  if (error || !t) {
    document.getElementById('trade-title').textContent = 'Error loading trade';
    document.getElementById('trade-detail').innerHTML = `<div class="alert alert-error">${esc(error?.message || 'Not found')}</div>`;
    return;
  }

  document.getElementById('trade-title').textContent = t.reference || t.id.slice(0, 8);
  document.title = `Trade ${t.reference || ''} — Vertex Metals Portal`;

  const margin = (t.sell_price_gbp != null && t.cost_price_gbp != null)
    ? t.sell_price_gbp - t.cost_price_gbp : null;
  const marginPct = margin != null && t.sell_price_gbp ? (margin / t.sell_price_gbp * 100) : null;

  document.getElementById('trade-detail').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6);margin-bottom:var(--space-6)">
      <!-- Left column -->
      <div>
        <h3 style="font-size:var(--text-sm);text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-muted);margin-bottom:var(--space-4)">Trade Details</h3>
        <dl style="display:grid;grid-template-columns:auto 1fr;gap:var(--space-2) var(--space-4)">
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Reference</dt><dd style="font-weight:600;font-family:var(--font-display)">${esc(t.reference || '—')}</dd>
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Product</dt><dd>${esc(t.product || '—')}</dd>
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Quantity</dt><dd>${fmt(t.quantity_mt, 0)} MT</dd>
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Status</dt><dd>${tradeStatusBadge(t.status)}</dd>
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Created</dt><dd>${new Date(t.created_at).toLocaleDateString('en-GB')}</dd>
        </dl>
      </div>
      <!-- Right column: financials -->
      <div>
        <h3 style="font-size:var(--text-sm);text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-muted);margin-bottom:var(--space-4)">Financials (GBP)</h3>
        <dl style="display:grid;grid-template-columns:auto 1fr;gap:var(--space-2) var(--space-4)">
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Sell price</dt><dd style="font-family:var(--font-display);font-weight:700">${t.sell_price_gbp != null ? '£' + fmt(t.sell_price_gbp) : '—'}</dd>
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Cost price</dt><dd style="font-family:var(--font-display)">${t.cost_price_gbp != null ? '£' + fmt(t.cost_price_gbp) : '—'}</dd>
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Gross margin</dt><dd style="font-family:var(--font-display);font-weight:700;color:${margin != null && margin < 0 ? 'var(--color-danger)' : 'var(--color-success)'}">${margin != null ? '£' + fmt(margin) : '—'}</dd>
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Margin %</dt><dd>${marginPct != null ? fmt(marginPct, 1) + '%' : '—'}</dd>
        </dl>
      </div>
    </div>

    <!-- Parties -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6);margin-bottom:var(--space-6)">
      <div class="panel"><div class="panel-header">Buyer</div><div class="panel-body">
        ${t.buyer ? `<div style="font-weight:600">${esc(t.buyer.company_name)}</div><div style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(t.buyer.email || '')}</div><div style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(t.buyer.phone || '')}</div>` : '<span style="color:var(--color-text-muted)">No buyer linked</span>'}
      </div></div>
      <div class="panel"><div class="panel-header">Supplier</div><div class="panel-body">
        ${t.supplier ? `<div style="font-weight:600">${esc(t.supplier.company_name)}</div><div style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(t.supplier.email || '')}</div><div style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(t.supplier.phone || '')}</div>` : '<span style="color:var(--color-text-muted)">No supplier linked</span>'}
      </div></div>
    </div>

    <!-- Notes + Status update -->
    <div style="display:grid;grid-template-columns:1fr 300px;gap:var(--space-6)">
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="trade-notes-field" rows="5">${esc(t.notes || '')}</textarea>
        <button class="btn btn-primary btn-sm" style="margin-top:var(--space-3)" onclick="saveTradeNotes('${esc(id)}')">Save Notes</button>
        <div id="notes-alert" class="alert" style="display:none;margin-top:var(--space-2)"></div>
      </div>
      <div>
        <div class="form-group">
          <label class="form-label">Update Status</label>
          <select class="form-select" id="trade-status-select">
            ${STATUS_OPTIONS.map(s => `<option value="${s}"${s===t.status?' selected':''}>${s.replace('_',' ')}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" style="margin-top:var(--space-3);width:100%" onclick="saveTradeStatus('${esc(id)}')">Update Status</button>
          <div id="status-alert" class="alert" style="display:none;margin-top:var(--space-2)"></div>
        </div>
      </div>
    </div>`;
}

async function saveTradeNotes(id) {
  const notes = document.getElementById('trade-notes-field').value.trim() || null;
  const alertEl = document.getElementById('notes-alert');
  const { error } = await supabaseClient.from('trades').update({ notes }).eq('id', id);
  alertEl.style.display = 'block';
  alertEl.className = error ? 'alert alert-error' : 'alert alert-success';
  alertEl.textContent = error ? 'Save failed: ' + error.message : 'Notes saved.';
}

async function saveTradeStatus(id) {
  const status = document.getElementById('trade-status-select').value;
  const alertEl = document.getElementById('status-alert');
  const { error } = await supabaseClient.from('trades').update({ status }).eq('id', id);
  alertEl.style.display = 'block';
  alertEl.className = error ? 'alert alert-error' : 'alert alert-success';
  alertEl.textContent = error ? 'Update failed: ' + error.message : 'Status updated.';
}

// ── Init ───────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user?.email || '';

  if (document.getElementById('trades-body')) {
    // List page
    const [{ data: buyers }, { data: suppliers }] = await Promise.all([
      supabaseClient.from('contacts').select('id, company_name').eq('type', 'buyer').order('company_name'),
      supabaseClient.from('contacts').select('id, company_name').eq('type', 'supplier').order('company_name'),
    ]);

    const container = document.getElementById('trade-form-container');
    if (container) container.innerHTML = await buildTradeForm(buyers || [], suppliers || []);

    loadTrades();
  } else if (document.getElementById('trade-detail')) {
    // Detail page
    loadTradeDetail();
  }
})();
