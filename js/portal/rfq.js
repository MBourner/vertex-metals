/**
 * Vertex Metals Portal — RFQ Module (list + detail, 4-tab workflow)
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmt(n, dp = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-GB') : '—'; }

function statusBadge(s) {
  const map = { new:'badge-accent', reviewing:'badge-info', quoted:'badge-warning', responded:'badge-warning', accepted:'badge-success', closed:'badge-neutral' };
  return `<span class="badge ${map[s]||'badge-neutral'}">${esc(s)}</span>`;
}
function cqStatusBadge(s) {
  const map = { draft:'badge-neutral', issued:'badge-info', sent:'badge-info', accepted:'badge-success', rejected:'badge-danger', expired:'badge-neutral' };
  return `<span class="badge ${map[s]||'badge-neutral'}">${esc(s)}</span>`;
}

function generateOrderReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `VM-${new Date().getFullYear()}-${s}`;
}
function generateQuoteReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `VM-Q-${new Date().getFullYear()}-${s}`;
}

// ── List page — New RFQ ───────────────────────────────────────────────────────

function openNewRfqModal() {
  document.getElementById('new-rfq-form')?.reset();
  const alertEl = document.getElementById('new-rfq-alert');
  if (alertEl) alertEl.style.display = 'none';
  document.getElementById('new-rfq-modal').classList.add('open');
}

async function submitNewRfq(e) {
  e.preventDefault();
  const alertEl = document.getElementById('new-rfq-alert');
  const btn     = document.getElementById('new-rfq-btn');

  const name    = document.getElementById('nrfq-name').value.trim();
  const company = document.getElementById('nrfq-company').value.trim();
  const email   = document.getElementById('nrfq-email').value.trim();

  if (!name || !company || !email) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Name, company and email are required.'; return;
  }

  btn.disabled = true; btn.textContent = 'Creating…';

  const { data, error } = await supabaseClient.from('rfq_submissions').insert([{
    name,
    company,
    email,
    phone:       document.getElementById('nrfq-phone').value.trim()   || null,
    type:        document.getElementById('nrfq-type').value           || 'buyer',
    role:        document.getElementById('nrfq-role').value.trim()    || null,
    product:     document.getElementById('nrfq-product').value.trim() || null,
    quantity_mt: parseFloat(document.getElementById('nrfq-qty').value) || null,
    country:     document.getElementById('nrfq-country').value.trim() || null,
    message:     document.getElementById('nrfq-message').value.trim() || null,
    status:      'new',
  }]).select('id').single();

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
    btn.disabled = false; btn.textContent = 'Create RFQ'; return;
  }

  // Navigate straight to the new RFQ detail page
  window.location.href = `detail.html?id=${data.id}`;
}

// ── List page ─────────────────────────────────────────────────────────────────

async function loadRfqs() {
  const status = document.getElementById('filter-status')?.value;
  const type   = document.getElementById('filter-type')?.value;
  const tbody  = document.getElementById('rfq-table-body');
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">Loading...</td></tr>`;

  let q = supabaseClient.from('rfq_submissions').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  if (type)   q = q.eq('type', type);

  const { data, error } = await q;
  if (error) { tbody.innerHTML = `<tr><td colspan="6" style="color:var(--color-danger);padding:var(--space-4)">Error: ${esc(error.message)}</td></tr>`; return; }
  if (!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No RFQs found</td></tr>`; return; }

  tbody.innerHTML = data.map(r => `
    <tr onclick="location.href='detail.html?id=${r.id}'" style="cursor:pointer">
      <td>${fmtDate(r.created_at)}</td>
      <td><strong>${esc(r.name)}</strong></td>
      <td>${esc(r.company)}</td>
      <td><span class="badge badge-neutral">${esc(r.type)}</span></td>
      <td>${esc(r.product || '—')}</td>
      <td>${statusBadge(r.status)}</td>
    </tr>`).join('');
}

// ── Detail page — shared state ────────────────────────────────────────────────

let _rfqId           = null;
let _rfqData         = null;
let _allProductLines = [];
let _activeTab       = 'enquiry';
let _quoteLines      = [];   // working copy of line items in build tab
let _activeCqId      = null; // customer_quote id being edited/built

// rfq_lines state
let _rfqLines = [];

// Pricing calculator state
let _costsSqList        = [];
let _costsLqList        = [];
let _scenarioSupplierId = null;  // selected supplier UUID for multi-line pricing
let _pricedLines        = [];    // calculated results per rfq_line
let _calc = { pl: null, sqData: null, lqData: null, overheadTotal: 0, qty: 0, fx: 1.27, minMargin: 5, model: 'standard' };
let _calcApplied = null; // pre-fill data passed to renderBuildTab (object OR array)

// ── Tab management ────────────────────────────────────────────────────────────

function switchTab(name) {
  _activeTab = name;
  document.querySelectorAll('.tab-btn').forEach((btn, i) => {
    const tabs = ['enquiry','costs','build','customer'];
    btn.classList.toggle('active', tabs[i] === name);
  });
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${name}`)?.classList.add('active');

  if (name === 'costs')    renderCostsTab();
  if (name === 'build')    renderBuildTab();
  if (name === 'customer') renderCustomerTab();
}

// ── Detail page — init ────────────────────────────────────────────────────────

async function loadRfqDetail() {
  _rfqId = new URLSearchParams(window.location.search).get('id');
  if (!_rfqId) { document.getElementById('rfq-detail').innerHTML = '<div class="alert alert-error">No ID provided</div>'; return; }

  const [{ data, error }, { data: pls }, { data: lines }] = await Promise.all([
    supabaseClient.from('rfq_submissions').select('*').eq('id', _rfqId).single(),
    supabaseClient.from('product_lines').select('id,name,cn_code,standard_sell_price_gbp,market_reference_price_gbp,default_markup_pct,vat_rate,insurance_pct').eq('active', true).order('name'),
    supabaseClient.from('rfq_lines').select('*, product_lines(name)').eq('rfq_id', _rfqId).order('line_number'),
  ]);

  if (error || !data) { document.getElementById('rfq-detail').innerHTML = '<div class="alert alert-error">Record not found</div>'; return; }
  _rfqData         = data;
  _allProductLines = pls || [];
  _rfqLines        = lines || [];

  document.getElementById('rfq-title').textContent = `${data.company} — ${fmtDate(data.created_at)}`;

  // Update quote request PDF links
  const sqBtn = document.getElementById('supplier-quote-request-btn');
  const lqBtn = document.getElementById('logistics-quote-request-btn');
  if (sqBtn) sqBtn.href = `quote-request.html?rfq=${_rfqId}&type=supplier`;
  if (lqBtn) lqBtn.href = `quote-request.html?rfq=${_rfqId}&type=logistics`;

  renderEnquiryTab();
}

// ── Tab 1: Enquiry ────────────────────────────────────────────────────────────

function scorePlMatch(plName, productText) {
  const words = productText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  return words.filter(w => plName.toLowerCase().includes(w)).length;
}

async function renderEnquiryTab() {
  const data = _rfqData;
  const productText = (data.product || '').toLowerCase();
  const matchedPl   = productText
    ? _allProductLines.reduce((best, pl) => {
        const score = scorePlMatch(pl.name, productText);
        return score > (best?._score ?? 0) ? { ...pl, _score: score } : best;
      }, null)
    : null;
  const validMatch = matchedPl && matchedPl._score > 0 ? matchedPl : null;

  const el = document.getElementById('rfq-detail');
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6);margin-bottom:var(--space-8)">
      ${field('Name', data.name)}${field('Company', data.company)}
      ${field('Role', data.role)}${field('Email', `<a href="mailto:${esc(data.email)}" style="color:var(--color-accent)">${esc(data.email)}</a>`)}
      ${field('Phone', data.phone)}${field('Type', data.type)}
      ${field('Product interest', data.product)}${field('Estimated quantity', data.quantity_mt != null ? fmt(data.quantity_mt, 0) + ' ' + (data.quantity_unit || 'MT') : null)}
      ${field('Country', data.country)}
    </div>
    ${data.specifications ? `
    <div style="margin-bottom:var(--space-6)">
      <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-2)">Specification / Requirements</p>
      <p style="font-size:var(--text-sm);background:var(--color-surface);border-radius:var(--radius);padding:var(--space-3) var(--space-4);white-space:pre-wrap">${esc(data.specifications)}</p>
    </div>` : ''}

    <div style="margin-bottom:var(--space-8)"><strong>Message:</strong><p style="margin-top:var(--space-2);white-space:pre-wrap">${esc(data.message)}</p></div>

    <div style="display:flex;gap:var(--space-4);align-items:flex-end;flex-wrap:wrap;margin-bottom:var(--space-8)">
      <div class="form-group" style="min-width:200px">
        <label class="form-label">Update Status</label>
        <select class="form-select" id="status-select" onchange="updateStatus('${esc(_rfqId)}', this.value)">
          ${['new','reviewing','quoted','responded','closed'].map(s => `<option value="${s}" ${s===data.status?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <a href="../contacts/index.html?prefill=1&name=${encodeURIComponent(data.name)}&company=${encodeURIComponent(data.company)}&email=${encodeURIComponent(data.email)}&phone=${encodeURIComponent(data.phone||'')}&type=${encodeURIComponent(data.type)}"
         class="btn btn-secondary btn-sm">+ Create Contact</a>
      <button class="btn btn-primary btn-sm" onclick="switchTab('build')">Build Customer Quote →</button>
    </div>

    ${validMatch ? `
    <div style="background:#0a1728;border-radius:var(--radius);padding:var(--space-4);margin-bottom:var(--space-6);display:flex;gap:var(--space-6);flex-wrap:wrap;align-items:center">
      <div>
        <div style="font-size:var(--text-xs);color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-1)">Matched product</div>
        <div style="color:#ffffff;font-weight:600">${esc(validMatch.name)}</div>
      </div>
      <div>
        <div style="font-size:var(--text-xs);color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-1)">Standard price</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:#7ab8d4">${validMatch.standard_sell_price_gbp ? `£${fmt(validMatch.standard_sell_price_gbp)}/MT` : 'Not set'}</div>
      </div>
      ${validMatch.market_reference_price_gbp ? `
      <div>
        <div style="font-size:var(--text-xs);color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-1)">Market ref</div>
        <div style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:600;color:#ffffff">£${fmt(validMatch.market_reference_price_gbp)}/MT</div>
      </div>` : ''}
      <div>
        <div style="font-size:var(--text-xs);color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-1)">Default markup</div>
        <div style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:600;color:#ffffff">${validMatch.default_markup_pct != null ? fmt(validMatch.default_markup_pct, 1) + '%' : '—'}</div>
      </div>
      <a href="../quotes/calculator.html" style="margin-left:auto;display:inline-flex;align-items:center;gap:4px;padding:6px 14px;border:1px solid rgba(255,255,255,.5);border-radius:var(--radius-sm);color:#ffffff;font-size:var(--text-sm);font-weight:500;text-decoration:none;background:rgba(255,255,255,.1)">Open Calculator →</a>
    </div>` : ''}

    <div>
      <label class="form-label">Internal Notes</label>
      <textarea class="form-textarea" id="notes-field" onblur="saveNotes('${esc(_rfqId)}')" placeholder="Add notes...">${esc(data.notes||'')}</textarea>
      <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-2)">Notes auto-save on blur.</p>
    </div>
  `;

  // Load rfq_lines section
  await loadRfqLines();
}

// ── Tab 1: RFQ Lines ─────────────────────────────────────────────────────────

const QUANTITY_UNITS = ['MT', 'kg', 'pieces', 'm', 'm²'];

async function loadRfqLines() {
  const { data, error } = await supabaseClient
    .from('rfq_lines')
    .select('*, product_lines(name)')
    .eq('rfq_id', _rfqId)
    .order('line_number');

  if (!error) _rfqLines = data || [];

  // Auto-create Line 1 from RFQ data if no lines exist
  if (_rfqLines.length === 0 && (_rfqData?.product || _rfqData?.product_line_id)) {
    await autoCreateInitialLine();
  } else {
    renderRfqLinesSection(_rfqLines);
  }
}

async function autoCreateInitialLine() {
  const { data, error } = await supabaseClient.from('rfq_lines').insert([{
    rfq_id:             _rfqId,
    line_number:        1,
    product_line_id:    _rfqData.product_line_id || null,
    description:        _rfqData.product || '',
    grade_specification: _rfqData.specifications || null,
    quantity:           _rfqData.quantity_mt || null,
    quantity_unit:      _rfqData.quantity_unit || 'MT',
    is_alternative:     false,
    source:             'initial_enquiry',
  }]).select('*, product_lines(name)').single();

  if (!error && data) _rfqLines = [data];
  renderRfqLinesSection(_rfqLines);
}

function renderRfqLinesSection(lines) {
  const el = document.getElementById('rfq-lines-section');
  if (!el) return;

  const noLines = !lines || lines.length === 0;
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4)">
      <div>
        <h4 style="margin:0">Quote Lines</h4>
        <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-1)">Define all items to quote on before requesting supplier prices.</p>
      </div>
      <div style="display:flex;gap:var(--space-2)">
        <button class="btn btn-primary btn-sm" onclick="openAddRfqLineModal(false)">+ Add Line</button>
        <button class="btn btn-secondary btn-sm" onclick="openAddRfqLineModal(true)">+ Add Alternative</button>
      </div>
    </div>
    ${noLines ? `
      <div style="padding:var(--space-6);text-align:center;color:var(--color-text-muted);font-size:var(--text-sm);background:var(--color-surface);border-radius:var(--radius)">
        No lines defined. Add lines above before requesting supplier quotes.
      </div>` : `
      <div class="table-wrapper" style="margin:0"><table>
        <thead><tr>
          <th style="width:40px">#</th>
          <th>Product Line</th>
          <th>Description</th>
          <th>Grade / Spec</th>
          <th>Qty</th>
          <th>Unit</th>
          <th style="width:80px">Type</th>
          <th></th>
        </tr></thead>
        <tbody>${lines.map(l => `<tr>
          <td style="font-weight:600;color:var(--color-text-muted)">${l.line_number}</td>
          <td style="font-size:var(--text-sm)">${esc(l.product_lines?.name || '—')}</td>
          <td style="font-weight:500">${esc(l.description)}</td>
          <td style="font-size:var(--text-sm);color:var(--color-text-muted)">${esc(l.grade_specification || '—')}</td>
          <td>${l.quantity != null ? fmt(l.quantity, l.quantity_unit === 'MT' ? 3 : 0) : '—'}</td>
          <td>${esc(l.quantity_unit || 'MT')}</td>
          <td>${l.is_alternative
            ? `<span class="badge badge-info">Alt</span>`
            : `<span class="badge badge-neutral">Primary</span>`}
          </td>
          <td style="white-space:nowrap">
            <button onclick="openEditRfqLineModal('${esc(l.id)}')" class="btn btn-ghost btn-sm" style="color:var(--color-text-muted)">Edit</button>
            <button onclick="deleteRfqLine('${esc(l.id)}')" class="btn btn-ghost btn-sm" style="color:var(--color-danger)">Delete</button>
          </td>
        </tr>`).join('')}</tbody>
      </table></div>`}
  `;
}

function rfqLineFormHtml(l = {}, formId, isAlt = false) {
  const plOpts = _allProductLines.map(pl =>
    `<option value="${esc(pl.id)}" ${pl.id === (l.product_line_id || '') ? 'selected' : ''}>${esc(pl.name)}</option>`
  ).join('');
  const isAlternative = l.is_alternative !== undefined ? l.is_alternative : isAlt;
  return `
    <form id="${formId}" onsubmit="return false">
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Product Line</label>
          <select class="form-select" id="${formId}-pl">
            <option value="">— Select product line —</option>${plOpts}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Description <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-input" id="${formId}-desc" value="${esc(l.description || '')}" required placeholder="e.g. Stainless Steel Bar & Rod" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Grade / Specification</label>
          <input type="text" class="form-input" id="${formId}-grade" value="${esc(l.grade_specification || '')}" placeholder="e.g. 316/316L, EN 10088" />
        </div>
        <div class="form-group">
          <label class="form-label">Quantity</label>
          <input type="number" class="form-input" id="${formId}-qty" value="${l.quantity || ''}" step="any" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Unit</label>
          <select class="form-select" id="${formId}-unit">
            ${QUANTITY_UNITS.map(u => `<option value="${u}" ${u === (l.quantity_unit || 'MT') ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;font-size:var(--text-sm)">
            <input type="checkbox" id="${formId}-isalt" ${isAlternative ? 'checked' : ''} onchange="document.getElementById('${formId}-altreason-group').style.display=this.checked?'':'none'" />
            This is an alternative line (supplier-suggested substitute)
          </label>
        </div>
        <div class="form-group" id="${formId}-altreason-group" style="grid-column:1/-1;${isAlternative ? '' : 'display:none'}">
          <label class="form-label">Alternative Reason</label>
          <input type="text" class="form-input" id="${formId}-altreason" value="${esc(l.alt_reason || '')}" placeholder="e.g. 316Ti offered as alternative — shorter lead time" />
        </div>
      </div>
      <div id="${formId}-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
    </form>`;
}

function openAddRfqLineModal(isAlt = false) {
  const nextNum = (_rfqLines.length > 0 ? Math.max(..._rfqLines.map(l => l.line_number)) : 0) + 1;
  showDynModal('add-rfqline-modal', isAlt ? 'Add Alternative Line' : 'Add Quote Line', `
    ${rfqLineFormHtml({}, 'add-rfqline-form', isAlt)}
    <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
      <button class="btn btn-primary" id="add-rfqline-btn" onclick="submitAddRfqLine(${nextNum})">Add Line</button>
      <button class="btn btn-ghost" onclick="closeDynModal('add-rfqline-modal')">Cancel</button>
    </div>`);
}

async function submitAddRfqLine(lineNum) {
  const alertEl = document.getElementById('add-rfqline-form-alert');
  const btn     = document.getElementById('add-rfqline-btn');
  const desc    = document.getElementById('add-rfqline-form-desc').value.trim();
  if (!desc) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent='Description is required.'; return;
  }
  btn.disabled = true; btn.textContent = 'Saving…';
  const payload = rfqLinePayload('add-rfqline-form', lineNum);
  const { data, error } = await supabaseClient.from('rfq_lines').insert([payload]).select('*, product_lines(name)').single();
  if (error) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent = error.message; btn.disabled=false; btn.textContent='Add Line'; return;
  }
  _rfqLines.push(data);
  closeDynModal('add-rfqline-modal');
  renderRfqLinesSection(_rfqLines);
}

async function openEditRfqLineModal(id) {
  const line = _rfqLines.find(l => l.id === id);
  if (!line) return;
  showDynModal('edit-rfqline-modal', 'Edit Line', `
    ${rfqLineFormHtml(line, 'edit-rfqline-form')}
    <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
      <button class="btn btn-primary" id="edit-rfqline-btn" onclick="submitEditRfqLine('${esc(id)}', ${line.line_number})">Save Changes</button>
      <button class="btn btn-ghost" onclick="closeDynModal('edit-rfqline-modal')">Cancel</button>
    </div>`);
}

async function submitEditRfqLine(id, lineNum) {
  const alertEl = document.getElementById('edit-rfqline-form-alert');
  const btn     = document.getElementById('edit-rfqline-btn');
  const desc    = document.getElementById('edit-rfqline-form-desc').value.trim();
  if (!desc) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent='Description is required.'; return;
  }
  btn.disabled = true; btn.textContent = 'Saving…';
  const payload = rfqLinePayload('edit-rfqline-form', lineNum);
  const { data, error } = await supabaseClient.from('rfq_lines').update(payload).eq('id', id).select('*, product_lines(name)').single();
  if (error) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent = error.message; btn.disabled=false; btn.textContent='Save Changes'; return;
  }
  _rfqLines = _rfqLines.map(l => l.id === id ? data : l);
  closeDynModal('edit-rfqline-modal');
  renderRfqLinesSection(_rfqLines);
}

async function deleteRfqLine(id) {
  if (_rfqLines.length <= 1) { alert('Cannot delete the last line. Edit it instead.'); return; }
  if (!confirm('Delete this line?')) return;
  await supabaseClient.from('rfq_lines').delete().eq('id', id);
  _rfqLines = _rfqLines.filter(l => l.id !== id);
  // Re-number
  _rfqLines.forEach((l, i) => { l.line_number = i + 1; });
  renderRfqLinesSection(_rfqLines);
}

function rfqLinePayload(formId, lineNum) {
  return {
    rfq_id:             _rfqId,
    line_number:        lineNum,
    product_line_id:    document.getElementById(`${formId}-pl`)?.value || null,
    description:        document.getElementById(`${formId}-desc`)?.value.trim(),
    grade_specification: document.getElementById(`${formId}-grade`)?.value.trim() || null,
    quantity:           parseFloat(document.getElementById(`${formId}-qty`)?.value) || null,
    quantity_unit:      document.getElementById(`${formId}-unit`)?.value || 'MT',
    is_alternative:     document.getElementById(`${formId}-isalt`)?.checked || false,
    alt_reason:         document.getElementById(`${formId}-altreason`)?.value.trim() || null,
  };
}

// ── Tab 2: Cost Inputs ────────────────────────────────────────────────────────

async function renderCostsTab() {
  // Ensure rfq_lines are loaded (may not be if user jumped directly to this tab)
  if (_rfqLines.length === 0) {
    const { data } = await supabaseClient.from('rfq_lines').select('*, product_lines(name)').eq('rfq_id', _rfqId).order('line_number');
    _rfqLines = data || [];
  }

  const [sqRes, lqRes, ohRes] = await Promise.all([
    supabaseClient.from('supplier_quotes')
      .select('id,rfq_line_id,supplier_id,product,specification,pricing_basis,fob_price_usd,price_per_piece,quantity_pieces,quantity_mt,incoterm,validity_date,status,document_path,contacts(company_name)')
      .eq('rfq_id', _rfqId).order('created_at', { ascending: false }),
    supabaseClient.from('logistics_quotes')
      .select('id,origin_country,destination_country,mode,pricing_type,price_per_mt_usd,price_flat_gbp,validity_date,status,document_path,contacts(company_name)')
      .eq('rfq_id', _rfqId).order('created_at', { ascending: false }),
    supabaseClient.from('rfq_overhead_costs')
      .select('*').eq('rfq_id', _rfqId).order('created_at'),
  ]);

  if (sqRes.error?.message?.includes('rfq_id') || lqRes.error?.message?.includes('rfq_id')) {
    const msg = `<div class="alert alert-error" style="margin-bottom:var(--space-4)">
      Database migration not yet applied. Please run <strong>docs/migrations/phase-6-rfq-quoting.sql</strong> in Supabase before using this tab.
    </div>`;
    document.getElementById('supplier-quotes-section').innerHTML = msg;
    document.getElementById('logistics-quotes-section').innerHTML = '';
    document.getElementById('overhead-costs-section').innerHTML  = '';
    return;
  }

  _costsSqList = sqRes.data || [];
  _costsLqList = lqRes.data || [];

  renderSupplierQuotesSection(_costsSqList);
  renderLogisticsQuotesSection(_costsLqList);
  renderOverheadCostsSection(ohRes.data || []);
  renderPricingCalculator(_costsSqList, _costsLqList, ohRes.data || []);
}

function renderSupplierQuotesSection(quotes) {
  const el = document.getElementById('supplier-quotes-section');
  if (!quotes.length) {
    el.innerHTML = `<div style="color:var(--color-text-muted);font-size:var(--text-sm);padding:var(--space-3) 0">No supplier quotes linked yet.</div>`;
    return;
  }

  // Group by supplier (scenario grouping)
  const groups = {};
  quotes.forEach(q => {
    const name = q.contacts?.company_name || 'Unknown Supplier';
    const sid  = q.supplier_id || 'unknown';
    if (!groups[sid]) groups[sid] = { name, quotes: [] };
    groups[sid].quotes.push(q);
  });

  el.innerHTML = Object.entries(groups).map(([sid, group]) => {
    const rows = group.quotes.map(q => {
      const lineRef = q.rfq_line_id ? _rfqLines.find(l => l.id === q.rfq_line_id) : null;
      const priceDisplay = q.pricing_basis === 'per_piece'
        ? `$${fmt(q.price_per_piece, 4)}/pc`
        : q.pricing_basis === 'total'
          ? `$${fmt(q.fob_price_usd)} total`
          : `$${fmt(q.fob_price_usd)}/MT`;
      return `<tr>
        <td style="font-size:var(--text-xs);color:var(--color-text-muted)">${lineRef ? `Line ${lineRef.line_number}${lineRef.is_alternative ? ' (alt)' : ''}` : '—'}</td>
        <td>${esc(q.product)}</td>
        <td style="font-size:var(--text-sm)">${esc(q.specification || '—')}</td>
        <td style="font-family:var(--font-display);font-weight:600">${priceDisplay}</td>
        <td>${fmtDate(q.validity_date)}</td>
        <td><span class="badge badge-${q.status==='active'?'success':'neutral'}">${esc(q.status)}</span></td>
        <td>${q.document_path ? `<button onclick="downloadDoc('supplier_quotes','${esc(q.document_path)}')" class="btn btn-ghost btn-sm">Download</button>` : '<span style="color:var(--color-text-muted);font-size:var(--text-xs)">—</span>'}</td>
      </tr>`;
    }).join('');

    return `<div style="border:1px solid var(--color-border);border-radius:var(--radius);margin-bottom:var(--space-4);overflow:hidden">
      <div style="background:var(--color-surface);padding:var(--space-3) var(--space-4);display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="font-weight:600;font-size:var(--text-sm)">${esc(group.name)}</span>
          <span style="font-size:var(--text-xs);color:var(--color-text-muted);margin-left:var(--space-2)">${group.quotes.length} line${group.quotes.length !== 1 ? 's' : ''} quoted</span>
        </div>
      </div>
      <div class="table-wrapper" style="margin:0"><table>
        <thead><tr><th>Line</th><th>Product</th><th>Spec/Grade</th><th>Price</th><th>Validity</th><th>Status</th><th>Doc</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  }).join('');
}

function renderLogisticsQuotesSection(quotes) {
  const el = document.getElementById('logistics-quotes-section');
  if (!quotes.length) {
    el.innerHTML = `<div style="color:var(--color-text-muted);font-size:var(--text-sm);padding:var(--space-3) 0">No logistics quotes linked yet.</div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrapper" style="margin:0"><table>
    <thead><tr><th>Provider</th><th>Route</th><th>Mode</th><th>Pricing</th><th>Price</th><th>Validity</th><th>Status</th><th>Doc</th></tr></thead>
    <tbody>${quotes.map(q => {
      const isFlat = q.pricing_type === 'flat';
      const price  = isFlat ? `£${fmt(q.price_flat_gbp)} flat` : `$${fmt(q.price_per_mt_usd)}/MT`;
      return `<tr>
        <td>${esc(q.contacts?.company_name || '—')}</td>
        <td>${esc([q.origin_country, q.destination_country].filter(Boolean).join(' → '))}</td>
        <td>${esc(q.mode || '—')}</td>
        <td><span class="badge badge-neutral">${isFlat ? 'Flat' : 'Per MT'}</span></td>
        <td style="font-family:var(--font-display);font-weight:600">${price}</td>
        <td>${fmtDate(q.validity_date)}</td>
        <td><span class="badge badge-${q.status==='active'?'success':'neutral'}">${esc(q.status)}</span></td>
        <td>${q.document_path ? `<button onclick="downloadDoc('logistics_quotes','${esc(q.document_path)}')" class="btn btn-ghost btn-sm">Download</button>` : '<span style="color:var(--color-text-muted);font-size:var(--text-xs)">None</span>'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function renderOverheadCostsSection(costs) {
  const el = document.getElementById('overhead-costs-section');
  if (!costs.length) {
    el.innerHTML = `<div style="color:var(--color-text-muted);font-size:var(--text-sm);padding:var(--space-3) 0">No additional costs added yet.</div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrapper" style="margin:0"><table>
    <thead><tr><th>Description</th><th>Amount (£)</th><th>Notes</th><th></th></tr></thead>
    <tbody>${costs.map(c => `<tr>
      <td>${esc(c.description)}</td>
      <td style="font-family:var(--font-display);font-weight:600">£${fmt(c.amount_gbp)}</td>
      <td style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(c.notes || '—')}</td>
      <td><button onclick="deleteOverhead('${esc(c.id)}')" class="btn btn-ghost btn-sm" style="color:var(--color-danger)">Remove</button></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

// ── Tab 2: Add Supplier Quote modal ──────────────────────────────────────────

async function openAddSupplierQuoteModal() {
  const { data: suppliers } = await supabaseClient.from('contacts').select('id,company_name').eq('type','supplier').order('company_name');
  const supplierOpts = (suppliers||[]).map(s => `<option value="${esc(s.id)}">${esc(s.company_name)}</option>`).join('');
  const lineOpts = _rfqLines.map(l =>
    `<option value="${esc(l.id)}">Line ${l.line_number}${l.is_alternative ? ' (alt)' : ''} — ${esc(l.description)}</option>`
  ).join('');

  showDynModal('add-sq-modal', 'Add Supplier Quote', `
    <form id="add-sq-form" onsubmit="submitAddSupplierQuote(event)">
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Supplier <span style="color:var(--color-danger)">*</span></label>
          <select class="form-select" id="sq-supplier" required><option value="">— Select supplier —</option>${supplierOpts}</select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Quote Line <span style="color:var(--color-danger)">*</span></label>
          <select class="form-select" id="sq-line" required onchange="prefillSqFromLine(this.value)">
            <option value="">— Which line is this quote for? —</option>${lineOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Product <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-input" id="sq-product" value="${esc(_rfqData?.product||'')}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Grade / Specification</label>
          <input type="text" class="form-input" id="sq-spec" placeholder="e.g. 316/316L, EN 10088" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Pricing Basis <span style="color:var(--color-danger)">*</span></label>
          <div style="display:flex;gap:var(--space-4);margin-top:var(--space-2)">
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer">
              <input type="radio" name="sq-basis" value="per_mt" checked onchange="toggleSqPricingBasis('per_mt')" /> Per MT (USD)
            </label>
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer">
              <input type="radio" name="sq-basis" value="per_piece" onchange="toggleSqPricingBasis('per_piece')" /> Per Piece
            </label>
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer">
              <input type="radio" name="sq-basis" value="total" onchange="toggleSqPricingBasis('total')" /> Total Price
            </label>
          </div>
        </div>
        <div class="form-group" id="sq-price-permt-group">
          <label class="form-label">FOB Price (USD/MT) <span style="color:var(--color-danger)">*</span></label>
          <input type="number" class="form-input" id="sq-price" step="0.01" min="0" />
        </div>
        <div class="form-group" id="sq-price-perpiece-group" style="display:none">
          <label class="form-label">Price per Piece (USD) <span style="color:var(--color-danger)">*</span></label>
          <input type="number" class="form-input" id="sq-price-piece" step="0.0001" min="0" />
        </div>
        <div class="form-group" id="sq-qty-pieces-group" style="display:none">
          <label class="form-label">Quantity (pieces)</label>
          <input type="number" class="form-input" id="sq-qty-pieces" step="1" min="0" />
        </div>
        <div class="form-group" id="sq-qty-mt-group">
          <label class="form-label">Quantity (MT)</label>
          <input type="number" class="form-input" id="sq-qty" step="0.1" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Incoterm</label>
          <select class="form-select" id="sq-incoterm">
            <option value="FOB">FOB</option><option value="CIF">CIF</option><option value="EXW">EXW</option><option value="DAP">DAP</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Valid Until</label>
          <input type="date" class="form-input" id="sq-validity" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Upload Received Quote (PDF)</label>
          <input type="file" class="form-input" id="sq-file" accept=".pdf,.doc,.docx,.jpg,.png" />
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">Optional — stores to rfq-documents bucket</span>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="sq-notes" rows="2"></textarea>
      </div>
      <div id="add-sq-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary" id="add-sq-btn">Add Quote</button>
        <button type="button" class="btn btn-ghost" onclick="closeDynModal('add-sq-modal')">Cancel</button>
      </div>
    </form>`);
}

function toggleSqPricingBasis(basis) {
  document.getElementById('sq-price-permt-group').style.display    = basis === 'per_mt' || basis === 'total' ? '' : 'none';
  document.getElementById('sq-price-perpiece-group').style.display = basis === 'per_piece' ? '' : 'none';
  document.getElementById('sq-qty-pieces-group').style.display     = basis === 'per_piece' ? '' : 'none';
  document.getElementById('sq-qty-mt-group').style.display         = basis !== 'per_piece' ? '' : 'none';
  const priceLabel = document.querySelector('#sq-price-permt-group .form-label');
  if (priceLabel) priceLabel.childNodes[0].textContent = basis === 'total' ? 'Total FOB (USD) ' : 'FOB Price (USD/MT) ';
}

function prefillSqFromLine(lineId) {
  const line = _rfqLines.find(l => l.id === lineId);
  if (!line) return;
  const productEl = document.getElementById('sq-product');
  const specEl    = document.getElementById('sq-spec');
  const qtyEl     = document.getElementById('sq-qty');
  if (productEl && !productEl.value) productEl.value = line.description || '';
  if (specEl && !specEl.value)       specEl.value    = line.grade_specification || '';
  if (qtyEl && !qtyEl.value && line.quantity_unit === 'MT') qtyEl.value = line.quantity || '';
}

async function submitAddSupplierQuote(e) {
  e.preventDefault();
  const alertEl   = document.getElementById('add-sq-alert');
  const btn       = document.getElementById('add-sq-btn');
  const supplier  = document.getElementById('sq-supplier').value;
  const lineId    = document.getElementById('sq-line').value || null;
  const product   = document.getElementById('sq-product').value.trim();
  const spec      = document.getElementById('sq-spec').value.trim() || null;
  const basis     = document.querySelector('input[name="sq-basis"]:checked')?.value || 'per_mt';
  const price     = parseFloat(document.getElementById('sq-price').value)       || null;
  const pricePerPiece = parseFloat(document.getElementById('sq-price-piece')?.value) || null;
  const qtyPieces = parseInt(document.getElementById('sq-qty-pieces')?.value)   || null;
  const qty       = parseFloat(document.getElementById('sq-qty').value)         || null;
  const incoterm  = document.getElementById('sq-incoterm').value;
  const validity  = document.getElementById('sq-validity').value || null;
  const notes     = document.getElementById('sq-notes').value.trim() || null;
  const file      = document.getElementById('sq-file').files[0];

  const priceOk = basis === 'per_piece' ? !!pricePerPiece : !!price;
  if (!supplier || !product || !priceOk || !lineId) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent='Supplier, quote line, product, and price are required.'; return;
  }

  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    let document_path = null;
    if (file) document_path = await uploadQuoteDocument(file, 'supplier');

    const { error } = await supabaseClient.from('supplier_quotes').insert([{
      rfq_id: _rfqId, rfq_line_id: lineId, supplier_id: supplier,
      product, specification: spec,
      pricing_basis: basis,
      fob_price_usd: basis !== 'per_piece' ? price : null,
      price_per_piece: basis === 'per_piece' ? pricePerPiece : null,
      quantity_pieces: basis === 'per_piece' ? qtyPieces : null,
      quantity_mt: basis !== 'per_piece' ? qty : null,
      incoterm, validity_date: validity,
      status: 'active', notes, document_path,
    }]);
    if (error) throw new Error(error.message);

    closeDynModal('add-sq-modal');
    renderCostsTab();
  } catch (err) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent = err.message;
    btn.disabled = false; btn.textContent = 'Add Quote';
  }
}

// ── Tab 2: Add Logistics Quote modal ─────────────────────────────────────────

async function openAddLogisticsQuoteModal() {
  const { data: providers } = await supabaseClient.from('contacts').select('id,company_name').eq('type','logistics').order('company_name');
  const opts = (providers||[]).map(p => `<option value="${esc(p.id)}">${esc(p.company_name)}</option>`).join('');

  showDynModal('add-lq-modal', 'Add Logistics Quote', `
    <form id="add-lq-form" onsubmit="submitAddLogisticsQuote(event)">
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Provider <span style="color:var(--color-danger)">*</span></label>
          <select class="form-select" id="lq-provider" required><option value="">— Select provider —</option>${opts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Origin Country</label>
          <input type="text" class="form-input" id="lq-origin" value="${esc(_rfqData?.country||'India')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Destination Country</label>
          <input type="text" class="form-input" id="lq-dest" value="United Kingdom" />
        </div>
        <div class="form-group">
          <label class="form-label">Origin Port</label>
          <input type="text" class="form-input" id="lq-origin-port" placeholder="e.g. Nhava Sheva" />
        </div>
        <div class="form-group">
          <label class="form-label">Destination Port</label>
          <input type="text" class="form-input" id="lq-dest-port" placeholder="e.g. Felixstowe" />
        </div>
        <div class="form-group">
          <label class="form-label">Mode</label>
          <select class="form-select" id="lq-mode">
            <option value="sea">Sea</option><option value="air">Air</option><option value="road">Road</option><option value="rail">Rail</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Container Type</label>
          <input type="text" class="form-input" id="lq-container" placeholder="e.g. 20ft, 40ft HC" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Pricing Type <span style="color:var(--color-danger)">*</span></label>
          <div style="display:flex;gap:var(--space-4);margin-top:var(--space-2)">
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer">
              <input type="radio" name="lq-pricing" value="per_mt" checked onchange="toggleLqPricing(this.value)" /> Per MT (USD)
            </label>
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer">
              <input type="radio" name="lq-pricing" value="flat" onchange="toggleLqPricing(this.value)" /> Flat fee (GBP)
            </label>
          </div>
        </div>
        <div class="form-group" id="lq-price-permt-group">
          <label class="form-label" id="lq-price-label">Price (USD/MT) <span style="color:var(--color-danger)">*</span></label>
          <input type="number" class="form-input" id="lq-price-permt" step="0.01" min="0" />
        </div>
        <div class="form-group" id="lq-price-flat-group" style="display:none">
          <label class="form-label">Flat Fee (GBP) <span style="color:var(--color-danger)">*</span></label>
          <input type="number" class="form-input" id="lq-price-flat" step="0.01" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Valid Until</label>
          <input type="date" class="form-input" id="lq-validity" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Upload Received Quote (PDF)</label>
          <input type="file" class="form-input" id="lq-file" accept=".pdf,.doc,.docx,.jpg,.png" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="lq-notes" rows="2"></textarea>
      </div>
      <div id="add-lq-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary" id="add-lq-btn">Add Quote</button>
        <button type="button" class="btn btn-ghost" onclick="closeDynModal('add-lq-modal')">Cancel</button>
      </div>
    </form>`);
}

function toggleLqPricing(val) {
  document.getElementById('lq-price-permt-group').style.display = val === 'per_mt' ? '' : 'none';
  document.getElementById('lq-price-flat-group').style.display  = val === 'flat'   ? '' : 'none';
}

async function submitAddLogisticsQuote(e) {
  e.preventDefault();
  const alertEl    = document.getElementById('add-lq-alert');
  const btn        = document.getElementById('add-lq-btn');
  const provider   = document.getElementById('lq-provider').value;
  const pricingType = document.querySelector('input[name="lq-pricing"]:checked')?.value || 'per_mt';
  const pricePerMt  = parseFloat(document.getElementById('lq-price-permt').value) || null;
  const priceFlat   = parseFloat(document.getElementById('lq-price-flat').value)  || null;
  const validity    = document.getElementById('lq-validity').value || null;
  const file        = document.getElementById('lq-file').files[0];

  if (!provider) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent='Provider is required.'; return;
  }
  if (pricingType === 'per_mt' && !pricePerMt) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent='Price per MT is required.'; return;
  }
  if (pricingType === 'flat' && !priceFlat) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent='Flat fee is required.'; return;
  }

  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    let document_path = null;
    if (file) document_path = await uploadQuoteDocument(file, 'logistics');

    const { error } = await supabaseClient.from('logistics_quotes').insert([{
      rfq_id:             _rfqId,
      provider_id:        provider,
      origin_country:     document.getElementById('lq-origin').value.trim() || null,
      destination_country: document.getElementById('lq-dest').value.trim() || null,
      origin_port:        document.getElementById('lq-origin-port').value.trim() || null,
      destination_port:   document.getElementById('lq-dest-port').value.trim() || null,
      mode:               document.getElementById('lq-mode').value,
      container_type:     document.getElementById('lq-container').value.trim() || null,
      pricing_type:       pricingType,
      price_per_mt_usd:   pricingType === 'per_mt' ? pricePerMt : null,
      price_flat_gbp:     pricingType === 'flat'   ? priceFlat  : null,
      validity_date:      validity,
      status:             'active',
      notes:              document.getElementById('lq-notes').value.trim() || null,
      document_path,
    }]);
    if (error) throw new Error(error.message);

    closeDynModal('add-lq-modal');
    renderCostsTab();
  } catch (err) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent = err.message;
    btn.disabled = false; btn.textContent = 'Add Quote';
  }
}

// ── Tab 2: Overhead costs modal ───────────────────────────────────────────────

function openAddOverheadModal() {
  showDynModal('add-oh-modal', 'Add Cost', `
    <form id="add-oh-form" onsubmit="submitAddOverhead(event)">
      <div class="form-group">
        <label class="form-label">Description <span style="color:var(--color-danger)">*</span></label>
        <input type="text" class="form-input" id="oh-desc" required placeholder="e.g. Import duty, Customs handling" />
      </div>
      <div class="form-group">
        <label class="form-label">Amount (£) <span style="color:var(--color-danger)">*</span></label>
        <input type="number" class="form-input" id="oh-amount" step="0.01" min="0" required />
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input type="text" class="form-input" id="oh-notes" placeholder="Optional detail" />
      </div>
      <div id="add-oh-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary" id="add-oh-btn">Add Cost</button>
        <button type="button" class="btn btn-ghost" onclick="closeDynModal('add-oh-modal')">Cancel</button>
      </div>
    </form>`);
}

async function submitAddOverhead(e) {
  e.preventDefault();
  const alertEl = document.getElementById('add-oh-alert');
  const btn     = document.getElementById('add-oh-btn');
  const desc    = document.getElementById('oh-desc').value.trim();
  const amount  = parseFloat(document.getElementById('oh-amount').value);
  const notes   = document.getElementById('oh-notes').value.trim() || null;

  if (!desc || !amount) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent='Description and amount are required.'; return;
  }

  btn.disabled = true;
  const { error } = await supabaseClient.from('rfq_overhead_costs').insert([{ rfq_id: _rfqId, description: desc, amount_gbp: amount, notes }]);
  if (error) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent = error.message;
    btn.disabled = false; return;
  }
  closeDynModal('add-oh-modal');
  renderCostsTab();
}

async function deleteOverhead(id) {
  if (!confirm('Remove this cost?')) return;
  await supabaseClient.from('rfq_overhead_costs').delete().eq('id', id);
  renderCostsTab();
}

// ── Tab 2: Pricing Calculator (multi-line, scenario-based) ───────────────────

function renderPricingCalculator(sqList, lqList, ohList) {
  const el = document.getElementById('pricing-calculator-section');
  if (!el) return;

  _calc.overheadTotal = (ohList || []).reduce((s, o) => s + parseFloat(o.amount_gbp || 0), 0);

  // Build unique supplier list from sqList (scenario grouping)
  const supplierMap = {};
  sqList.forEach(q => {
    if (q.supplier_id && q.contacts?.company_name) {
      supplierMap[q.supplier_id] = q.contacts.company_name;
    }
  });
  const suppliers = Object.entries(supplierMap);

  // Auto-select first scenario if none selected
  if (!_scenarioSupplierId && suppliers.length > 0) {
    _scenarioSupplierId = suppliers[0][0];
  }

  const scenarioOpts = suppliers.map(([id, name]) =>
    `<option value="${esc(id)}" ${id === _scenarioSupplierId ? 'selected' : ''}>${esc(name)}</option>`
  ).join('');

  const lqOpts = lqList.map(q => {
    const price = q.pricing_type === 'flat' ? `£${fmt(q.price_flat_gbp)} flat` : `$${fmt(q.price_per_mt_usd)}/MT`;
    return `<option value="${esc(q.id)}" ${_calc.lqData?.id === q.id ? 'selected' : ''}>${esc(q.contacts?.company_name || '?')} — ${price}</option>`;
  }).join('');

  // Default margin from first rfq_line's product line (if available)
  const defaultMargin = _rfqLines[0]?.product_line_id
    ? (_allProductLines.find(p => p.id === _rfqLines[0].product_line_id)?.default_markup_pct ?? 10)
    : 10;

  el.innerHTML = `
    <div style="border-top:2px solid var(--color-border);margin-top:var(--space-6);padding-top:var(--space-6)">
      <div class="cost-section-header" style="margin-bottom:var(--space-5)">
        <h4 style="margin:0">Pricing</h4>
        <span style="font-size:var(--text-xs);color:var(--color-text-muted)">Select a pricing scenario then apply all lines to the quote builder</span>
      </div>

      ${suppliers.length === 0 ? `
        <div class="alert" style="background:var(--color-surface);border:1px solid var(--color-border);padding:var(--space-4)">
          Add supplier quotes above before pricing. Each supplier's quotes form a scenario.
        </div>` : `

      <!-- Global inputs row -->
      <div class="form-grid" style="margin-bottom:var(--space-5)">
        <div class="form-group">
          <label class="form-label">Pricing Scenario (Supplier) <span style="color:var(--color-danger)">*</span></label>
          <select class="form-select" id="calc-scenario" onchange="_scenarioSupplierId=this.value;recalcAllLines()">
            <option value="">— Select supplier scenario —</option>${scenarioOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Logistics Quote</label>
          <select class="form-select" id="calc-lq-sel" onchange="onCalcLqChange(this.value)">
            <option value="">— None —</option>${lqOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Exchange Rate (USD per £)</label>
          <input type="number" class="form-input" id="calc-fx" value="${_calc.fx}" step="0.001" min="0.001" oninput="_calc.fx=parseFloat(this.value)||1.27;recalcAllLines()" />
        </div>
        <div class="form-group">
          <label class="form-label">Insurance (% of FOB)</label>
          <input type="number" class="form-input" id="calc-ins" value="0.5" step="0.05" min="0" oninput="recalcAllLines()" />
        </div>
      </div>

      <!-- Pricing model (applies to all lines) -->
      <div style="background:var(--color-surface);border-radius:var(--radius);padding:var(--space-4);margin-bottom:var(--space-5)">
        <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-3)">Pricing Model (all lines)</p>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-5);margin-bottom:var(--space-3)">
          ${[['standard','Standard','Default product line margin'],['best','Best Price','Half standard, min 3%'],['market','Market Rate','Market reference price'],['manual','Manual','Enter margin % directly']].map(([val, label, desc]) =>
            `<label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer">
              <input type="radio" name="calc-model" value="${val}" ${val === 'standard' ? 'checked' : ''} onchange="onCalcModelChange('${val}')" />
              <span style="font-size:var(--text-sm);font-weight:600">${label}</span>
              <span style="font-size:var(--text-xs);color:var(--color-text-muted)">${desc}</span>
            </label>`).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <label class="form-label" style="margin:0;white-space:nowrap">Gross Margin %</label>
          <input type="number" class="form-input" id="calc-margin" value="${fmt(defaultMargin, 1)}" step="0.1" min="0" max="100" style="width:100px" oninput="document.querySelector('input[name=calc-model][value=manual]').checked=true;_calc.model='manual';recalcAllLines()" />
        </div>
      </div>

      <!-- Per-line pricing table -->
      <div style="overflow-x:auto;margin-bottom:var(--space-5)">
        <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">
          <thead>
            <tr style="background:var(--color-surface)">
              <th style="padding:var(--space-2) var(--space-3);text-align:left;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border);white-space:nowrap">Line</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:left;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border)">Description</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:left;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border)">Qty</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:right;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border)">FOB/unit</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:right;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border)">Freight/unit</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:right;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border)">Landed</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:right;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border)">Sell Price</th>
            </tr>
          </thead>
          <tbody id="calc-lines-body">
            <tr><td colspan="7" style="padding:var(--space-4);text-align:center;color:var(--color-text-muted)">Select a scenario above to see pricing.</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Summary + apply -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-3) var(--space-4);background:#0a1728;border-radius:var(--radius)">
        <div>
          <span style="font-size:var(--text-xs);color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.06em">Total Quote Value</span>
          <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:#7ab8d4" id="calc-total-value">—</div>
        </div>
        <button class="btn btn-primary" id="calc-apply-btn" onclick="applyAllLinesToQuote()" disabled>Apply all lines to Quote →</button>
      </div>
      `}
    </div>`;

  recalcAllLines();
}

function onCalcLqChange(lqId) {
  _calc.lqData = _costsLqList.find(q => q.id === lqId) || null;
  recalcAllLines();
}

function onCalcModelChange(model) {
  _calc.model = model;
  const marginEl = document.getElementById('calc-margin');
  if (!marginEl) return;
  if (model === 'manual') { marginEl.readOnly = false; return; }
  marginEl.readOnly = true;
  recalcAllLines();
}

function calcLinePrice(line, sqForLine, lqData, fx, ins, overheadTotal, totalQtyMt, model, manualMargin) {
  // FOB in GBP per MT-equivalent
  let fobGbp = 0;
  if (sqForLine) {
    if (sqForLine.pricing_basis === 'per_piece') {
      const pieces = parseFloat(sqForLine.quantity_pieces || line.quantity || 1);
      const totalFobGbp = parseFloat(sqForLine.price_per_piece || 0) * pieces / fx;
      fobGbp = line.quantity > 0 ? totalFobGbp / line.quantity : 0;
    } else if (sqForLine.pricing_basis === 'total') {
      fobGbp = line.quantity > 0 ? parseFloat(sqForLine.fob_price_usd || 0) / fx / line.quantity : 0;
    } else {
      fobGbp = parseFloat(sqForLine.fob_price_usd || 0) / fx;
    }
  }

  // Freight in GBP per MT — proportional to this line's share of total qty
  let freightGbpPerMt = 0;
  if (lqData && line.quantity > 0 && totalQtyMt > 0) {
    if (lqData.pricing_type === 'flat') {
      const myShare = line.quantity / totalQtyMt;
      freightGbpPerMt = parseFloat(lqData.price_flat_gbp || 0) * myShare / line.quantity;
    } else {
      freightGbpPerMt = parseFloat(lqData.price_per_mt_usd || 0) / fx;
    }
  }

  // Insurance
  const insuranceGbp = fobGbp * (ins / 100);

  // Overheads — proportional by quantity
  const ovhPerMt = (totalQtyMt > 0 && line.quantity > 0)
    ? overheadTotal * (line.quantity / totalQtyMt) / line.quantity
    : 0;

  const landed = fobGbp + freightGbpPerMt + insuranceGbp + ovhPerMt;
  if (!landed) return null;

  // Determine margin for this line
  const pl = _allProductLines.find(p => p.id === line.product_line_id);
  let marginPct = manualMargin;
  if (model === 'standard') marginPct = pl?.default_markup_pct ?? 10;
  if (model === 'best')     marginPct = Math.max((pl?.default_markup_pct ?? 10) / 2, 3);
  if (model === 'market')   {
    const mkt = pl?.market_reference_price_gbp;
    marginPct = mkt && landed > 0 ? ((mkt - landed) / mkt) * 100 : manualMargin;
  }

  const sellPrice = marginPct < 100 ? landed / (1 - marginPct / 100) : 0;
  return { fobGbp, freightGbpPerMt, insuranceGbp, ovhPerMt, landed, sellPrice, marginPct, pl };
}

function recalcAllLines() {
  const scenarioId = _scenarioSupplierId || document.getElementById('calc-scenario')?.value;
  const lqData     = _calc.lqData;
  const fx         = parseFloat(document.getElementById('calc-fx')?.value)  || 1.27;
  const ins        = parseFloat(document.getElementById('calc-ins')?.value) || 0;
  const model      = document.querySelector('input[name="calc-model"]:checked')?.value || 'standard';
  const manualMargin = parseFloat(document.getElementById('calc-margin')?.value) || 10;

  // Filter supplier quotes for selected scenario
  const scenarioQuotes = _costsSqList.filter(q => q.supplier_id === scenarioId);

  // Total MT quantity across all MT-unit lines (for proportional logistics split)
  const totalQtyMt = _rfqLines.reduce((s, l) => {
    if (l.quantity_unit === 'MT' && l.quantity) return s + parseFloat(l.quantity);
    return s;
  }, 0);

  const tbody = document.getElementById('calc-lines-body');
  if (!tbody) return;

  if (!scenarioId || !_rfqLines.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="padding:var(--space-4);text-align:center;color:var(--color-text-muted)">Select a pricing scenario above.</td></tr>';
    return;
  }

  _pricedLines = [];
  let grandTotal = 0;
  let allPrimaryPriced = true;

  tbody.innerHTML = _rfqLines.map(line => {
    const sqForLine = scenarioQuotes.find(q => q.rfq_line_id === line.id);
    const result    = sqForLine ? calcLinePrice(line, sqForLine, lqData, fx, ins, _calc.overheadTotal, totalQtyMt, model, manualMargin) : null;

    if (!result) {
      if (!line.is_alternative) allPrimaryPriced = false;
      return `<tr style="background:${line.is_alternative ? '#fffbf0' : '#fff8f8'}">
        <td style="padding:var(--space-2) var(--space-3)">${line.line_number}${line.is_alternative ? ' <span class="badge badge-info" style="font-size:10px">Alt</span>' : ''}</td>
        <td style="padding:var(--space-2) var(--space-3)">${esc(line.description)}<div style="font-size:var(--text-xs);color:var(--color-text-muted)">${esc(line.grade_specification || '')}</div></td>
        <td style="padding:var(--space-2) var(--space-3)">${line.quantity ? fmt(line.quantity, 0) + ' ' + (line.quantity_unit || 'MT') : '—'}</td>
        <td colspan="4" style="padding:var(--space-2) var(--space-3);text-align:center;color:var(--color-text-muted);font-size:var(--text-xs)">No supplier quote for this scenario</td>
      </tr>`;
    }

    const lineTotal = result.sellPrice * (parseFloat(line.quantity) || 0);
    grandTotal += lineTotal;
    _pricedLines.push({ line, result, sqForLine, lineTotal });

    return `<tr style="border-bottom:1px solid var(--color-border);background:${line.is_alternative ? '#f9fffe' : ''}">
      <td style="padding:var(--space-2) var(--space-3);font-weight:600">${line.line_number}${line.is_alternative ? ' <span class="badge badge-info" style="font-size:10px">Alt</span>' : ''}</td>
      <td style="padding:var(--space-2) var(--space-3)">${esc(line.description)}<div style="font-size:var(--text-xs);color:var(--color-text-muted)">${esc(line.grade_specification || '')}</div></td>
      <td style="padding:var(--space-2) var(--space-3)">${line.quantity ? fmt(line.quantity, 0) + ' ' + (line.quantity_unit || 'MT') : '—'}</td>
      <td style="padding:var(--space-2) var(--space-3);text-align:right;font-variant-numeric:tabular-nums">£${fmt(result.fobGbp)}</td>
      <td style="padding:var(--space-2) var(--space-3);text-align:right;font-variant-numeric:tabular-nums">£${fmt(result.freightGbpPerMt)}</td>
      <td style="padding:var(--space-2) var(--space-3);text-align:right;font-variant-numeric:tabular-nums">£${fmt(result.landed)}</td>
      <td style="padding:var(--space-2) var(--space-3);text-align:right;font-family:var(--font-display);font-weight:700;color:var(--color-text-primary)">£${fmt(result.sellPrice)}</td>
    </tr>`;
  }).join('');

  // Update total and apply button
  const totalEl = document.getElementById('calc-total-value');
  if (totalEl) totalEl.textContent = grandTotal ? `£${(grandTotal).toLocaleString('en-GB', {minimumFractionDigits:2})}` : '—';

  const applyBtn = document.getElementById('calc-apply-btn');
  if (applyBtn) applyBtn.disabled = !(allPrimaryPriced && _pricedLines.length > 0);

  // Sync margin field if model is not manual
  if (model !== 'manual' && _pricedLines.length > 0) {
    const el = document.getElementById('calc-margin');
    if (el) el.value = fmt(_pricedLines[0]?.result?.marginPct ?? manualMargin, 1);
  }
}

async function applyAllLinesToQuote() {
  if (!_pricedLines.length) return;

  const lqId = _calc.lqData?.id || null;

  _calcApplied = _pricedLines.map(({ line, result, sqForLine }) => ({
    rfqLineId:     line.id,
    lineNumber:    line.line_number,
    isAlternative: line.is_alternative,
    altReason:     line.alt_reason || '',
    plId:          line.product_line_id || result.pl?.id || null,
    plName:        result.pl?.name || line.description,
    cnCode:        result.pl?.cn_code || '',
    vatRate:       result.pl?.vat_rate != null ? result.pl.vat_rate * 100 : 20,
    description:   line.description,
    gradeSpec:     line.grade_specification || '',
    qty:           line.quantity || null,
    unit:          line.quantity_unit || 'MT',
    unitPrice:     result.sellPrice,
    sqId:          sqForLine?.id || null,
    lqId,
    model:         _calc.model,
    marginPct:     result.marginPct,
    landed:        result.landed,
  }));

  _quoteLines   = [];
  _activeCqId   = null;
  switchTab('build');
}

// ── Tab 2: File upload helper ─────────────────────────────────────────────────

async function uploadQuoteDocument(file, type) {
  const path = `${_rfqId}/${type}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await supabaseClient.storage.from('rfq-documents').upload(path, file);
  if (error) throw new Error('Upload failed: ' + error.message);
  return path;
}

async function downloadDoc(bucket, path) {
  const { data, error } = await supabaseClient.storage.from(bucket === 'supplier_quotes' || bucket === 'logistics_quotes' ? 'rfq-documents' : bucket).download(path);
  if (error) { alert('Download failed: ' + error.message); return; }
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url; a.download = path.split('/').pop(); a.click();
}

// ── Tab 3: Build Quote ────────────────────────────────────────────────────────

async function renderBuildTab() {
  // Load overheads for totals summary, and existing draft quote if any
  const [{ data: overheads }, { data: existingCq }] = await Promise.all([
    supabaseClient.from('rfq_overhead_costs').select('*').eq('rfq_id', _rfqId).order('created_at'),
    supabaseClient.from('customer_quotes').select('*').eq('rfq_id', _rfqId).in('status',['draft']).order('created_at', { ascending: false }).limit(1),
  ]);

  let cq = existingCq?.[0] || null;
  let existingLines = [];
  if (cq) {
    _activeCqId = cq.id;
    const { data: lines } = await supabaseClient.from('customer_quote_lines')
      .select('*').eq('customer_quote_id', cq.id).order('line_number');
    existingLines = lines || [];
  }

  // Try to pre-fill contact address if buyer contact matched
  let contactAddr = null;
  if (_rfqData?.company) {
    const { data: contacts } = await supabaseClient.from('contacts')
      .select('primary_contact_name,company_name,address_line_1,address_line_2,city,postcode,country,vat_number')
      .eq('type','buyer').ilike('company_name', `%${_rfqData.company.split(' ')[0]}%`).limit(1);
    contactAddr = contacts?.[0] || null;
  }

  // Initialise working line items — prefer calculator output, then existing draft, then blank
  if (existingLines.length) {
    _quoteLines = existingLines.map(l => ({ ...l }));
  } else if (Array.isArray(_calcApplied) && _calcApplied.length) {
    // Multi-line from scenario pricing calculator
    _quoteLines = _calcApplied.map((ca, i) => {
      const amt = (ca.unitPrice || 0) * (ca.qty || 0);
      return {
        line_number:        i + 1,
        rfq_line_id:        ca.rfqLineId || null,
        item_code:          ca.cnCode || '',
        description:        ca.description || ca.plName,
        grade_specification: ca.gradeSpec || '',
        quantity:           ca.qty || null,
        unit:               ca.unit || 'MT',
        unit_price_gbp:     ca.unitPrice,
        amount_gbp:         amt,
        vat_rate:           ca.vatRate,
        vat_amount_gbp:     amt * (ca.vatRate / 100),
        is_alternative:     ca.isAlternative || false,
      };
    });
    _calcApplied = null;
  } else if (_calcApplied && !Array.isArray(_calcApplied)) {
    // Legacy single-line from old calculator
    const ca = _calcApplied;
    const amt = (ca.unitPrice || 0) * (ca.qty || 0);
    _quoteLines = [{
      line_number:        1,
      item_code:          ca.cnCode || '',
      description:        ca.plName,
      grade_specification: ca.specs || '',
      quantity:           ca.qty || null,
      unit:               'MT',
      unit_price_gbp:     ca.unitPrice,
      amount_gbp:         amt,
      vat_rate:           ca.vatRate,
      vat_amount_gbp:     amt * (ca.vatRate / 100),
      is_alternative:     false,
    }];
    _calcApplied = null;
  } else if (!_quoteLines.length) {
    _quoteLines = [blankLine(1)];
  }

  const overheadTotal = (overheads||[]).reduce((s,o) => s + parseFloat(o.amount_gbp||0), 0);

  const today = new Date().toISOString().split('T')[0];
  const ref   = cq?.quote_reference || generateQuoteReference();

  const el = document.getElementById('build-quote-content');
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-8);margin-bottom:var(--space-6)">

      <!-- Customer address block -->
      <div>
        <h4 style="margin-bottom:var(--space-4)">Customer Details</h4>
        <div class="form-grid">
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Contact Name</label>
            <input type="text" class="form-input" id="bq-cust-name" value="${esc(cq?.customer_name || contactAddr?.primary_contact_name || _rfqData?.name || '')}" />
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Company</label>
            <input type="text" class="form-input" id="bq-cust-company" value="${esc(cq?.customer_company || contactAddr?.company_name || _rfqData?.company || '')}" />
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Address Line 1</label>
            <input type="text" class="form-input" id="bq-addr1" value="${esc(cq?.customer_address_line_1 || contactAddr?.address_line_1 || '')}" />
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Address Line 2</label>
            <input type="text" class="form-input" id="bq-addr2" value="${esc(cq?.customer_address_line_2 || contactAddr?.address_line_2 || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">City</label>
            <input type="text" class="form-input" id="bq-city" value="${esc(cq?.customer_city || contactAddr?.city || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Postcode</label>
            <input type="text" class="form-input" id="bq-postcode" value="${esc(cq?.customer_postcode || contactAddr?.postcode || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Country</label>
            <input type="text" class="form-input" id="bq-country" value="${esc(cq?.customer_country || contactAddr?.country || _rfqData?.country || 'United Kingdom')}" />
          </div>
          <div class="form-group">
            <label class="form-label">VAT Number</label>
            <input type="text" class="form-input" id="bq-vat" value="${esc(cq?.customer_vat_number || contactAddr?.vat_number || '')}" placeholder="e.g. GB 123 4567 89" />
          </div>
        </div>
      </div>

      <!-- Quote header -->
      <div>
        <h4 style="margin-bottom:var(--space-4)">Quote Details</h4>
        <div class="form-grid">
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Quote Reference</label>
            <div style="display:flex;gap:var(--space-2)">
              <input type="text" class="form-input" id="bq-ref" value="${esc(ref)}" readonly style="flex:1;background:var(--color-surface)" />
              <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('bq-ref').value=generateQuoteReference()">Regenerate</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-input" id="bq-date" value="${esc(cq?.issued_date || today)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Expiry Date</label>
            <input type="date" class="form-input" id="bq-expiry" value="${esc(cq?.validity_date || '')}" />
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Payment Terms</label>
            <select class="form-select" id="bq-payment-select" onchange="document.getElementById('bq-payment-other').style.display=this.value==='other'?'block':'none'">
              ${['Pro forma invoice (full payment before dispatch)','30% deposit, balance before shipment','50% deposit, 50% on delivery','Net 30 days from invoice','Net 60 days from invoice','Letter of Credit (irrevocable)','other'].map(t => {
                const val  = t === 'other' ? 'other' : t;
                const sel  = (cq?.payment_terms === t || (!cq?.payment_terms && t === 'Pro forma invoice (full payment before dispatch)')) ? 'selected' : '';
                return `<option value="${esc(val)}" ${sel}>${t === 'other' ? 'Other (specify below)' : esc(t)}</option>`;
              }).join('')}
            </select>
            <input type="text" class="form-input" id="bq-payment-other" placeholder="Specify payment terms…" style="margin-top:var(--space-2);${cq?.payment_terms && !['Pro forma invoice (full payment before dispatch)','30% deposit, balance before shipment','50% deposit, 50% on delivery','Net 30 days from invoice','Net 60 days from invoice','Letter of Credit (irrevocable)'].includes(cq.payment_terms) ? '' : 'display:none'}" value="${esc(cq?.payment_terms && !['Pro forma invoice (full payment before dispatch)','30% deposit, balance before shipment','50% deposit, 50% on delivery','Net 30 days from invoice','Net 60 days from invoice','Letter of Credit (irrevocable)'].includes(cq.payment_terms) ? cq.payment_terms : '')}" />
            <input type="hidden" id="bq-payment" />
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Lead Time</label>
            <input type="text" class="form-input" id="bq-lead" value="${esc(cq?.lead_time || '')}" placeholder="e.g. 4–6 weeks from order confirmation" />
          </div>
        </div>
      </div>
    </div>

    <!-- Line items -->
    <h4 style="margin-bottom:var(--space-3)">Line Items</h4>
    <div style="overflow-x:auto;margin-bottom:var(--space-3)">
      <table class="line-editor-table" id="line-items-table">
        <thead><tr>
          <th style="width:30px">#</th>
          <th style="min-width:100px">Item Code</th>
          <th style="min-width:180px">Description *</th>
          <th style="min-width:140px">Grade / Spec</th>
          <th style="width:70px">Qty</th>
          <th style="width:70px">Unit</th>
          <th style="width:90px">Unit Price (£)</th>
          <th style="width:70px">VAT %</th>
          <th style="width:90px">Amount (£)</th>
          <th style="width:30px"></th>
        </tr></thead>
        <tbody id="line-items-body"></tbody>
      </table>
    </div>
    <div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-6)">
      <button type="button" class="btn btn-ghost btn-sm" onclick="addQuoteLine(false)">+ Add Line</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="addQuoteLine(true)">+ Add Alternative Line</button>
    </div>

    <!-- Totals -->
    <div class="totals-box">
      ${overheadTotal > 0 ? `
      <div style="margin-bottom:var(--space-3)">
        <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-2)">Additional Costs (from Cost Inputs tab)</p>
        <div id="overhead-totals-summary" style="font-size:var(--text-sm);color:var(--color-text-muted)">£${fmt(overheadTotal)} total overheads</div>
      </div>` : ''}
      <div class="totals-row"><span>Subtotal (ex. VAT)</span><span id="t-subtotal" style="font-family:var(--font-display)">—</span></div>
      <div class="totals-row"><span>VAT</span><span id="t-vat" style="font-family:var(--font-display)">—</span></div>
      <div class="totals-row total-final"><span>Total (inc. VAT)</span><span id="t-total">—</span></div>
    </div>

    <!-- Notes & T&Cs -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6);margin-top:var(--space-6)">
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="bq-notes" rows="4" placeholder="e.g. Alternative grades offered due to stock availability...">${esc(cq?.notes||'')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Terms &amp; Conditions</label>
        <textarea class="form-textarea" id="bq-terms" rows="5">${esc(cq?.terms_conditions || 'Payment terms as agreed. Prices are subject to exchange rate fluctuation.\nAll goods remain the property of Vertex Metals Ltd until payment is received in full.\nVertex Metals Ltd reserves the right to withdraw this quotation at any time prior to acceptance.\nThis quotation is valid for the period stated above. After this date, prices are subject to review.\n[Insert full standard terms and conditions here]')}</textarea>
      </div>
    </div>

    <div id="bq-alert" class="alert" style="display:none;margin-top:var(--space-4)"></div>
    <div style="display:flex;gap:var(--space-3);margin-top:var(--space-6)">
      <button type="button" class="btn btn-secondary" id="bq-save-btn" onclick="saveDraftWithFeedback()">Save Draft</button>
      <button type="button" class="btn btn-primary" onclick="publishQuote()">Generate RFQ →</button>
    </div>
  `;

  renderLineItemsBody();
}

function blankLine(num) {
  return { line_number: num, item_code: '', description: '', grade_specification: '', quantity: '', unit: 'MT', unit_price_gbp: '', vat_rate: 20, amount_gbp: 0, vat_amount_gbp: 0, is_alternative: false };
}

function renderLineItemsBody() {
  const tbody = document.getElementById('line-items-body');
  if (!tbody) return;
  const UNITS = ['MT','kg','each','m','m²','tonne'];
  tbody.innerHTML = _quoteLines.map((l, i) => `
    <tr id="line-row-${i}">
      <td style="text-align:center;color:var(--color-text-muted);font-size:var(--text-xs)">
        ${l.is_alternative ? `<span class="line-alt-badge">ALT</span>` : i + 1}
      </td>
      <td><input class="line-input" type="text" value="${esc(l.item_code||'')}" oninput="_quoteLines[${i}].item_code=this.value" placeholder="SKU / code" /></td>
      <td><input class="line-input" type="text" value="${esc(l.description||'')}" oninput="_quoteLines[${i}].description=this.value" required placeholder="Product description" /></td>
      <td><input class="line-input" type="text" value="${esc(l.grade_specification||'')}" oninput="_quoteLines[${i}].grade_specification=this.value" placeholder="Grade / spec" /></td>
      <td><input class="line-input" type="number" value="${l.quantity||''}" step="0.001" min="0" oninput="_quoteLines[${i}].quantity=parseFloat(this.value)||null;recalcLine(${i})" /></td>
      <td><select class="line-input" onchange="_quoteLines[${i}].unit=this.value">
        ${UNITS.map(u => `<option value="${u}"${u===(l.unit||'MT')?' selected':''}>${u}</option>`).join('')}
      </select></td>
      <td><input class="line-input" type="number" value="${l.unit_price_gbp||''}" step="0.01" min="0" oninput="_quoteLines[${i}].unit_price_gbp=parseFloat(this.value)||null;recalcLine(${i})" /></td>
      <td><input class="line-input" type="number" value="${l.vat_rate??20}" step="0.5" min="0" oninput="_quoteLines[${i}].vat_rate=parseFloat(this.value)||0;recalcLine(${i})" /></td>
      <td style="font-family:var(--font-display);font-weight:600;text-align:right" id="line-amount-${i}">${l.amount_gbp ? `£${fmt(l.amount_gbp)}` : '—'}</td>
      <td><button type="button" onclick="removeQuoteLine(${i})" style="background:none;border:none;cursor:pointer;color:var(--color-text-muted);font-size:var(--text-lg);line-height:1;padding:var(--space-1)" title="Remove line">×</button></td>
    </tr>`).join('');
  recalcTotals();
}

function addQuoteLine(isAlternative) {
  _quoteLines.push({ ...blankLine(_quoteLines.length + 1), is_alternative: isAlternative });
  renderLineItemsBody();
}

function removeQuoteLine(i) {
  if (_quoteLines.length <= 1) return;
  _quoteLines.splice(i, 1);
  _quoteLines.forEach((l, idx) => { if (!l.is_alternative) l.line_number = idx + 1; });
  renderLineItemsBody();
}

function recalcLine(i) {
  const l = _quoteLines[i];
  const qty   = parseFloat(l.quantity)      || 0;
  const price = parseFloat(l.unit_price_gbp) || 0;
  const vat   = parseFloat(l.vat_rate)       || 0;
  l.amount_gbp     = qty * price;
  l.vat_amount_gbp = l.amount_gbp * (vat / 100);
  const el = document.getElementById(`line-amount-${i}`);
  if (el) el.textContent = l.amount_gbp ? `£${fmt(l.amount_gbp)}` : '—';
  recalcTotals();
}

function recalcTotals() {
  const subtotal  = _quoteLines.reduce((s, l) => s + (parseFloat(l.amount_gbp) || 0), 0);
  const vatTotal  = _quoteLines.reduce((s, l) => s + (parseFloat(l.vat_amount_gbp) || 0), 0);
  const grandTotal = subtotal + vatTotal;

  const tSub  = document.getElementById('t-subtotal');
  const tVat  = document.getElementById('t-vat');
  const tTot  = document.getElementById('t-total');
  if (tSub) tSub.textContent = subtotal  ? `£${fmt(subtotal)}`  : '—';
  if (tVat) tVat.textContent = vatTotal  ? `£${fmt(vatTotal)}`  : '—';
  if (tTot) tTot.textContent = grandTotal ? `£${fmt(grandTotal)}` : '—';
}

async function saveDraftWithFeedback() {
  const btn     = document.getElementById('bq-save-btn');
  const alertEl = document.getElementById('bq-alert');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const cqId = await saveQuoteDraft(false);

  if (btn) { btn.disabled = false; btn.textContent = 'Save Draft'; }
  if (cqId && alertEl) {
    alertEl.style.display = 'block';
    alertEl.className     = 'alert alert-success';
    alertEl.textContent   = 'Draft saved.';
    setTimeout(() => { alertEl.style.display = 'none'; }, 3000);
  }
}

async function saveQuoteDraft(publish = false) {
  const alertEl = document.getElementById('bq-alert');
  if (alertEl) { alertEl.style.display = 'none'; }

  const lines = _quoteLines.filter(l => l.description?.trim());
  if (!lines.length) {
    if (alertEl) { alertEl.style.display='block'; alertEl.className='alert alert-error'; alertEl.textContent='Add at least one line item with a description.'; }
    return null;
  }

  const subtotal   = lines.reduce((s,l) => s + (parseFloat(l.amount_gbp)||0), 0);
  const vatTotal   = lines.reduce((s,l) => s + (parseFloat(l.vat_amount_gbp)||0), 0);
  const grandTotal = subtotal + vatTotal;

  const qPayload = {
    rfq_id:                   _rfqId,
    product_line_id:          _rfqData?.product_line_id || null,
    sell_price_per_mt_gbp:    lines.find(l => !l.is_alternative)?.unit_price_gbp || null,
    quote_reference:          document.getElementById('bq-ref')?.value || generateQuoteReference(),
    issued_date:              document.getElementById('bq-date')?.value || null,
    validity_date:            document.getElementById('bq-expiry')?.value || null,
    customer_name:            document.getElementById('bq-cust-name')?.value.trim() || null,
    customer_company:         document.getElementById('bq-cust-company')?.value.trim() || null,
    customer_address_line_1:  document.getElementById('bq-addr1')?.value.trim() || null,
    customer_address_line_2:  document.getElementById('bq-addr2')?.value.trim() || null,
    customer_city:            document.getElementById('bq-city')?.value.trim() || null,
    customer_postcode:        document.getElementById('bq-postcode')?.value.trim() || null,
    customer_country:         document.getElementById('bq-country')?.value.trim() || null,
    customer_vat_number:      document.getElementById('bq-vat')?.value.trim() || null,
    payment_terms:            (() => { const sel = document.getElementById('bq-payment-select')?.value; return sel === 'other' ? (document.getElementById('bq-payment-other')?.value.trim() || null) : (sel || null); })(),
    lead_time:                document.getElementById('bq-lead')?.value.trim() || null,
    notes:                    document.getElementById('bq-notes')?.value.trim() || null,
    terms_conditions:         document.getElementById('bq-terms')?.value.trim() || null,
    subtotal_gbp:             subtotal   || null,
    vat_total_gbp:            vatTotal   || null,
    total_gbp:                grandTotal || null,
    status:                   publish ? 'issued' : 'draft',
  };

  let cqId = _activeCqId;
  if (cqId) {
    const { error } = await supabaseClient.from('customer_quotes').update(qPayload).eq('id', cqId);
    if (error) {
      if (alertEl) { alertEl.style.display='block'; alertEl.className='alert alert-error'; alertEl.textContent='Save failed: '+error.message; }
      return null;
    }
  } else {
    const { data: newCq, error } = await supabaseClient.from('customer_quotes').insert([qPayload]).select('id,magic_link_token').single();
    if (error) {
      if (alertEl) { alertEl.style.display='block'; alertEl.className='alert alert-error'; alertEl.textContent='Save failed: '+error.message; }
      return null;
    }
    cqId = newCq.id;
    _activeCqId = cqId;
  }

  // Replace line items (delete all then re-insert)
  await supabaseClient.from('customer_quote_lines').delete().eq('customer_quote_id', cqId);
  const lineRows = lines.map((l, i) => ({
    customer_quote_id: cqId,
    line_number:       i + 1,
    item_code:         l.item_code || null,
    description:       l.description,
    grade_specification: l.grade_specification || null,
    quantity:          parseFloat(l.quantity) || null,
    unit:              l.unit || 'MT',
    unit_price_gbp:    parseFloat(l.unit_price_gbp) || null,
    amount_gbp:        parseFloat(l.amount_gbp) || null,
    vat_rate:          parseFloat(l.vat_rate) ?? 20,
    vat_amount_gbp:    parseFloat(l.vat_amount_gbp) || null,
    is_alternative:    !!l.is_alternative,
  }));
  const { error: lineErr } = await supabaseClient.from('customer_quote_lines').insert(lineRows);
  if (lineErr) {
    if (alertEl) { alertEl.style.display='block'; alertEl.className='alert alert-error'; alertEl.textContent='Lines save failed: '+lineErr.message; }
    return null;
  }

  if (publish && ['new','reviewing'].includes(_rfqData?.status)) {
    await supabaseClient.from('rfq_submissions').update({ status: 'quoted' }).eq('id', _rfqId);
    if (_rfqData) _rfqData.status = 'quoted';
  }

  return cqId;
}

async function publishQuote() {
  const alertEl  = document.getElementById('bq-alert');
  const publishBtn = document.querySelector('button[onclick="publishQuote()"]');
  if (publishBtn) { publishBtn.disabled = true; publishBtn.textContent = 'Generating…'; }

  const cqId = await saveQuoteDraft(true);

  if (publishBtn) { publishBtn.disabled = false; publishBtn.textContent = 'Generate RFQ →'; }
  if (!cqId) return;

  // Fetch the magic link token
  const { data: cq } = await supabaseClient.from('customer_quotes').select('magic_link_token,quote_reference').eq('id', cqId).single();
  const token = cq?.magic_link_token;
  const ref   = cq?.quote_reference;

  // Switch to Customer tab — magic link is always visible there
  switchTab('customer');
}

// ── Tab 4: Customer ────────────────────────────────────────────────────────────

async function renderCustomerTab() {
  const el = document.getElementById('customer-tab-content');
  el.innerHTML = '<div style="color:var(--color-text-muted)">Loading...</div>';

  const { data: quotes } = await supabaseClient.from('customer_quotes')
    .select('*').eq('rfq_id', _rfqId).order('created_at', { ascending: false });

  if (!quotes || !quotes.length) {
    el.innerHTML = `<div style="color:var(--color-text-muted);padding:var(--space-4)">No customer quotes yet. <button class="btn btn-ghost btn-sm" onclick="switchTab('build')">Build Quote →</button></div>`;
    return;
  }

  const baseUrl = window.location.origin;

  el.innerHTML = quotes.map(cq => {
    const magicLink = `${baseUrl}/customer-quote/?token=${cq.magic_link_token}`;
    let actions = '';
    if (cq.status === 'draft') {
      actions = `<button onclick="switchTab('build')" class="btn btn-secondary btn-sm">Edit Draft</button>
                 <button onclick="_activeCqId='${esc(cq.id)}';switchTab('build')" class="btn btn-primary btn-sm">Edit &amp; Publish</button>`;
    } else if (cq.status === 'issued' || cq.status === 'sent') {
      actions = `<button onclick="updateCqStatus('${esc(cq.id)}','sent')" class="btn btn-ghost btn-sm">Mark Sent</button>
                 <button onclick="updateCqStatus('${esc(cq.id)}','accepted')" class="btn btn-secondary btn-sm">Mark Accepted</button>
                 <button onclick="updateCqStatus('${esc(cq.id)}','rejected')" class="btn btn-ghost btn-sm" style="color:var(--color-danger)">Reject</button>`;
    } else if (cq.status === 'accepted') {
      actions = `<button onclick="openConvertOrderModal('${esc(cq.id)}')" class="btn btn-primary btn-sm">Create Order →</button>`;
    }

    const showMagicLink = ['issued','sent','accepted'].includes(cq.status);

    return `<div class="card" style="margin-bottom:var(--space-4)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-4)">
        <div>
          <div style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-1)">${esc(cq.quote_reference || cq.id.slice(0,8).toUpperCase())}</div>
          <div style="font-family:var(--font-display);font-size:var(--text-2xl);font-weight:700;color:var(--color-text-primary)">${cq.total_gbp ? `£${fmt(cq.total_gbp)}` : '—'}</div>
          <div style="font-size:var(--text-sm);color:var(--color-text-muted);margin-top:var(--space-1)">Issued: ${fmtDate(cq.issued_date)} &middot; Expires: ${fmtDate(cq.validity_date)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap">
          ${cqStatusBadge(cq.status)}
          ${actions}
        </div>
      </div>
      ${showMagicLink ? `
      <div class="magic-link-box">
        <div>
          <div style="font-size:var(--text-xs);color:rgba(255,255,255,.75);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-1)">Customer Link</div>
          <div class="magic-link-url">${esc(magicLink)}</div>
        </div>
        <button onclick="navigator.clipboard.writeText('${esc(magicLink)}').then(()=>this.textContent='Copied!').catch(()=>{})" style="padding:6px 14px;border:1px solid rgba(255,255,255,.5);border-radius:var(--radius-sm);background:rgba(255,255,255,.1);color:#7ab8d4;font-size:var(--text-sm);font-weight:500;cursor:pointer;white-space:nowrap">Copy Link</button>
        <a href="${esc(magicLink)}" target="_blank" style="padding:6px 14px;border:1px solid rgba(255,255,255,.5);border-radius:var(--radius-sm);background:rgba(255,255,255,.1);color:#7ab8d4;font-size:var(--text-sm);font-weight:500;text-decoration:none;white-space:nowrap">Preview →</a>
      </div>` : ''}
      ${cq.notes ? `<p style="font-size:var(--text-sm);color:var(--color-text-secondary);margin-top:var(--space-2)">${esc(cq.notes)}</p>` : ''}
    </div>`;
  }).join('');
}

// ── Link quote modals (existing, preserved) ───────────────────────────────────

async function openLinkSupplierQuoteModal() {
  const { data: quotes } = await supabaseClient
    .from('supplier_quotes').select('id,product,fob_price_usd,contacts(company_name)').eq('status','active').order('created_at', { ascending: false });
  const opts = (quotes || []).map(q =>
    `<option value="${esc(q.id)}">${esc(q.contacts?.company_name || '?')} — ${esc(q.product)} — $${fmt(q.fob_price_usd)}/MT</option>`
  ).join('');
  showLinkModal('Link Supplier Quote', `
    <div class="form-group"><label class="form-label">Select Supplier Quote</label>
      <select class="form-select" id="link-sq-select"><option value="">— Select —</option>${opts}</select>
    </div>
    <div id="link-sq-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
    <div style="display:flex;gap:var(--space-3);margin-top:var(--space-4)">
      <button class="btn btn-primary" onclick="submitLinkSupplierQuote()">Link Quote</button>
      <button class="btn btn-ghost" onclick="closeLinkModal()">Cancel</button>
    </div>
    <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-3)">
      Or <a href="../quotes/index.html" style="color:var(--color-accent)">view all supplier quotes</a>.</p>`);
}

async function submitLinkSupplierQuote() {
  const id = document.getElementById('link-sq-select').value;
  const al = document.getElementById('link-sq-alert');
  if (!id) { al.style.display='block'; al.className='alert alert-error'; al.textContent='Select a quote.'; return; }
  const { error } = await supabaseClient.from('supplier_quotes').update({ rfq_id: _rfqId }).eq('id', id);
  if (error) { al.style.display='block'; al.className='alert alert-error'; al.textContent='Failed: '+error.message; return; }
  closeLinkModal();
  renderCostsTab();
}

async function openLinkLogisticsQuoteModal() {
  const { data: quotes } = await supabaseClient
    .from('logistics_quotes').select('id,origin_country,destination_country,price_per_mt_usd,price_flat_gbp,pricing_type,contacts(company_name)').eq('status','active').order('created_at', { ascending: false });
  const opts = (quotes || []).map(q => {
    const route = [q.origin_country, q.destination_country].filter(Boolean).join(' → ');
    const price = q.pricing_type === 'flat' ? `£${fmt(q.price_flat_gbp)} flat` : `$${fmt(q.price_per_mt_usd)}/MT`;
    return `<option value="${esc(q.id)}">${esc(q.contacts?.company_name || '?')} — ${esc(route)} — ${price}</option>`;
  }).join('');
  showLinkModal('Link Logistics Quote', `
    <div class="form-group"><label class="form-label">Select Logistics Quote</label>
      <select class="form-select" id="link-lq-select"><option value="">— Select —</option>${opts}</select>
    </div>
    <div id="link-lq-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
    <div style="display:flex;gap:var(--space-3);margin-top:var(--space-4)">
      <button class="btn btn-primary" onclick="submitLinkLogisticsQuote()">Link Quote</button>
      <button class="btn btn-ghost" onclick="closeLinkModal()">Cancel</button>
    </div>
    <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-3)">
      Or <a href="../logistics-quotes/index.html" style="color:var(--color-accent)">view all logistics quotes</a>.</p>`);
}

async function submitLinkLogisticsQuote() {
  const id = document.getElementById('link-lq-select').value;
  const al = document.getElementById('link-lq-alert');
  if (!id) { al.style.display='block'; al.className='alert alert-error'; al.textContent='Select a quote.'; return; }
  const { error } = await supabaseClient.from('logistics_quotes').update({ rfq_id: _rfqId }).eq('id', id);
  if (error) { al.style.display='block'; al.className='alert alert-error'; al.textContent='Failed: '+error.message; return; }
  closeLinkModal();
  renderCostsTab();
}

// ── Modal helpers ─────────────────────────────────────────────────────────────

let _linkModalEl = null;
function showLinkModal(title, body) {
  if (_linkModalEl) _linkModalEl.remove();
  _linkModalEl = document.createElement('div');
  _linkModalEl.className = 'modal-overlay open';
  _linkModalEl.innerHTML = `<div class="modal-box" style="max-width:500px">
    <button class="modal-close" onclick="closeLinkModal()">✕</button>
    <h3>${esc(title)}</h3>${body}</div>`;
  document.body.appendChild(_linkModalEl);
}
function closeLinkModal() { if (_linkModalEl) { _linkModalEl.remove(); _linkModalEl = null; } }

const _dynModals = {};
function showDynModal(id, title, body) {
  if (_dynModals[id]) _dynModals[id].remove();
  const el = document.createElement('div');
  el.className = 'modal-overlay open';
  el.id = id;
  el.innerHTML = `<div class="modal-box" style="max-width:640px;max-height:90vh;overflow-y:auto">
    <button class="modal-close" onclick="closeDynModal('${esc(id)}')">✕</button>
    <h3 style="margin-bottom:var(--space-4)">${esc(title)}</h3>${body}</div>`;
  _dynModals[id] = el;
  document.body.appendChild(el);
}
function closeDynModal(id) { if (_dynModals[id]) { _dynModals[id].remove(); delete _dynModals[id]; } }

// ── Shared actions ────────────────────────────────────────────────────────────

async function updateStatus(id, status) {
  await supabaseClient.from('rfq_submissions').update({ status }).eq('id', id);
  if (_rfqData) _rfqData.status = status;
}

async function saveNotes(id) {
  const notes = document.getElementById('notes-field')?.value;
  if (notes != null) await supabaseClient.from('rfq_submissions').update({ notes }).eq('id', id);
}

async function updateCqStatus(id, status) {
  const updates = { status };
  if (status === 'sent')     updates.sent_date     = new Date().toISOString().split('T')[0];
  if (status === 'accepted') updates.response_date = new Date().toISOString().split('T')[0];
  const { error } = await supabaseClient.from('customer_quotes').update(updates).eq('id', id);
  if (error) { showAlert('Update failed: ' + error.message, 'error'); return; }
  // Reflect accepted/responded status on the RFQ itself
  if (status === 'accepted' && _rfqData) {
    await supabaseClient.from('rfq_submissions').update({ status: 'accepted' }).eq('id', _rfqId);
    _rfqData.status = 'accepted';
  } else if (status === 'rejected' && _rfqData && _rfqData.status !== 'accepted') {
    await supabaseClient.from('rfq_submissions').update({ status: 'responded' }).eq('id', _rfqId);
    _rfqData.status = 'responded';
  }
  renderCustomerTab();
}

function showAlert(msg, type = 'info') {
  const existing = document.getElementById('rfq-alert-inline');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'rfq-alert-inline';
  el.className = `alert alert-${type === 'error' ? 'error' : 'success'}`;
  el.textContent = msg;
  el.style.marginBottom = 'var(--space-4)';
  const detail = document.getElementById('rfq-detail');
  if (detail) detail.prepend(el);
  setTimeout(() => el.remove(), 4000);
}

function field(label, value) {
  return `<div><p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:4px">${label}</p><p style="font-size:var(--text-sm);color:var(--color-text-primary)">${value||'—'}</p></div>`;
}

// ── Convert customer quote to order (unchanged) ───────────────────────────────

async function openConvertOrderModal(quoteId) {
  const container = document.getElementById('convert-order-form-container');
  container.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">Loading…</p>';
  document.getElementById('convert-order-modal').classList.add('open');

  const [{ data: cq }, { data: buyers }] = await Promise.all([
    supabaseClient.from('customer_quotes').select('*, product_line:product_lines(id,name)').eq('id', quoteId).single(),
    supabaseClient.from('contacts').select('id, company_name').eq('type','buyer').order('company_name'),
  ]);

  if (!cq) { container.innerHTML = '<div class="alert alert-error">Quote not found.</div>'; return; }

  const totalGBP    = cq.total_gbp ?? (cq.sell_price_per_mt_gbp && cq.quantity_mt ? (cq.sell_price_per_mt_gbp * cq.quantity_mt).toFixed(2) : '');
  const productName = cq.product_line?.name || cq.customer_company || '';
  const rfqCompany  = (_rfqData?.company || '').toLowerCase();
  const matchedBuyer = (buyers || []).find(b => b.company_name.toLowerCase().includes(rfqCompany) || rfqCompany.includes(b.company_name.toLowerCase()));
  const buyerOptions = (buyers || []).map(b => `<option value="${esc(b.id)}" ${matchedBuyer && b.id === matchedBuyer.id ? 'selected' : ''}>${esc(b.company_name)}</option>`).join('');

  container.innerHTML = `
    <form id="convert-order-form" onsubmit="submitConvertOrder(event,'${esc(quoteId)}')">
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Buyer <span style="color:var(--color-danger)">*</span></label>
          <select class="form-select" id="co-buyer" required><option value="">— Select buyer —</option>${buyerOptions}</select>
          ${!matchedBuyer ? `<span style="font-size:var(--text-xs);color:var(--color-text-muted)">No contact matched "${esc(_rfqData?.company||'')}". <a href="../contacts/index.html" style="color:var(--color-accent)" target="_blank">Add contact</a> if needed.</span>` : ''}
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Customer PO Reference <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-input" id="co-po-ref" required placeholder="The buyer's own PO number" />
        </div>
        <div class="form-group">
          <label class="form-label">Product</label>
          <input type="text" class="form-input" id="co-product" value="${esc(productName)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Quantity</label>
          <div style="display:flex;gap:var(--space-2)">
            <input type="number" class="form-input" id="co-qty" value="${cq.quantity_mt ?? ''}" step="any" min="0" style="flex:1" />
            <select class="form-select" id="co-qty-unit" style="width:100px;flex-shrink:0">
              ${['MT','kg','pieces','m','m²'].map(u => `<option value="${u}" ${(cq.quantity_unit||'MT')===u?'selected':''}>${u}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Agreed Sell Price (£ total)</label>
          <input type="number" class="form-input" id="co-price" value="${totalGBP}" step="0.01" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Payment Terms</label>
          <input type="text" class="form-input" id="co-payment-terms" value="${esc(cq.payment_terms||'')}" placeholder="e.g. 30 days from invoice" />
        </div>
      </div>
      <div id="co-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-3)">The order will be created in draft — add remaining details and documents in the order screen before submitting for verification.</p>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Create Draft Order</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('convert-order-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;
}

async function submitConvertOrder(e, quoteId) {
  e.preventDefault();
  const alertEl  = document.getElementById('co-alert');
  const btn      = e.target.querySelector('button[type="submit"]');
  const buyerId  = document.getElementById('co-buyer').value;
  const poRef    = document.getElementById('co-po-ref').value.trim();
  const product  = document.getElementById('co-product').value.trim() || null;
  const qty      = parseFloat(document.getElementById('co-qty').value)      || null;
  const qtyUnit  = document.getElementById('co-qty-unit')?.value            || 'MT';
  const price    = parseFloat(document.getElementById('co-price').value) || null;
  const terms    = document.getElementById('co-payment-terms').value.trim() || null;

  if (!buyerId || !poRef) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent='Buyer and customer PO reference are required.'; return;
  }

  btn.disabled = true; btn.textContent = 'Creating order…';
  alertEl.style.display = 'none';

  try {
    const actorId   = (await supabaseClient.auth.getUser()).data?.user?.id;
    const reference = generateOrderReference();

    const { data: cq } = await supabaseClient.from('customer_quotes')
      .select('product_line_id, supplier_quote_id').eq('id', quoteId).single();

    const tradePayload = {
      reference,
      buyer_id:              buyerId,
      product_line_id:       cq?.product_line_id || null,
      product:               product,
      quantity_mt:           qtyUnit === 'MT' ? qty : null,
      quantity_unit:         qtyUnit,
      sell_price_gbp:        price,
      customer_po_reference: poRef,
      payment_terms:         terms,
      rfq_id:                _rfqId,
      customer_quote_id:     quoteId,
      current_state:         'order_drafted',
      status:                'enquiry',
    };

    const { data: trade, error: tradeErr } = await supabaseClient.from('trades').insert(tradePayload).select('id').single();
    if (tradeErr) throw new Error(tradeErr.message);

    const tid = trade?.id;
    if (!tid) throw new Error('Trade was not created — no ID returned.');

    await supabaseClient.from('customer_quotes').update({ status: 'accepted', response_date: new Date().toISOString().split('T')[0] }).eq('id', quoteId);

    await supabaseClient.from('order_events').insert({
      trade_id: tid, event_type: 'state_change', from_state: null, to_state: 'order_drafted',
      actor_id: actorId, actor_role: 'sales', notes: `Created as draft from customer quote ${quoteId} — RFQ ${_rfqId}`,
    });

    window.location.href = `../orders/detail.html?id=${tid}`;
  } catch (err) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent = err.message;
    btn.disabled = false; btn.textContent = 'Create Order & Submit for Verification';
  }
}

// ── Auto-detect page ──────────────────────────────────────────────────────────

if (document.getElementById('rfq-table-body')) {
  (async () => { const u = await getCurrentUser(); const el = document.getElementById('user-email'); if (el) el.textContent = u?.email || ''; loadRfqs(); })();
}
if (document.getElementById('rfq-detail') !== null) {
  (async () => { const u = await getCurrentUser(); const el = document.getElementById('user-email'); if (el) el.textContent = u?.email || ''; loadRfqDetail(); })();
}
