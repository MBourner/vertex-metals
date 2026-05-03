/**
 * Vertex Metals Portal — Supplier Quotes list
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function statusBadge(status) {
  const map = { active: 'success', expired: 'neutral', used: 'info' };
  return `<span class="badge badge-${map[status] || 'neutral'}">${esc(status)}</span>`;
}

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function isExpired(validityDate) {
  if (!validityDate) return false;
  return new Date(validityDate) < new Date();
}

let _suppliers     = [];
let _productLines  = [];

// ── List ──────────────────────────────────────────────────────────────────────

async function loadQuotes() {
  const statusFilter = document.getElementById('filter-status')?.value || '';
  const tbody = document.getElementById('quotes-body');

  let query = supabaseClient
    .from('supplier_quotes')
    .select('*, contacts(company_name), product_line:product_lines(name)')
    .order('created_at', { ascending: false });

  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No quotes found.</td></tr>';
    return;
  }

  // Update column count in the loading state
  document.querySelector('#quotes-body').closest('table')
    ?.querySelector('thead tr')?.setAttribute('data-cols', '8');

  tbody.innerHTML = data.map(q => {
    const expired = isExpired(q.validity_date) && q.status === 'active';
    const rowClass = expired ? 'class="row-warning"' : '';
    const validityDisplay = q.validity_date
      ? new Date(q.validity_date).toLocaleDateString('en-GB') + (expired ? ' <span style="color:var(--color-warning);font-size:var(--text-xs)">(expired)</span>' : '')
      : '—';
    return `<tr ${rowClass} style="cursor:pointer" onclick="openQuoteDetail('${esc(q.id)}')">
      <td>${esc(q.contacts?.company_name || '—')}</td>
      <td>${esc(q.product)}</td>
      <td style="font-size:var(--text-xs);color:var(--color-text-muted)">${esc(q.product_line?.name || '—')}</td>
      <td>${esc(q.specification || '—')}</td>
      <td style="font-family:var(--font-display);font-weight:600">$${fmt(q.fob_price_usd)}</td>
      <td>${fmt(q.quantity_mt, 0)}</td>
      <td>${validityDisplay}</td>
      <td>${statusBadge(q.status)}</td>
    </tr>`;
  }).join('');
}

// ── Inline detail expand ──────────────────────────────────────────────────────

function openQuoteDetail(id) {
  const existing = document.getElementById(`detail-${id}`);
  if (existing) { existing.remove(); return; }

  const rows = document.querySelectorAll('#quotes-body tr');
  let targetRow = null;
  rows.forEach(r => {
    if (r.getAttribute('onclick') === `openQuoteDetail('${id}')`) targetRow = r;
  });
  if (!targetRow) return;

  const detailRow = document.createElement('tr');
  detailRow.id = `detail-${id}`;
  detailRow.innerHTML = `<td colspan="8" style="background:var(--color-surface);padding:var(--space-4)"><div id="detail-content-${id}" style="color:var(--color-text-muted)">Loading…</div></td>`;
  targetRow.insertAdjacentElement('afterend', detailRow);
  fetchQuoteDetail(id);
}

async function fetchQuoteDetail(id) {
  const { data: q, error } = await supabaseClient
    .from('supplier_quotes')
    .select('*, contacts(company_name, email, phone), product_line:product_lines(id,name)')
    .eq('id', id)
    .single();

  const el = document.getElementById(`detail-content-${id}`);
  if (error || !q) { el.textContent = 'Failed to load detail.'; return; }

  const plOptions = _productLines.map(pl =>
    `<option value="${esc(pl.id)}" ${q.product_line_id === pl.id ? 'selected' : ''}>${esc(pl.name)}</option>`
  ).join('');

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-4);margin-bottom:var(--space-4)">
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Supplier</div><div style="font-weight:600">${esc(q.contacts?.company_name || '—')}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Product</div><div style="font-weight:600">${esc(q.product)}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Specification</div><div>${esc(q.specification || '—')}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Incoterm</div><div>${esc(q.incoterm || 'FOB')}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">FOB Price (USD/MT)</div><div style="font-family:var(--font-display);font-weight:700;font-size:var(--text-lg)">$${fmt(q.fob_price_usd)}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Quantity (MT)</div><div style="font-family:var(--font-display);font-weight:700;font-size:var(--text-lg)">${fmt(q.quantity_mt, 0)}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Validity Date</div><div>${q.validity_date ? new Date(q.validity_date).toLocaleDateString('en-GB') : '—'}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Status</div><div>${statusBadge(q.status)}</div></div>
    </div>
    <div style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:var(--space-2)">
        <label style="font-size:var(--text-sm);color:var(--color-text-muted);white-space:nowrap">Product Line:</label>
        <select class="form-select" id="pl-select-${id}" style="min-width:200px">
          <option value="">— Not linked —</option>${plOptions}
        </select>
      </div>
      <select class="form-select" id="status-select-${id}" style="min-width:130px">
        <option value="active"  ${q.status==='active' ?'selected':''}>Active</option>
        <option value="expired" ${q.status==='expired'?'selected':''}>Expired</option>
        <option value="used"    ${q.status==='used'   ?'selected':''}>Used</option>
      </select>
      <button class="btn btn-primary btn-sm" onclick="updateQuote('${esc(id)}')">Save Changes</button>
      <a href="calculator.html" class="btn btn-secondary btn-sm">Open in Calculator →</a>
    </div>
    <div id="quote-alert-${id}" class="alert" style="display:none;margin-top:var(--space-3)"></div>`;
}

async function updateQuote(id) {
  const status  = document.getElementById(`status-select-${id}`).value;
  const plId    = document.getElementById(`pl-select-${id}`).value || null;
  const alertEl = document.getElementById(`quote-alert-${id}`);

  const { error } = await supabaseClient.from('supplier_quotes')
    .update({ status, product_line_id: plId })
    .eq('id', id);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Update failed: ' + error.message;
  } else {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-success';
    alertEl.textContent = 'Saved.';
    loadQuotes();
  }
}

// ── Add quote form ────────────────────────────────────────────────────────────

function buildAddQuoteForm() {
  const supplierOptions = _suppliers.map(s =>
    `<option value="${esc(s.id)}">${esc(s.company_name)}</option>`
  ).join('');
  const plOptions = _productLines.map(pl =>
    `<option value="${esc(pl.id)}">${esc(pl.name)}</option>`
  ).join('');

  document.getElementById('add-quote-form-container').innerHTML = `
    <form id="add-quote-form" onsubmit="submitAddQuote(event)">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Supplier <span style="color:var(--color-danger)">*</span></label>
          <select class="form-select" id="aq-supplier" required>
            <option value="">— Select supplier —</option>${supplierOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Product Line</label>
          <select class="form-select" id="aq-product-line">
            <option value="">— Not linked —</option>${plOptions}
          </select>
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">Links this quote to the pricing calculator</span>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Product Description <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-input" id="aq-product" required placeholder="e.g. Aluminium Alloy Core Wire EC Grade" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Specification</label>
          <input type="text" class="form-input" id="aq-spec" placeholder="e.g. 1350-H19, 2mm dia, reel 25kg" />
        </div>
        <div class="form-group">
          <label class="form-label">FOB Price (USD/MT) <span style="color:var(--color-danger)">*</span></label>
          <input type="number" class="form-input" id="aq-fob" required step="0.01" min="0" placeholder="e.g. 2400" />
        </div>
        <div class="form-group">
          <label class="form-label">Quantity (MT)</label>
          <input type="number" class="form-input" id="aq-qty" step="0.001" min="0" placeholder="e.g. 25" />
        </div>
        <div class="form-group">
          <label class="form-label">Incoterm</label>
          <select class="form-select" id="aq-incoterm">
            <option value="FOB">FOB</option>
            <option value="CIF">CIF</option>
            <option value="EXW">EXW</option>
            <option value="DAP">DAP</option>
            <option value="DDP">DDP</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Validity Date</label>
          <input type="date" class="form-input" id="aq-validity" />
        </div>
      </div>
      <div class="form-group" style="margin-top:var(--space-3)">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="aq-notes" rows="2"></textarea>
      </div>
      <div id="aq-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Add Quote</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('add-quote-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;
}

async function submitAddQuote(e) {
  e.preventDefault();
  const alertEl = document.getElementById('aq-alert');
  const btn     = e.target.querySelector('button[type="submit"]');
  const supplier= document.getElementById('aq-supplier').value;
  const plId    = document.getElementById('aq-product-line').value || null;
  const product = document.getElementById('aq-product').value.trim();
  const spec    = document.getElementById('aq-spec').value.trim()    || null;
  const fob     = parseFloat(document.getElementById('aq-fob').value) || null;
  const qty     = parseFloat(document.getElementById('aq-qty').value) || null;
  const inco    = document.getElementById('aq-incoterm').value       || 'FOB';
  const valid   = document.getElementById('aq-validity').value       || null;
  const notes   = document.getElementById('aq-notes').value.trim()   || null;

  if (!supplier || !product || !fob) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Supplier, product description, and FOB price are required.';
    return;
  }

  btn.disabled = true; btn.textContent = 'Saving…';

  const { error } = await supabaseClient.from('supplier_quotes').insert([{
    supplier_id:     supplier,
    product_line_id: plId,
    product,
    specification:   spec,
    fob_price_usd:   fob,
    quantity_mt:     qty,
    incoterm:        inco,
    validity_date:   valid,
    status:          'active',
    notes,
  }]);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
    btn.disabled = false; btn.textContent = 'Add Quote';
  } else {
    document.getElementById('add-quote-modal').classList.remove('open');
    buildAddQuoteForm(); // reset form
    loadQuotes();
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  document.getElementById('user-email').textContent = user?.email || '';

  const [suppRes, plRes] = await Promise.all([
    supabaseClient.from('contacts').select('id, company_name').eq('type','supplier').order('company_name'),
    supabaseClient.from('product_lines').select('id, name').eq('active', true).order('metal_family').order('name'),
  ]);

  _suppliers    = suppRes.data || [];
  _productLines = plRes.data   || [];

  buildAddQuoteForm();
  loadQuotes();
})();
