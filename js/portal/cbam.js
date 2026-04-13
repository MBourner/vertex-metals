/**
 * Vertex Metals Portal — CBAM Tracker
 * UK Carbon Border Adjustment Mechanism — embedded carbon reporting
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function cbamStatusBadge(status) {
  const map = {
    pending:       'warning',
    data_received: 'info',
    submitted:     'accent',
    verified:      'success',
  };
  const labels = {
    pending:       'Pending',
    data_received: 'Data Received',
    submitted:     'Submitted',
    verified:      'Verified',
  };
  return `<span class="badge badge-${map[status] || 'neutral'}">${esc(labels[status] || status || '—')}</span>`;
}

const CBAM_STATUSES = ['pending', 'data_received', 'submitted', 'verified'];

// ── List ────────────────────────────────────────────────────────────────────

async function loadCbam() {
  const statusFilter = document.getElementById('filter-status')?.value || '';
  const yearFilter   = document.getElementById('filter-year')?.value   || '';
  const tbody = document.getElementById('cbam-body');

  let query = supabaseClient
    .from('cbam_records')
    .select(`
      *,
      trade:trades(reference),
      supplier:contacts(company_name)
    `)
    .order('import_date', { ascending: false });

  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
    return;
  }

  let rows = data || [];

  // Client-side year filter (import_date is a date string)
  if (yearFilter) {
    rows = rows.filter(r => r.import_date && r.import_date.startsWith(yearFilter));
  }

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No CBAM entries found.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    return `<tr style="cursor:pointer" onclick="openCbamDetail('${esc(r.id)}')">
      <td style="font-family:var(--font-display);font-weight:600">${esc(r.trade?.reference || r.trade_id?.slice(0,8) || '—')}</td>
      <td>${esc(r.supplier?.company_name || '—')}</td>
      <td>${esc(r.product || '—')}</td>
      <td>${fmt(r.quantity_mt, 0)}</td>
      <td>${r.import_date ? new Date(r.import_date).toLocaleDateString('en-GB') : '—'}</td>
      <td>${esc(r.cn_code || '—')}</td>
      <td style="font-family:var(--font-display)">${r.embedded_co2_tco2e != null ? fmt(r.embedded_co2_tco2e, 3) : '—'}</td>
      <td>${cbamStatusBadge(r.status)}</td>
    </tr>`;
  }).join('');
}

// ── Inline detail expand ────────────────────────────────────────────────────

function openCbamDetail(id) {
  const existing = document.getElementById(`cbam-detail-${id}`);
  if (existing) { existing.remove(); return; }

  const rows = document.querySelectorAll('#cbam-body tr');
  let targetRow = null;
  rows.forEach(r => {
    if (r.getAttribute('onclick') === `openCbamDetail('${id}')`) targetRow = r;
  });
  if (!targetRow) return;

  const detailRow = document.createElement('tr');
  detailRow.id = `cbam-detail-${id}`;
  detailRow.innerHTML = `<td colspan="8" style="background:var(--color-surface);padding:var(--space-4)"><div id="cbam-dc-${id}" style="color:var(--color-text-muted)">Loading…</div></td>`;
  targetRow.insertAdjacentElement('afterend', detailRow);
  fetchCbamDetail(id);
}

async function fetchCbamDetail(id) {
  const { data: r, error } = await supabaseClient
    .from('cbam_records')
    .select('*, trade:trades(reference), supplier:contacts(company_name)')
    .eq('id', id)
    .single();

  const el = document.getElementById(`cbam-dc-${id}`);
  if (error || !r) { el.textContent = 'Failed to load.'; return; }

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-4);margin-bottom:var(--space-4)">
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Trade Reference</div><div style="font-weight:600">${esc(r.trade?.reference || '—')}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Supplier</div><div>${esc(r.supplier?.company_name || '—')}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Product</div><div>${esc(r.product || '—')}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">CN Code</div><div>${esc(r.cn_code || '—')}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Quantity (MT)</div><div style="font-family:var(--font-display);font-weight:700">${fmt(r.quantity_mt, 0)}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Import Date</div><div>${r.import_date ? new Date(r.import_date).toLocaleDateString('en-GB') : '—'}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Embedded CO₂ (tCO₂e)</div><div style="font-family:var(--font-display);font-weight:700">${r.embedded_co2_tco2e != null ? fmt(r.embedded_co2_tco2e, 3) : '—'}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Carbon Price (EUR/t)</div><div>${r.carbon_price_eur != null ? '€' + fmt(r.carbon_price_eur) : '—'}</div></div>
    </div>
    ${r.notes ? `<div style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-3);font-size:var(--text-sm);color:var(--color-text-secondary);margin-bottom:var(--space-4)">${esc(r.notes)}</div>` : ''}
    <div style="display:flex;gap:var(--space-3);align-items:center">
      <select class="form-select" id="cbam-status-${id}" style="min-width:160px">
        ${CBAM_STATUSES.map(s => {
          const labels = { pending:'Pending', data_received:'Data Received', submitted:'Submitted', verified:'Verified' };
          return `<option value="${s}"${s===r.status?' selected':''}>${labels[s]||s}</option>`;
        }).join('')}
      </select>
      <button class="btn btn-primary btn-sm" onclick="updateCbamStatus('${esc(id)}')">Update Status</button>
    </div>
    <div id="cbam-alert-${id}" class="alert" style="display:none;margin-top:var(--space-3)"></div>`;
}

async function updateCbamStatus(id) {
  const status = document.getElementById(`cbam-status-${id}`).value;
  const alertEl = document.getElementById(`cbam-alert-${id}`);
  const { error } = await supabaseClient.from('cbam_records').update({ status }).eq('id', id);
  alertEl.style.display = 'block';
  alertEl.className = error ? 'alert alert-error' : 'alert alert-success';
  alertEl.textContent = error ? 'Update failed: ' + error.message : 'Status updated.';
  if (!error) loadCbam();
}

// ── Add form ────────────────────────────────────────────────────────────────

async function buildCbamForm(trades, suppliers) {
  const labelMap = { pending:'Pending', data_received:'Data Received', submitted:'Submitted', verified:'Verified' };
  return `
    <form id="cbam-form" onsubmit="submitCbam(event)">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Trade</label>
          <select class="form-select" id="cbam-trade">
            <option value="">— Select trade (optional) —</option>
            ${trades.map(t => `<option value="${esc(t.id)}">${esc(t.reference || t.id.slice(0,8))}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Supplier <span style="color:var(--color-danger)">*</span></label>
          <select class="form-select" id="cbam-supplier" required>
            <option value="">— Select supplier —</option>
            ${suppliers.map(c => `<option value="${esc(c.id)}">${esc(c.company_name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Product <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-input" id="cbam-product" required placeholder="e.g. Aluminium Alloy Core Wire" />
        </div>
        <div class="form-group">
          <label class="form-label">CN Code</label>
          <input type="text" class="form-input" id="cbam-cn" placeholder="e.g. 7605 19 00" />
        </div>
        <div class="form-group">
          <label class="form-label">Quantity (MT)</label>
          <input type="number" class="form-input" id="cbam-qty" step="0.001" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Import Date</label>
          <input type="date" class="form-input" id="cbam-date" />
        </div>
        <div class="form-group">
          <label class="form-label">Embedded CO₂ (tCO₂e)</label>
          <input type="number" class="form-input" id="cbam-co2" step="0.001" min="0" placeholder="From Mill Certificate" />
        </div>
        <div class="form-group">
          <label class="form-label">Carbon Price (EUR/t)</label>
          <input type="number" class="form-input" id="cbam-carbon-price" step="0.01" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" id="cbam-status-new">
            ${CBAM_STATUSES.map(s => `<option value="${s}"${s==='pending'?' selected':''}>${labelMap[s]||s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-top:var(--space-2)">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="cbam-notes-new" rows="3" placeholder="Mill Certificate reference, screening notes…"></textarea>
      </div>
      <div id="cbam-form-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Log Entry</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('new-cbam-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;
}

async function submitCbam(e) {
  e.preventDefault();
  const alertEl = document.getElementById('cbam-form-alert');

  const trade_id          = document.getElementById('cbam-trade').value || null;
  const supplier_id       = document.getElementById('cbam-supplier').value;
  const product           = document.getElementById('cbam-product').value.trim();
  const cn_code           = document.getElementById('cbam-cn').value.trim() || null;
  const quantity_mt       = parseFloat(document.getElementById('cbam-qty').value) || null;
  const import_date       = document.getElementById('cbam-date').value || null;
  const embedded_co2_tco2e = parseFloat(document.getElementById('cbam-co2').value) || null;
  const carbon_price_eur  = parseFloat(document.getElementById('cbam-carbon-price').value) || null;
  const status            = document.getElementById('cbam-status-new').value;
  const notes             = document.getElementById('cbam-notes-new').value.trim() || null;

  if (!supplier_id || !product) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Supplier and product are required.'; return;
  }

  const { error } = await supabaseClient.from('cbam_records').insert([{
    trade_id, supplier_id, product, cn_code, quantity_mt, import_date,
    embedded_co2_tco2e, carbon_price_eur, status, notes
  }]);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
  } else {
    document.getElementById('new-cbam-modal').classList.remove('open');
    loadCbam();
  }
}

// ── Init ───────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user?.email || '';

  const [{ data: trades }, { data: suppliers }] = await Promise.all([
    supabaseClient.from('trades').select('id, reference').order('created_at', { ascending: false }),
    supabaseClient.from('contacts').select('id, company_name').eq('type', 'supplier').order('company_name'),
  ]);

  const container = document.getElementById('cbam-form-container');
  if (container) container.innerHTML = await buildCbamForm(trades || [], suppliers || []);

  loadCbam();
})();
