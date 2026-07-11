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
  const colours = { new:'badge-accent', reviewing:'badge-info', quoted:'badge-warning', responded:'badge-neutral', accepted:'badge-success', closed:'badge-neutral' };
  const labels  = { new:'New', reviewing:'In Progress', quoted:'Quoted', responded:'Quote Declined', accepted:'Converted', closed:'Closed' };
  return `<span class="badge ${colours[s]||'badge-neutral'}">${labels[s] || esc(s)}</span>`;
}
function refreshRfqStatusBadge() {
  const el = document.getElementById('rfq-status-display');
  if (el && _rfqData) el.innerHTML = statusBadge(_rfqData.status);
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

// ── List page — New RFQ (multi-step) ─────────────────────────────────────────

let _nrfqContact = null;
let _nrfqTimer   = null;

async function openNewRfqModal() {
  _nrfqContact = null;
  clearTimeout(_nrfqTimer);

  ['nrfq-new-company','nrfq-new-contact','nrfq-new-email','nrfq-new-phone','nrfq-new-country']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const searchEl = document.getElementById('nrfq-search');
  if (searchEl) searchEl.value = '';
  const resultsEl = document.getElementById('nrfq-search-results');
  if (resultsEl) resultsEl.innerHTML = '';
  const newAlert = document.getElementById('nrfq-new-alert');
  if (newAlert) newAlert.style.display = 'none';
  document.getElementById('new-rfq-form')?.reset();
  const alertEl = document.getElementById('new-rfq-alert');
  if (alertEl) alertEl.style.display = 'none';

  const params    = new URLSearchParams(location.search);
  const contactId = params.get('contact_id');

  if (contactId) {
    const { data: c } = await supabaseClient
      .from('contacts')
      .select('id,company_name,primary_contact_name,email,phone,country')
      .eq('id', contactId)
      .single();
    if (c) { _nrfqContact = c; nrfqRenderCustomerCard(); nrfqShowStep('rfq'); }
    else   { nrfqShowStep('start'); }
  } else {
    nrfqShowStep('start');
  }

  document.getElementById('new-rfq-modal').classList.add('open');
}

function closeNewRfqModal() {
  document.getElementById('new-rfq-modal').classList.remove('open');
}

function nrfqShowStep(step) {
  ['start','existing','new','rfq'].forEach(s => {
    const el = document.getElementById(`nrfq-step-${s}`);
    if (el) el.style.display = s === step ? '' : 'none';
  });
  const titles = {
    start:    'New RFQ',
    existing: 'New RFQ — Select Customer',
    new:      'New RFQ — New Customer',
    rfq:      'New RFQ — Enquiry Details',
  };
  const t = document.getElementById('nrfq-modal-title');
  if (t) t.textContent = titles[step] || 'New RFQ';
}

function nrfqSearchCustomers(q) {
  clearTimeout(_nrfqTimer);
  const resultsEl = document.getElementById('nrfq-search-results');
  if (!q || q.trim().length < 2) { resultsEl.innerHTML = ''; return; }
  _nrfqTimer = setTimeout(async () => {
    resultsEl.innerHTML = '<p style="font-size:var(--text-sm);color:var(--color-text-muted);padding:var(--space-3)">Searching…</p>';
    const term = q.trim();
    const { data } = await supabaseClient
      .from('contacts')
      .select('id,company_name,primary_contact_name,email,phone,country')
      .eq('type', 'buyer')
      .or(`company_name.ilike.%${term}%,primary_contact_name.ilike.%${term}%`)
      .order('company_name')
      .limit(10);
    if (!data || data.length === 0) {
      resultsEl.innerHTML = '<p style="font-size:var(--text-sm);color:var(--color-text-muted);padding:var(--space-3)">No customers found.</p>';
      return;
    }
    resultsEl.innerHTML = data.map(c => `
      <button type="button"
        onclick="nrfqSelectContact('${esc(c.id)}')"
        data-cid="${esc(c.id)}"
        data-company="${esc(c.company_name)}"
        data-contact="${esc(c.primary_contact_name||'')}"
        data-email="${esc(c.email||'')}"
        data-phone="${esc(c.phone||'')}"
        data-country="${esc(c.country||'')}"
        style="display:block;width:100%;text-align:left;padding:var(--space-3) var(--space-4);border:none;border-bottom:1px solid var(--color-border);background:var(--color-white);cursor:pointer;font-size:var(--text-sm)">
        <strong>${esc(c.company_name)}</strong>
        ${c.primary_contact_name ? `<span style="color:var(--color-text-muted);margin-left:var(--space-2)">${esc(c.primary_contact_name)}</span>` : ''}
        ${c.email ? `<span style="display:block;font-size:var(--text-xs);color:var(--color-text-muted);margin-top:2px">${esc(c.email)}</span>` : ''}
      </button>`).join('');
  }, 300);
}

function nrfqSelectContact(id) {
  const btn = document.querySelector(`[data-cid="${id}"]`);
  if (!btn) return;
  _nrfqContact = {
    id,
    company_name:         btn.dataset.company,
    primary_contact_name: btn.dataset.contact,
    email:                btn.dataset.email,
    phone:                btn.dataset.phone,
    country:              btn.dataset.country,
  };
  nrfqRenderCustomerCard();
  nrfqShowStep('rfq');
}

async function nrfqCreateCustomer() {
  const alertEl = document.getElementById('nrfq-new-alert');
  alertEl.style.display = 'none';
  const company = document.getElementById('nrfq-new-company').value.trim();
  const contact = document.getElementById('nrfq-new-contact').value.trim();
  const email   = document.getElementById('nrfq-new-email').value.trim();
  if (!company || !contact || !email) {
    alertEl.textContent = 'Company name, contact name and email are required.';
    alertEl.style.display = 'block'; return;
  }
  const btn = document.getElementById('nrfq-new-btn');
  btn.disabled = true; btn.textContent = 'Creating…';
  const { data, error } = await supabaseClient.from('contacts').insert([{
    company_name:         company,
    primary_contact_name: contact,
    email,
    phone:   document.getElementById('nrfq-new-phone').value.trim()    || null,
    country: document.getElementById('nrfq-new-country').value.trim()  || null,
    type:    'buyer',
    status:  'active',
  }]).select('id,company_name,primary_contact_name,email,phone,country').single();
  btn.disabled = false; btn.textContent = 'Add Customer & Continue →';
  if (error) {
    alertEl.textContent = 'Failed to create customer: ' + error.message;
    alertEl.style.display = 'block'; return;
  }
  _nrfqContact = data;
  nrfqRenderCustomerCard();
  nrfqShowStep('rfq');
}

function nrfqRenderCustomerCard() {
  const el = document.getElementById('nrfq-customer-card');
  if (!el || !_nrfqContact) return;
  const c = _nrfqContact;
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-weight:600;margin-bottom:var(--space-1)">${esc(c.company_name)}</div>
        ${c.primary_contact_name ? `<div style="font-size:var(--text-sm);color:var(--color-text-muted)">${esc(c.primary_contact_name)}${c.country ? ' · ' + esc(c.country) : ''}</div>` : ''}
        ${c.email ? `<div style="font-size:var(--text-sm);color:var(--color-text-muted)">${esc(c.email)}</div>` : ''}
      </div>
      <button type="button" class="btn btn-ghost btn-sm" onclick="nrfqShowStep('start')" style="flex-shrink:0">Change</button>
    </div>`;
}

async function submitNewRfq(e) {
  e.preventDefault();
  const alertEl = document.getElementById('new-rfq-alert');
  const btn     = document.getElementById('new-rfq-btn');

  if (!_nrfqContact) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'No customer selected. Go back and select or create a customer.'; return;
  }

  btn.disabled = true; btn.textContent = 'Creating…';
  alertEl.style.display = 'none';

  const c = _nrfqContact;
  const { data, error } = await supabaseClient.from('rfq_submissions').insert([{
    contact_id:  c.id,
    name:        c.primary_contact_name || c.company_name,
    company:     c.company_name,
    email:       c.email   || null,
    phone:       c.phone   || null,
    type:        'buyer',
    product:     document.getElementById('nrfq-product').value.trim() || null,
    quantity_mt: parseFloat(document.getElementById('nrfq-qty').value) || null,
    message:     document.getElementById('nrfq-message').value.trim() || null,
    status:      'reviewing',
  }]).select('id').single();

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
    btn.disabled = false; btn.textContent = 'Create RFQ'; return;
  }

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
let _linkedContact   = null; // address details of the linked customer record, if any
let _allProductLines = [];
let _activeTab       = 'enquiry';
let _quoteLines      = [];   // working copy of line items in build tab
let _activeCqId      = null; // customer_quote id being edited/built

// rfq_lines state
let _rfqLines = [];

// Enquiry product-confirm state
let _enquiryAltPickerOpen = false; // whether the "choose different" dropdown is visible

// Pricing calculator state
let _costsSqList        = [];
let _costsLqList        = [];
let _scenarioSupplierId = null;  // selected supplier UUID for multi-line pricing
let _pricedLines        = [];    // calculated results per rfq_line
let _calc = { pl: null, sqData: null, lqData: null, overheadTotal: 0, qty: 0, fx: 1.27, ins: 0.5, minMargin: 5, model: 'standard' };
let _calcApplied    = null; // pre-fill data passed to renderBuildTab (object OR array)
let _quoteCurrency  = 'GBP'; // customer-facing quote currency; set on Build Quote tab
let _costsLocked    = false; // true once a quote has been issued (quoted/accepted/etc.)

// ── Tab management ────────────────────────────────────────────────────────────

function switchTab(name) {
  _activeTab = name;
  document.querySelectorAll('.tab-btn').forEach((btn, i) => {
    const tabs = ['enquiry','costs','build','customer','summary'];
    btn.classList.toggle('active', tabs[i] === name);
  });
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${name}`)?.classList.add('active');

  if (name === 'costs')    renderCostsTab();
  if (name === 'summary')  renderSummaryTab(); // async — intentionally not awaited
  if (name === 'build')    renderBuildTab();
  if (name === 'customer') renderCustomerTab();
}

// ── Detail page — init ────────────────────────────────────────────────────────

async function loadRfqDetail() {
  _rfqId = new URLSearchParams(window.location.search).get('id');
  if (!_rfqId) { document.getElementById('rfq-detail').innerHTML = '<div class="alert alert-error">No ID provided</div>'; return; }

  const [{ data, error }, { data: pls }, { data: lines }] = await Promise.all([
    supabaseClient.from('rfq_submissions').select('*').eq('id', _rfqId).single(),
    supabaseClient.from('product_lines').select('id,name,cn_code,physical_form,standard_sell_price_gbp,standard_sell_price_usd,market_reference_price_gbp,market_reference_price_usd,default_markup_pct,vat_rate,insurance_pct').eq('active', true).order('name'),
    supabaseClient.from('rfq_lines').select('*, product_lines(name,physical_form)').eq('rfq_id', _rfqId).order('line_number'),
  ]);

  if (error || !data) { document.getElementById('rfq-detail').innerHTML = '<div class="alert alert-error">Record not found</div>'; return; }
  _rfqData         = data;
  _allProductLines = pls || [];
  _rfqLines        = lines || [];

  // Delivery address comes from the linked customer record — rfq_submissions
  // itself has no address fields.
  _linkedContact = null;
  if (data.contact_id) {
    const { data: contact } = await supabaseClient.from('contacts')
      .select('address_line_1,address_line_2,city,postcode,country')
      .eq('id', data.contact_id).single();
    _linkedContact = contact || null;
  }

  // Restore last-used pricing calculator settings for this RFQ (persisted so they
  // survive navigating away and back — see savePricingSettings()).
  _scenarioSupplierId = data.pricing_scenario_supplier_id || null;
  _calc.savedLqId      = data.pricing_logistics_quote_id || null;
  _calc.fx              = data.pricing_fx_rate ?? _calc.fx;
  _calc.ins             = data.pricing_insurance_pct ?? _calc.ins;
  _calc.model           = data.pricing_model || _calc.model;
  _calc.savedMargin     = data.pricing_margin_pct ?? null;

  document.getElementById('rfq-title').textContent = `${data.company} — ${fmtDate(data.created_at)}`;
  refreshRfqStatusBadge();

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
  _enquiryAltPickerOpen = false;
  const data     = _rfqData;
  const isLinked = !!data.contact_id;

  const el = document.getElementById('rfq-detail');
  el.innerHTML = `

    <!-- ── Section 1: Customer Details ─────────────────────────────────────── -->
    <div class="panel" style="margin-bottom:var(--space-4)">
      <div class="panel-body">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-5)">
          <h4 style="margin:0">Customer Details</h4>
          ${isLinked ? `
          <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;background:rgba(22,163,74,0.1);border:1px solid rgba(22,163,74,0.25);border-radius:var(--radius);font-size:var(--text-xs);font-weight:600;color:#16a34a">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            Existing Customer
          </span>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-5);margin-bottom:var(--space-5)">
          ${field('Name', data.name)}${field('Company', data.company)}
          ${field('Email', `<a href="mailto:${esc(data.email)}" style="color:var(--color-accent)">${esc(data.email)}</a>`)}${field('Phone', data.phone)}
          ${field('Country', data.country)}${field('Type', data.type)}
        </div>
        <div style="margin-bottom:var(--space-5)">
          ${field('Delivery / Registered Address', formatDeliveryAddress(isLinked, _linkedContact, data.contact_id))}
        </div>
        <div style="display:flex;gap:var(--space-3)">
          ${isLinked
            ? `<a href="../customers/detail.html?id=${esc(data.contact_id)}" class="btn btn-secondary btn-sm">View Customer Record →</a>`
            : `<a href="../customers/index.html?prefill=1&name=${encodeURIComponent(data.name)}&company=${encodeURIComponent(data.company)}&email=${encodeURIComponent(data.email)}&phone=${encodeURIComponent(data.phone||'')}&type=${encodeURIComponent(data.type)}" class="btn btn-secondary btn-sm">+ Create Customer</a>`
          }
        </div>
      </div>
    </div>

    <!-- ── Section 2: Product Requested ────────────────────────────────────── -->
    <div class="panel" style="margin-bottom:var(--space-4)">
      <div class="panel-body">
        <h4 style="margin:0 0 var(--space-5) 0">Product Requested</h4>

        <!-- What the customer asked for (read-only) -->
        <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:var(--space-4) var(--space-5);margin-bottom:var(--space-4)">
          <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-3)">Customer Request</p>
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4)">
            <p style="margin:0;font-size:var(--text-sm);color:var(--color-text-primary);flex:1">${esc(data.product)||'u{2014}'}</p>
            ${data.quantity_mt != null ? `<span class="badge badge-neutral" style="flex-shrink:0">${fmt(data.quantity_mt, 0)} ${esc(data.quantity_unit||'MT')}</span>` : ''}
          </div>
          ${data.specifications ? `<div style="margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--color-border)"><p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-2)">Specification / Requirements</p><p style="font-size:var(--text-sm);margin:0;white-space:pre-wrap;color:var(--color-text-primary)">${esc(data.specifications)}</p></div>` : ''}
        </div>

        <!-- Suggest/confirm/add flow (populated by renderProductMatchSection) -->
        <div id="rfq-product-match"></div>

        <!-- Quote lines (populated after product is confirmed and added) -->
        <div id="rfq-lines-section"></div>
      </div>
    </div>

    <!-- ── Section 3: Notes ─────────────────────────────────────────────────── -->
    <div class="panel" style="margin-bottom:var(--space-6)">
      <div class="panel-body">
        <h4 style="margin:0 0 var(--space-5) 0">Notes</h4>
        ${data.message ? `
        <div style="margin-bottom:var(--space-5)">
          <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-2)">Customer Message</p>
          <p style="font-size:var(--text-sm);background:var(--color-surface);border-radius:var(--radius);padding:var(--space-3) var(--space-4);white-space:pre-wrap">${esc(data.message)}</p>
        </div>` : ''}
        <div>
          <label class="form-label">Internal Notes</label>
          <textarea class="form-textarea" id="notes-field" onblur="saveNotes('${esc(_rfqId)}')" placeholder="Add internal notes…">${esc(data.notes||'')}</textarea>
          <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-2)">Notes auto-save on blur.</p>
        </div>
      </div>
    </div>

    <!-- ── CTA ──────────────────────────────────────────────────────────────── -->
    <div style="display:flex;justify-content:flex-end">
      <button class="btn btn-primary" onclick="switchTab('costs')">Continue to Cost Inputs →</button>
    </div>
  `;

  await loadRfqLines();
}

// ── Tab 1: RFQ Lines ─────────────────────────────────────────────────────────

const QUANTITY_UNITS = ['MT', 'kg', 'pieces', 'm', 'm²'];

async function loadRfqLines() {
  const { data, error } = await supabaseClient
    .from('rfq_lines')
    .select('*, product_lines(name,physical_form)')
    .eq('rfq_id', _rfqId)
    .order('line_number');

  if (!error) _rfqLines = data || [];
  renderRfqLinesSection(_rfqLines);
  renderProductMatchSection();
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
  }]).select('*, product_lines(name,physical_form)').single();

  if (!error && data) {
    _rfqLines = [data];
    if (_rfqData?.status === 'new') {
      await supabaseClient.from('rfq_submissions').update({ status: 'reviewing' }).eq('id', _rfqId);
      _rfqData.status = 'reviewing';
      refreshRfqStatusBadge();
    }
  }
  renderRfqLinesSection(_rfqLines);
}

// ── Enquiry: product suggest → confirm → add flow ─────────────────────────────

function renderProductMatchSection() {
  const el = document.getElementById('rfq-product-match');
  if (!el) return;

  // Once lines exist the flow is complete — hide the UI
  if (_rfqLines.length > 0) { el.innerHTML = ''; return; }

  // Compute suggestion from rfq_data + product lines catalogue
  const productText = (_rfqData?.product || '').toLowerCase();
  const matchedPl   = productText
    ? _allProductLines.reduce((best, pl) => {
        const score = scorePlMatch(pl.name, productText);
        return score > (best?._score ?? 0) ? { ...pl, _score: score } : best;
      }, null)
    : null;
  const suggestedPl = matchedPl && matchedPl._score > 0 ? matchedPl : null;

  // ── State: alt picker open ────────────────────────────────────────────────
  if (_enquiryAltPickerOpen) {
    const opts = _allProductLines.map(pl =>
      `<option value="${esc(pl.id)}">${esc(pl.name)}</option>`
    ).join('');
    el.innerHTML = `
      <div style="border:1px solid var(--color-border);border-radius:var(--radius);padding:var(--space-4) var(--space-5);margin-bottom:var(--space-4)">
        <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-3)">Select Product Line</p>
        <div style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap">
          <select class="form-select" id="alt-pl-select" style="flex:1;min-width:200px">
            <option value="">— Choose a product line —</option>
            ${opts}
          </select>
          <button class="btn btn-primary btn-sm" id="enquiry-confirm-add-btn" onclick="enquiryConfirmAltAndAdd()">Confirm &amp; Add to Quote →</button>
          ${suggestedPl ? `<button type="button" class="btn btn-ghost btn-sm" onclick="enquiryCloseAltPicker()">← Back to suggestion</button>` : ''}
        </div>
      </div>`;
    return;
  }

  // ── State: auto-suggestion available ─────────────────────────────────────
  if (suggestedPl) {
    const pl = suggestedPl;
    el.innerHTML = `
      <div style="background:#0a1728;border-radius:var(--radius);padding:var(--space-4) var(--space-5);margin-bottom:var(--space-4)">
        <p style="font-size:var(--text-xs);color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.08em;margin-bottom:var(--space-3)">Suggested Product Line</p>
        <div style="font-weight:600;font-size:var(--text-base);color:#ffffff;margin-bottom:var(--space-3)">${esc(pl.name)}</div>
        <div style="display:flex;gap:var(--space-5);flex-wrap:wrap;margin-bottom:var(--space-4);font-size:var(--text-sm)">
          ${pl.standard_sell_price_usd ? `<span style="color:rgba(255,255,255,.7)">Standard: <strong style="color:#7ab8d4">$${fmt(pl.standard_sell_price_usd)}/MT</strong></span>` : ''}
          ${pl.market_reference_price_usd ? `<span style="color:rgba(255,255,255,.7)">Market ref: <strong style="color:#ffffff">$${fmt(pl.market_reference_price_usd)}/MT</strong></span>` : ''}
          ${pl.default_markup_pct != null ? `<span style="color:rgba(255,255,255,.7)">Default margin: <strong style="color:#ffffff">${fmt(pl.default_markup_pct, 1)}%</strong></span>` : ''}
        </div>
        <div style="display:flex;gap:var(--space-3);flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" id="enquiry-confirm-add-btn" onclick="enquiryConfirmAndAddLine('${esc(pl.id)}')">Confirm &amp; Add to Quote →</button>
          <button type="button" style="display:inline-flex;align-items:center;padding:6px 14px;border:1px solid rgba(255,255,255,.4);border-radius:var(--radius-sm);background:transparent;color:#ffffff;font-size:var(--text-sm);cursor:pointer;font-family:var(--font-body)" onclick="enquiryShowAltPicker()">Choose different →</button>
        </div>
      </div>`;
    return;
  }

  // ── State: no match — prompt to select ───────────────────────────────────
  const opts = _allProductLines.map(pl =>
    `<option value="${esc(pl.id)}">${esc(pl.name)}</option>`
  ).join('');
  el.innerHTML = `
    <div style="border:1px solid var(--color-border);border-radius:var(--radius);padding:var(--space-4) var(--space-5);margin-bottom:var(--space-4)">
      <p style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-3)">No product line could be matched automatically. Please select from the catalogue.</p>
      <div style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap">
        <select class="form-select" id="alt-pl-select" style="flex:1;min-width:200px">
          <option value="">— Choose a product line —</option>
          ${opts}
        </select>
        <button class="btn btn-primary btn-sm" id="enquiry-confirm-add-btn" onclick="enquiryConfirmAltAndAdd()">Confirm &amp; Add to Quote →</button>
      </div>
    </div>`;
}

function enquiryShowAltPicker() {
  _enquiryAltPickerOpen = true;
  renderProductMatchSection();
}

function enquiryCloseAltPicker() {
  _enquiryAltPickerOpen = false;
  renderProductMatchSection();
}

function enquiryConfirmAltAndAdd() {
  const sel = document.getElementById('alt-pl-select');
  if (!sel?.value) return;
  enquiryConfirmAndAddLine(sel.value);
}

async function enquiryConfirmAndAddLine(plId) {
  const pl = _allProductLines.find(p => p.id === plId) || null;
  if (!pl) return;
  const btn = document.getElementById('enquiry-confirm-add-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }

  const { data, error } = await supabaseClient.from('rfq_lines').insert([{
    rfq_id:              _rfqId,
    line_number:         _rfqLines.length + 1,
    product_line_id:     pl.id,
    description:         _rfqData.product || pl.name,
    grade_specification: _rfqData.specifications || null,
    quantity:            _rfqData.quantity_mt || null,
    quantity_unit:       _rfqData.quantity_unit || 'MT',
    is_alternative:      false,
    source:              'initial_enquiry',
  }]).select('*, product_lines(name,physical_form)').single();

  if (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Confirm & Add to Quote →'; }
    showAlert('Could not add line: ' + error.message, 'error');
    return;
  }

  _rfqLines.push(data);
  if (_rfqData?.status === 'new') {
    await supabaseClient.from('rfq_submissions').update({ status: 'reviewing' }).eq('id', _rfqId);
    _rfqData.status = 'reviewing';
    refreshRfqStatusBadge();
  }
  _enquiryAltPickerOpen = false;
  renderRfqLinesSection(_rfqLines);
  renderProductMatchSection();
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
          <th>Product</th>
          <th style="width:100px">Type</th>
          <th>Specification</th>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit</th>
          <th></th>
        </tr></thead>
        <tbody>${lines.map(l => `<tr>
          <td style="font-weight:600;color:var(--color-text-muted)">${l.line_number}${l.is_alternative ? ' <span class="badge badge-info" style="font-size:10px">Alt</span>' : ''}</td>
          <td style="font-size:var(--text-sm)">${esc(l.product_lines?.name || '—')}</td>
          <td style="font-size:var(--text-sm);color:${l.product_type ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}">${esc(l.product_type || l.product_lines?.physical_form || '—')}${!l.product_type && l.product_lines?.physical_form ? ' <span style="font-size:9px;color:var(--color-text-muted)">(default)</span>' : ''}</td>
          <td style="font-size:var(--text-sm);color:var(--color-text-muted)">${esc(l.grade_specification || '—')}</td>
          <td style="font-weight:500">${esc(l.description)}</td>
          <td>${l.quantity != null ? fmt(l.quantity, l.quantity_unit === 'MT' ? 3 : 0) : '—'}</td>
          <td>${esc(l.quantity_unit || 'MT')}</td>
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
          <label class="form-label">Specification</label>
          <input type="text" class="form-input" id="${formId}-grade" value="${esc(l.grade_specification || '')}" placeholder="e.g. 316/316L, EN 10088" />
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <input type="text" class="form-input" id="${formId}-type" list="physical-form-options" value="${esc(l.product_type || '')}" placeholder="e.g. Ingot, Bar, Rod, Powder" />
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">Leave blank to use the product line's default type</span>
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
  const { data, error } = await supabaseClient.from('rfq_lines').insert([payload]).select('*, product_lines(name,physical_form)').single();
  if (error) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent = error.message; btn.disabled=false; btn.textContent='Add Line'; return;
  }
  _rfqLines.push(data);
  if (_rfqData?.status === 'new') {
    await supabaseClient.from('rfq_submissions').update({ status: 'reviewing' }).eq('id', _rfqId);
    _rfqData.status = 'reviewing';
    refreshRfqStatusBadge();
  }
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
  const { data, error } = await supabaseClient.from('rfq_lines').update(payload).eq('id', id).select('*, product_lines(name,physical_form)').single();
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
    product_type:       document.getElementById(`${formId}-type`)?.value.trim() || null,
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
    const { data } = await supabaseClient.from('rfq_lines').select('*, product_lines(name,physical_form)').eq('rfq_id', _rfqId).order('line_number');
    _rfqLines = data || [];
  }

  const [sqRes, lqRes, ohRes] = await Promise.all([
    supabaseClient.from('supplier_quotes')
      .select('id,rfq_line_id,supplier_id,product,specification,pricing_basis,fob_price_usd,price_per_piece,quantity_pieces,quantity_mt,incoterm,validity_date,status,document_path,contacts(company_name)')
      .eq('rfq_id', _rfqId).order('created_at', { ascending: false }),
    supabaseClient.from('logistics_quotes')
      .select('id,origin_country,destination_country,mode,pricing_type,price_per_mt_usd,price_flat_usd,price_flat_gbp,validity_date,status,document_path,contacts(company_name)')
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

  _costsLocked = ['quoted','responded','accepted','closed'].includes(_rfqData?.status);

  renderSupplierQuotesSection(_costsSqList);
  renderLogisticsQuotesSection(_costsLqList);
  renderOverheadCostsSection(ohRes.data || []);
  renderPricingCalculator(_costsSqList, _costsLqList, ohRes.data || []);

  // Show/hide action buttons and lock banner based on quote status
  const banner = document.getElementById('costs-lock-banner');
  if (banner) {
    banner.innerHTML = _costsLocked
      ? `<div style="display:flex;align-items:center;gap:var(--space-3);background:rgba(122,184,212,0.1);border:1px solid var(--color-steel);border-radius:var(--radius);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-5);font-size:var(--text-sm)">
           <span style="font-size:1.1rem">🔒</span>
           <span>A customer quote has been issued for this RFQ. Cost inputs are locked. To revise, re-issue a new quote from the <strong>Build Quote</strong> tab.</span>
         </div>`
      : '';
  }
  ['sq-action-btns','lq-action-btns','oh-action-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = _costsLocked ? 'none' : '';
  });
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
        <td>${_costsLocked ? '' : `<button onclick="deleteSupplierQuote('${esc(q.id)}')" class="btn btn-ghost btn-sm" style="color:var(--color-danger)">Remove</button>`}</td>
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
        <thead><tr><th>Line</th><th>Product</th><th>Spec/Grade</th><th>Price</th><th>Validity</th><th>Status</th><th>Doc</th><th></th></tr></thead>
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
    <thead><tr><th>Provider</th><th>Route</th><th>Mode</th><th>Pricing</th><th>Price</th><th>Validity</th><th>Status</th><th>Doc</th><th></th></tr></thead>
    <tbody>${quotes.map(q => {
      const isFlat = q.pricing_type === 'flat';
      const price  = isFlat
        ? (q.price_flat_usd != null ? `$${fmt(q.price_flat_usd)} flat` : `£${fmt(q.price_flat_gbp)} flat`)
        : `$${fmt(q.price_per_mt_usd)}/MT`;
      return `<tr>
        <td>${esc(q.contacts?.company_name || '—')}</td>
        <td>${esc([q.origin_country, q.destination_country].filter(Boolean).join(' → '))}</td>
        <td>${esc(q.mode || '—')}</td>
        <td><span class="badge badge-neutral">${isFlat ? 'Flat' : 'Per MT'}</span></td>
        <td style="font-family:var(--font-display);font-weight:600">${price}</td>
        <td>${fmtDate(q.validity_date)}</td>
        <td><span class="badge badge-${q.status==='active'?'success':'neutral'}">${esc(q.status)}</span></td>
        <td>${q.document_path ? `<button onclick="downloadDoc('logistics_quotes','${esc(q.document_path)}')" class="btn btn-ghost btn-sm">Download</button>` : '<span style="color:var(--color-text-muted);font-size:var(--text-xs)">None</span>'}</td>
        <td>${_costsLocked ? '' : `<button onclick="deleteLogisticsQuote('${esc(q.id)}')" class="btn btn-ghost btn-sm" style="color:var(--color-danger)">Remove</button>`}</td>
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
    <thead><tr><th>Description</th><th>Amount</th><th>Notes</th><th></th></tr></thead>
    <tbody>${costs.map(c => {
      const isUsd = c.currency === 'USD';
      return `<tr>
        <td>${esc(c.description)}</td>
        <td style="font-family:var(--font-display);font-weight:600">
          ${isUsd ? `$${fmt(c.amount_original ?? c.amount_gbp)}` : `£${fmt(c.amount_gbp)}`}
          ${isUsd ? `<div style="font-size:10px;color:var(--color-text-muted);font-weight:400">≈ £${fmt(c.amount_gbp)}</div>` : ''}
        </td>
        <td style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(c.notes || '—')}</td>
        <td><button onclick="deleteOverhead('${esc(c.id)}')" class="btn btn-ghost btn-sm" style="color:var(--color-danger)">Remove</button></td>
      </tr>`;
    }).join('')}</tbody>
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
              <input type="radio" name="lq-pricing" value="per_mt" onchange="toggleLqPricing(this.value)" /> Per MT (USD)
            </label>
            <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer">
              <input type="radio" name="lq-pricing" value="flat" checked onchange="toggleLqPricing(this.value)" /> Flat fee (USD)
            </label>
          </div>
        </div>
        <div class="form-group" id="lq-price-permt-group" style="display:none">
          <label class="form-label" id="lq-price-label">Price (USD/MT) <span style="color:var(--color-danger)">*</span></label>
          <input type="number" class="form-input" id="lq-price-permt" step="0.01" min="0" />
        </div>
        <div class="form-group" id="lq-price-flat-group">
          <label class="form-label">Flat Fee (USD) <span style="color:var(--color-danger)">*</span></label>
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
  const alert = document.getElementById('add-lq-alert');
  if (alert) alert.style.display = 'none';
}

async function submitAddLogisticsQuote(e) {
  e.preventDefault();
  const alertEl    = document.getElementById('add-lq-alert');
  const btn        = document.getElementById('add-lq-btn');
  const provider   = document.getElementById('lq-provider').value;
  const pricingType = document.querySelector('input[name="lq-pricing"]:checked')?.value || 'flat';
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
      price_flat_usd:     pricingType === 'flat'   ? priceFlat  : null,
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
        <label class="form-label">Currency</label>
        <div style="display:flex;gap:var(--space-4);margin-top:var(--space-2)">
          <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer">
            <input type="radio" name="oh-currency" value="GBP" checked onchange="toggleOhCurrency()" /> GBP (£)
          </label>
          <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer">
            <input type="radio" name="oh-currency" value="USD" onchange="toggleOhCurrency()" /> USD ($)
          </label>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" id="oh-amount-label">Amount (£) <span style="color:var(--color-danger)">*</span></label>
        <input type="number" class="form-input" id="oh-amount" step="0.01" min="0" required oninput="updateOhConversionPreview()" />
        <div id="oh-conversion-preview" style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-1)"></div>
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

function toggleOhCurrency() {
  const currency = document.querySelector('input[name="oh-currency"]:checked')?.value || 'GBP';
  const label = document.getElementById('oh-amount-label');
  if (label) label.innerHTML = currency === 'USD'
    ? 'Amount ($) <span style="color:var(--color-danger)">*</span>'
    : 'Amount (£) <span style="color:var(--color-danger)">*</span>';
  updateOhConversionPreview();
}

function updateOhConversionPreview() {
  const preview  = document.getElementById('oh-conversion-preview');
  if (!preview) return;
  const currency = document.querySelector('input[name="oh-currency"]:checked')?.value || 'GBP';
  const amount   = parseFloat(document.getElementById('oh-amount')?.value);
  if (currency !== 'USD' || !amount) { preview.textContent = ''; return; }
  const fx = _calc.fx || 1.27;
  preview.textContent = `≈ £${fmt(amount / fx)} at £1 = $${fmt(fx, 3)}`;
}

async function submitAddOverhead(e) {
  e.preventDefault();
  const alertEl  = document.getElementById('add-oh-alert');
  const btn      = document.getElementById('add-oh-btn');
  const desc     = document.getElementById('oh-desc').value.trim();
  const currency = document.querySelector('input[name="oh-currency"]:checked')?.value || 'GBP';
  const amount   = parseFloat(document.getElementById('oh-amount').value);
  const notes    = document.getElementById('oh-notes').value.trim() || null;

  if (!desc || !amount) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent='Description and amount are required.'; return;
  }

  const fx        = _calc.fx || 1.27;
  const amountGbp = currency === 'USD' ? amount / fx : amount;

  btn.disabled = true;
  const { error } = await supabaseClient.from('rfq_overhead_costs').insert([{
    rfq_id: _rfqId, description: desc, amount_gbp: amountGbp,
    currency, amount_original: amount, notes,
  }]);
  if (error) {
    alertEl.style.display='block'; alertEl.className='alert alert-error';
    alertEl.textContent = error.message;
    btn.disabled = false; return;
  }
  closeDynModal('add-oh-modal');
  renderCostsTab();
}

async function deleteSupplierQuote(id) {
  if (!confirm('Remove this supplier quote from the RFQ?')) return;
  await supabaseClient.from('supplier_quotes').delete().eq('id', id);
  renderCostsTab();
}

async function deleteLogisticsQuote(id) {
  if (!confirm('Remove this logistics quote from the RFQ?')) return;
  await supabaseClient.from('logistics_quotes').delete().eq('id', id);
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

  // Fall back to the first scenario if none saved, or the saved one no longer exists
  if (_scenarioSupplierId && !suppliers.some(([id]) => id === _scenarioSupplierId)) {
    _scenarioSupplierId = null;
  }
  if (!_scenarioSupplierId && suppliers.length > 0) {
    _scenarioSupplierId = suppliers[0][0];
  }
  // Restore the saved logistics quote, falling back to the first if none saved/found
  if (!_calc.lqData && _calc.savedLqId) {
    _calc.lqData = lqList.find(q => q.id === _calc.savedLqId) || null;
  }
  if (!_calc.lqData && lqList.length > 0) {
    _calc.lqData = lqList[0];
  }

  const scenarioOpts = suppliers.map(([id, name]) =>
    `<option value="${esc(id)}" ${id === _scenarioSupplierId ? 'selected' : ''}>${esc(name)}</option>`
  ).join('');

  const lqOpts = lqList.map(q => {
    const price = q.pricing_type === 'flat'
      ? (q.price_flat_usd != null ? `$${fmt(q.price_flat_usd)} flat` : `£${fmt(q.price_flat_gbp)} flat`)
      : `$${fmt(q.price_per_mt_usd)}/MT`;
    return `<option value="${esc(q.id)}" ${_calc.lqData?.id === q.id ? 'selected' : ''}>${esc(q.contacts?.company_name || '?')} — ${price}</option>`;
  }).join('');

  // Default margin from first rfq_line's product line (if available), unless a
  // manual margin was already saved for this RFQ.
  const defaultMargin = _calc.model === 'manual' && _calc.savedMargin != null
    ? _calc.savedMargin
    : (_rfqLines[0]?.product_line_id
        ? (_allProductLines.find(p => p.id === _rfqLines[0].product_line_id)?.default_markup_pct ?? 10)
        : 10);

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
          <select class="form-select" id="calc-scenario" onchange="_scenarioSupplierId=this.value;recalcAllLines();savePricingSettings()">
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
          <label class="form-label">GBP → USD Rate <span style="font-weight:400;color:var(--color-text-muted);font-size:var(--text-xs)">(e.g. 1.27 means £1 = $1.27)</span></label>
          <input type="number" class="form-input" id="calc-fx" value="${_calc.fx}" step="0.001" min="0.001" oninput="_calc.fx=parseFloat(this.value)||1.27;recalcAllLines();savePricingSettings()" />
        </div>
        <div class="form-group">
          <label class="form-label">Insurance (% of FOB)</label>
          <input type="number" class="form-input" id="calc-ins" value="${_calc.ins}" step="0.05" min="0" oninput="_calc.ins=parseFloat(this.value)||0;recalcAllLines();savePricingSettings()" />
        </div>
      </div>

      <!-- Pricing model (applies to all lines) -->
      <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:var(--space-5);margin-top:var(--space-2);margin-bottom:var(--space-5)">
        <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-4)">Pricing Model (all lines)</p>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-5);margin-bottom:var(--space-3)">
          ${[['standard','Standard','Default product line margin'],['best','Best Price','Half standard, min 3% margin'],['market','Market Rate','Market reference price'],['manual','Manual','Enter margin % directly']].map(([val, label, desc]) =>
            `<label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer">
              <input type="radio" name="calc-model" value="${val}" ${val === _calc.model ? 'checked' : ''} onchange="onCalcModelChange('${val}')" />
              <span style="font-size:var(--text-sm);font-weight:600">${label}</span>
              <span style="font-size:var(--text-xs);color:var(--color-text-muted)">${desc}</span>
            </label>`).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <label class="form-label" style="margin:0;white-space:nowrap">Gross Margin %</label>
          <input type="number" class="form-input" id="calc-margin" value="${fmt(defaultMargin, 1)}" step="0.1" min="0" max="100" style="width:100px" oninput="document.querySelector('input[name=calc-model][value=manual]').checked=true;_calc.model='manual';_calc.savedMargin=parseFloat(this.value)||0;recalcAllLines();savePricingSettings()" />
        </div>
      </div>

      <!-- Per-line pricing table -->
      <div style="overflow-x:auto;margin-bottom:var(--space-5)">
        <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">
          <thead>
            <tr style="background:var(--color-surface)">
              <th style="padding:var(--space-2) var(--space-3);text-align:left;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border);white-space:nowrap">#</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:left;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border)">Product</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:left;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border)">Qty</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:right;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border)">FOB/MT (USD)</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:right;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border)">+ Freight/MT</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:right;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border)">+ Ins &amp; Ovhd/MT</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:right;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border);background:rgba(0,0,0,.03)">=&nbsp;Landed/MT (USD)</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:right;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border)">Margin</th>
              <th style="padding:var(--space-2) var(--space-3);text-align:right;font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);border-bottom:2px solid var(--color-border)">Sell/MT (USD)</th>
            </tr>
          </thead>
          <tbody id="calc-lines-body">
            <tr><td colspan="9" style="padding:var(--space-4);text-align:center;color:var(--color-text-muted)">Select a scenario above to see pricing.</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Summary + apply -->
      <div style="background:#0a1728;border-radius:var(--radius);padding:var(--space-5)">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-4);margin-bottom:var(--space-4)">
          <div>
            <div style="font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Revenue (USD)</div>
            <div style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;color:#7ab8d4" id="calc-total-value">—</div>
            <div style="font-size:10px;color:rgba(255,255,255,.4);margin-top:2px" id="calc-revenue-gbp"></div>
          </div>
          <div>
            <div style="font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Total Cost (USD)</div>
            <div style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;color:#ffffff" id="calc-total-cost">—</div>
          </div>
          <div>
            <div style="font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Gross Profit (USD)</div>
            <div style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700" id="calc-profit-usd">—</div>
          </div>
          <div>
            <div style="font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Gross Profit (GBP) — into your account</div>
            <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700" id="calc-profit-gbp">—</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(255,255,255,.1);padding-top:var(--space-4)">
          <div style="font-size:var(--text-xs);color:rgba(255,255,255,.45)" id="calc-margin-summary"></div>
          <button class="btn btn-primary" id="calc-apply-btn" onclick="applyAllLinesToQuote()" disabled>Apply all lines to Quote →</button>
        </div>
      </div>
      `}
    </div>`;

  // Browsers don't reliably honour `selected`/`checked` on elements injected via
  // innerHTML when the container has been in the DOM before — set explicitly.
  const lqSel = document.getElementById('calc-lq-sel');
  if (lqSel && _calc.lqData?.id) lqSel.value = _calc.lqData.id;
  const scenSel = document.getElementById('calc-scenario');
  if (scenSel && _scenarioSupplierId) scenSel.value = _scenarioSupplierId;
  const fxEl = document.getElementById('calc-fx');
  if (fxEl) fxEl.value = _calc.fx;
  const modelEl = document.querySelector(`input[name="calc-model"][value="${_calc.model}"]`);
  if (modelEl) modelEl.checked = true;
  const insEl = document.getElementById('calc-ins');
  if (insEl) insEl.value = _calc.ins;
  const marginEl = document.getElementById('calc-margin');
  if (marginEl) marginEl.readOnly = _calc.model !== 'manual';

  recalcAllLines();
}

function onCalcLqChange(lqId) {
  _calc.lqData = _costsLqList.find(q => q.id === lqId) || null;
  recalcAllLines();
  savePricingSettings();
}

function onCalcModelChange(model) {
  _calc.model = model;
  const marginEl = document.getElementById('calc-margin');
  if (!marginEl) return;
  if (model === 'manual') { marginEl.readOnly = false; savePricingSettings(); return; }
  marginEl.readOnly = true;
  recalcAllLines();
  savePricingSettings();
}

let _savePricingTimer = null;
function savePricingSettings() {
  if (!_rfqId) return;
  clearTimeout(_savePricingTimer);
  _savePricingTimer = setTimeout(() => {
    const model  = document.querySelector('input[name="calc-model"]:checked')?.value || _calc.model;
    const margin = parseFloat(document.getElementById('calc-margin')?.value);
    supabaseClient.from('rfq_submissions').update({
      pricing_scenario_supplier_id: _scenarioSupplierId || null,
      pricing_logistics_quote_id:   _calc.lqData?.id || null,
      pricing_fx_rate:              _calc.fx,
      pricing_insurance_pct:        _calc.ins,
      pricing_model:                model,
      pricing_margin_pct:           isNaN(margin) ? null : margin,
    }).eq('id', _rfqId);
  }, 600);
}

function calcLinePrice(line, sqForLine, lqData, fx, ins, overheadTotal, totalQtyMt, model, manualMargin) {
  // All intermediate costs in USD; sell price converts to GBP at the end.
  // fx = USD per £1 (e.g. 1.27 means £1 = $1.27)
  let fobUsd = 0;
  if (sqForLine) {
    if (sqForLine.pricing_basis === 'per_piece') {
      const pieces     = parseFloat(sqForLine.quantity_pieces || line.quantity || 1);
      const totalFobUsd = parseFloat(sqForLine.price_per_piece || 0) * pieces;
      fobUsd = line.quantity > 0 ? totalFobUsd / line.quantity : 0;
    } else if (sqForLine.pricing_basis === 'total') {
      fobUsd = line.quantity > 0 ? parseFloat(sqForLine.fob_price_usd || 0) / line.quantity : 0;
    } else {
      fobUsd = parseFloat(sqForLine.fob_price_usd || 0);
    }
  }

  // Freight in USD per MT
  let freightUsdPerMt = 0;
  if (lqData && line.quantity > 0 && totalQtyMt > 0) {
    if (lqData.pricing_type === 'flat') {
      const myShare = line.quantity / totalQtyMt;
      // price_flat_usd preferred; fall back to price_flat_gbp × fx for old records
      const flatUsd = lqData.price_flat_usd != null
        ? parseFloat(lqData.price_flat_usd || 0)
        : parseFloat(lqData.price_flat_gbp || 0) * fx;
      freightUsdPerMt = flatUsd * myShare / line.quantity;
    } else {
      freightUsdPerMt = parseFloat(lqData.price_per_mt_usd || 0);
    }
  }

  // Insurance in USD (% of FOB USD)
  const insuranceUsd = fobUsd * (ins / 100);

  // Overheads are in GBP — convert to USD equivalent for intermediate calculation
  const ovhPerMtUsd = (totalQtyMt > 0 && line.quantity > 0)
    ? (overheadTotal * fx) * (line.quantity / totalQtyMt) / line.quantity
    : 0;

  const landedUsd = fobUsd + freightUsdPerMt + insuranceUsd + ovhPerMtUsd;
  if (!landedUsd) return null;

  // Determine gross margin — sell price solves for profit being margin% of the
  // sell price itself: landed / (1 - margin%). This is what the customer is quoted.
  const pl = _allProductLines.find(p => p.id === line.product_line_id);
  let marginPct = manualMargin;
  if (model === 'standard') marginPct = pl?.default_markup_pct ?? 10;
  if (model === 'best')     marginPct = Math.max((pl?.default_markup_pct ?? 10) / 2, 3);

  let sellPriceUsd;
  if (model === 'market') {
    // Market Rate sets the sell price directly from the product's market reference
    // price (converted to USD), rather than deriving it from a margin %.
    const mktUsd = pl?.market_reference_price_gbp != null ? pl.market_reference_price_gbp * fx : null;
    sellPriceUsd = mktUsd != null ? mktUsd : (marginPct < 100 ? landedUsd / (1 - marginPct / 100) : 0);
  } else {
    sellPriceUsd = marginPct < 100 ? landedUsd / (1 - marginPct / 100) : 0;
  }
  const sellPriceGbp = sellPriceUsd / fx;

  // Recompute margin/markup from the final sell price so both figures are always
  // internally consistent, however the price was actually set (incl. Market Rate).
  // Markup is indicative-only — shown internally, never on the customer quote.
  marginPct = sellPriceUsd > 0 ? ((sellPriceUsd - landedUsd) / sellPriceUsd) * 100 : 0;
  const markupPct = landedUsd > 0 ? ((sellPriceUsd - landedUsd) / landedUsd) * 100 : 0;

  return { fobUsd, freightUsdPerMt, insuranceUsd, ovhPerMtUsd, landedUsd, sellPriceUsd, sellPriceGbp, markupPct, marginPct, pl };
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
  let grandTotal   = 0;
  let totalCostUsd = 0;
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
        <td colspan="6" style="padding:var(--space-2) var(--space-3);text-align:center;color:var(--color-text-muted);font-size:var(--text-xs)">No supplier quote for this scenario</td>
      </tr>`;
    }

    const qty       = parseFloat(line.quantity) || 0;
    const lineTotal = result.sellPriceUsd * qty;
    const lineCost  = result.landedUsd * qty;
    grandTotal   += lineTotal;
    totalCostUsd += lineCost;
    _pricedLines.push({ line, result, sqForLine, lineTotal });

    const mBadge = result.marginPct >= 10 ? 'badge-success' : result.marginPct >= 5 ? 'badge-warning' : 'badge-danger';
    return `<tr style="border-bottom:1px solid var(--color-border);background:${line.is_alternative ? '#f9fffe' : ''}">
      <td style="padding:var(--space-2) var(--space-3);font-weight:600">${line.line_number}${line.is_alternative ? ' <span class="badge badge-info" style="font-size:10px">Alt</span>' : ''}</td>
      <td style="padding:var(--space-2) var(--space-3)">${esc(line.description)}<div style="font-size:var(--text-xs);color:var(--color-text-muted)">${esc(line.grade_specification || '')}</div></td>
      <td style="padding:var(--space-2) var(--space-3)">${qty ? fmt(qty, 0) + ' ' + (line.quantity_unit || 'MT') : '—'}</td>
      <td style="padding:var(--space-2) var(--space-3);text-align:right;font-variant-numeric:tabular-nums">$${fmt(result.fobUsd)}</td>
      <td style="padding:var(--space-2) var(--space-3);text-align:right;font-variant-numeric:tabular-nums;color:var(--color-text-muted)">$${fmt(result.freightUsdPerMt)}</td>
      <td style="padding:var(--space-2) var(--space-3);text-align:right;font-variant-numeric:tabular-nums;color:var(--color-text-muted)">$${fmt(result.insuranceUsd + result.ovhPerMtUsd)}</td>
      <td style="padding:var(--space-2) var(--space-3);text-align:right;font-variant-numeric:tabular-nums;font-weight:600;background:rgba(0,0,0,.025)">$${fmt(result.landedUsd)}</td>
      <td style="padding:var(--space-2) var(--space-3);text-align:right"><span class="badge ${mBadge}" style="font-size:10px">+${fmt(result.marginPct,1)}%</span></td>
      <td style="padding:var(--space-2) var(--space-3);text-align:right;font-family:var(--font-display);font-weight:700;color:var(--color-text-primary)">
        <div>$${fmt(result.sellPriceUsd)}</div>
        <div style="font-size:10px;color:var(--color-text-muted);font-family:var(--font-body);font-weight:400">≈ £${fmt(result.sellPriceGbp)} · markup ${fmt(result.markupPct,1)}%</div>
      </td>
    </tr>`;
  }).join('');

  // Update totals bar
  const totalProfitUsd = grandTotal - totalCostUsd;
  const totalProfitGbp = totalProfitUsd / fx;
  const profitColour   = totalProfitUsd >= 0 ? '#4ade80' : '#f87171';

  const totalEl = document.getElementById('calc-total-value');
  if (totalEl) totalEl.textContent = grandTotal ? `$${fmt(grandTotal)}` : '—';
  const revGbpEl = document.getElementById('calc-revenue-gbp');
  if (revGbpEl) revGbpEl.textContent = grandTotal ? `≈ £${fmt(grandTotal / fx)} GBP` : '';
  const costEl = document.getElementById('calc-total-cost');
  if (costEl) costEl.textContent = totalCostUsd ? `$${fmt(totalCostUsd)}` : '—';
  const profUsdEl = document.getElementById('calc-profit-usd');
  if (profUsdEl) { profUsdEl.textContent = grandTotal ? `$${fmt(totalProfitUsd)}` : '—'; profUsdEl.style.color = profitColour; }
  const profGbpEl = document.getElementById('calc-profit-gbp');
  if (profGbpEl) { profGbpEl.textContent = grandTotal ? `£${fmt(totalProfitGbp)}` : '—'; profGbpEl.style.color = profitColour; }
  const marginSumEl = document.getElementById('calc-margin-summary');
  if (marginSumEl && _pricedLines.length > 0) {
    const avgMargin = grandTotal > 0 ? (totalProfitUsd / grandTotal) * 100 : 0;
    marginSumEl.textContent = `Avg margin: ${fmt(avgMargin, 1)}% across ${_pricedLines.length} line${_pricedLines.length !== 1 ? 's' : ''}`;
  }

  const applyBtn = document.getElementById('calc-apply-btn');
  if (applyBtn) applyBtn.disabled = _costsLocked || !(allPrimaryPriced && _pricedLines.length > 0);

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
    productFamily: result.pl?.name || line.description || '',
    productType:   line.product_type || result.pl?.physical_form || '',
    vatRate:       result.pl?.vat_rate != null ? result.pl.vat_rate * 100 : 20,
    description:   line.description,
    // Prefer the supplier's own confirmed specification over the customer's original ask
    gradeSpec:     sqForLine?.specification || line.grade_specification || '',
    qty:           line.quantity || null,
    unit:          line.quantity_unit || 'MT',
    unitPrice:     result.sellPriceGbp,
    unitPriceGbp:  result.sellPriceGbp,
    unitPriceUsd:  result.sellPriceUsd,
    fx:            _calc.fx,
    sqId:          sqForLine?.id || null,
    lqId,
    model:         _calc.model,
    marginPct:     result.marginPct,
    landed:        result.landedUsd,
  }));

  _quoteLines   = [];
  _activeCqId   = null;
  switchTab('build');
}

// ── Tab 3: Quote Summary ──────────────────────────────────────────────────────

async function rehydratePricedLines() {
  if (_pricedLines.length > 0) return;
  if (!_rfqId) return;

  if (_rfqLines.length === 0) {
    const { data } = await supabaseClient.from('rfq_lines')
      .select('*, product_lines(*)').eq('rfq_id', _rfqId).order('line_number');
    _rfqLines = data || [];
  }

  const [sqRes, lqRes, ohRes] = await Promise.all([
    supabaseClient.from('supplier_quotes')
      .select('id,rfq_line_id,supplier_id,product,specification,pricing_basis,fob_price_usd,price_per_piece,quantity_pieces,quantity_mt,incoterm,validity_date,status,document_path,contacts(company_name)')
      .eq('rfq_id', _rfqId).order('created_at', { ascending: false }),
    supabaseClient.from('logistics_quotes')
      .select('id,origin_country,destination_country,mode,pricing_type,price_per_mt_usd,price_flat_usd,price_flat_gbp,validity_date,status,document_path,contacts(company_name)')
      .eq('rfq_id', _rfqId).order('created_at', { ascending: false }),
    supabaseClient.from('rfq_overhead_costs').select('*').eq('rfq_id', _rfqId),
  ]);

  _costsSqList = sqRes.data || [];
  _costsLqList = lqRes.data || [];
  _calc.overheadTotal = (ohRes.data || []).reduce((s, o) => s + parseFloat(o.amount_gbp || 0), 0);

  // Mirror the auto-select logic from renderPricingCalculator
  const supplierMap = {};
  _costsSqList.forEach(q => {
    if (q.supplier_id && q.contacts?.company_name) supplierMap[q.supplier_id] = q.contacts.company_name;
  });
  const suppliers = Object.entries(supplierMap);
  if (_scenarioSupplierId && !suppliers.some(([id]) => id === _scenarioSupplierId)) _scenarioSupplierId = null;
  if (!_scenarioSupplierId && suppliers.length > 0) _scenarioSupplierId = suppliers[0][0];
  if (!_calc.lqData && _calc.savedLqId) _calc.lqData = _costsLqList.find(q => q.id === _calc.savedLqId) || null;
  if (!_calc.lqData && _costsLqList.length > 0) _calc.lqData = _costsLqList[0];
  if (!_allProductLines.length) {
    const { data: pl } = await supabaseClient.from('product_lines').select('*');
    _allProductLines = pl || [];
  }

  recalcAllLines(); // populates _pricedLines
}

async function renderSummaryTab() {
  const el = document.getElementById('tab-summary');
  if (!el) return;

  if (!_pricedLines || _pricedLines.length === 0) {
    el.innerHTML = `<div class="panel"><div class="panel-body" style="text-align:center;padding:var(--space-8)"><span style="color:var(--color-text-muted)">Loading summary…</span></div></div>`;
    await rehydratePricedLines();
  }

  if (!_pricedLines || _pricedLines.length === 0) {
    el.innerHTML = `
      <div class="panel"><div class="panel-body" style="text-align:center;padding:var(--space-12) var(--space-8)">
        <div style="font-size:2.5rem;margin-bottom:var(--space-4)">📊</div>
        <h3 style="margin-bottom:var(--space-2)">No pricing data yet</h3>
        <p style="color:var(--color-text-muted);font-size:var(--text-sm);max-width:380px;margin:0 auto var(--space-5)">
          Go to <strong>Cost Inputs</strong>, add supplier and logistics quotes, then run the pricing calculator.
          The summary will appear here once pricing has been calculated.
        </p>
        <button class="btn btn-primary" onclick="switchTab('costs')">Go to Cost Inputs →</button>
      </div></div>`;
    return;
  }

  const fx           = _calc.fx || 1.27;
  const supplierName = _costsSqList.find(q => q.supplier_id === _scenarioSupplierId)?.contacts?.company_name || 'Unknown supplier';
  const buyer        = _rfqData;

  // Totals — all in USD (internal view); customer quote tab uses GBP
  const totalRevenueUsd = _pricedLines.reduce((s, p) => s + p.lineTotal, 0);
  const totalLandedUsd  = _pricedLines.reduce((s, p) => s + p.result.landedUsd * (parseFloat(p.line.quantity) || 0), 0);
  const totalLandedGbp  = totalLandedUsd / fx;
  const totalProfitUsd  = totalRevenueUsd - totalLandedUsd;
  const avgMarginPct    = totalRevenueUsd > 0 ? (totalProfitUsd / totalRevenueUsd) * 100 : 0;

  const marginBadgeClass = m => m >= 10 ? 'badge-success' : m >= 5 ? 'badge-warning' : 'badge-danger';
  const profitColour     = p => p >= 0 ? 'var(--color-success)' : 'var(--color-danger)';

  el.innerHTML = `
    <!-- Buyer + Supplier overview -->
    <div class="panel" style="margin-bottom:var(--space-4)">
      <div class="panel-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-8)">
          <div>
            <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-3)">Buyer</p>
            <div style="font-size:var(--text-lg);font-weight:600;margin-bottom:var(--space-1)">${esc(buyer.company || '—')}</div>
            ${buyer.name    ? `<div style="font-size:var(--text-sm);color:var(--color-text-muted)">${esc(buyer.name)}</div>` : ''}
            ${buyer.email   ? `<div style="font-size:var(--text-sm);color:var(--color-text-muted)">${esc(buyer.email)}</div>` : ''}
            ${buyer.country ? `<div style="font-size:var(--text-sm);color:var(--color-text-muted)">${esc(buyer.country)}</div>` : ''}
          </div>
          <div>
            <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-3)">Supplier (Active Scenario)</p>
            <div style="font-size:var(--text-lg);font-weight:600;margin-bottom:var(--space-1)">${esc(supplierName)}</div>
            <div style="font-size:var(--text-sm);color:var(--color-text-muted)">${_pricedLines.length} line${_pricedLines.length !== 1 ? 's' : ''} priced</div>
            <div style="font-size:var(--text-sm);color:var(--color-text-muted)">FX rate: £1 = $${fmt(fx, 3)}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Per-line detail -->
    <div class="panel" style="margin-bottom:var(--space-4)">
      <div class="panel-body">
        <h4 style="margin:0 0 var(--space-4)">Line Detail</h4>
        <div class="table-wrapper" style="margin:0">
          <table>
            <thead><tr>
              <th>#</th>
              <th>Product</th>
              <th style="text-align:right">Qty</th>
              <th style="text-align:right">Cost/MT (USD)</th>
              <th style="text-align:right">Sell/MT (USD)</th>
              <th style="text-align:right">Revenue (USD)</th>
              <th style="text-align:right">Margin</th>
              <th style="text-align:right">Profit (GBP)</th>
            </tr></thead>
            <tbody>
              ${_pricedLines.map(({ line, result, lineTotal }) => {
                const qty        = parseFloat(line.quantity) || 0;
                const profitUsd  = lineTotal - (result.landedUsd * qty);
                const profitGbp  = profitUsd / fx;
                return `<tr>
                  <td style="font-weight:600;color:var(--color-text-muted)">${line.line_number}${line.is_alternative ? ' <span class="badge badge-info" style="font-size:10px">Alt</span>' : ''}</td>
                  <td>
                    <div style="font-weight:500">${esc(line.description)}</div>
                    ${line.grade_specification ? `<div style="font-size:var(--text-xs);color:var(--color-text-muted)">${esc(line.grade_specification)}</div>` : ''}
                  </td>
                  <td style="text-align:right">${qty ? fmt(qty, 0) + ' ' + esc(line.quantity_unit || 'MT') : '—'}</td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums;color:var(--color-text-muted)">$${fmt(result.landedUsd)}</td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums">
                    <div>$${fmt(result.sellPriceUsd)}</div>
                    <div style="font-size:var(--text-xs);color:var(--color-text-muted)">≈ £${fmt(result.sellPriceGbp)}</div>
                  </td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600">$${fmt(lineTotal)}</td>
                  <td style="text-align:right">
                    <span class="badge ${marginBadgeClass(result.marginPct)}">${fmt(result.marginPct, 1)}%</span>
                    <div style="font-size:10px;color:var(--color-text-muted);margin-top:2px">markup ${fmt(result.markupPct, 1)}%</div>
                  </td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:${profitColour(profitGbp)}">
                    <div>£${fmt(profitGbp)}</div>
                    <div style="font-size:var(--text-xs);color:var(--color-text-muted);font-weight:400">≈ $${fmt(profitUsd)}</div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Totals summary -->
    <div style="background:#0a1728;border-radius:var(--radius);padding:var(--space-6)">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-6);margin-bottom:var(--space-5)">
        <div>
          <div style="font-size:var(--text-xs);color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.08em;margin-bottom:var(--space-1)">Total Cost</div>
          <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:#ffffff">$${fmt(totalLandedUsd)}</div>
          <div style="font-size:var(--text-xs);color:rgba(255,255,255,.4);margin-top:2px">≈ £${fmt(totalLandedGbp)} GBP at £1=$${fmt(fx,3)}</div>
        </div>
        <div>
          <div style="font-size:var(--text-xs);color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.08em;margin-bottom:var(--space-1)">Total Revenue</div>
          <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:#7ab8d4">$${fmt(totalRevenueUsd)}</div>
          <div style="font-size:var(--text-xs);color:rgba(255,255,255,.55);margin-top:2px">≈ £${fmt(totalRevenueUsd / fx)} GBP (buyer invoice)</div>
        </div>
        <div>
          <div style="font-size:var(--text-xs);color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.08em;margin-bottom:var(--space-1)">Gross Profit (GBP)</div>
          <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:${totalProfitUsd >= 0 ? '#4ade80' : '#f87171'}">£${fmt(totalProfitUsd / fx)}</div>
          <div style="font-size:var(--text-xs);color:rgba(255,255,255,.55);margin-top:2px">≈ $${fmt(totalProfitUsd)} USD — into your account</div>
        </div>
        <div>
          <div style="font-size:var(--text-xs);color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.08em;margin-bottom:var(--space-1)">Average Margin</div>
          <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:${avgMarginPct >= 10 ? '#4ade80' : avgMarginPct >= 5 ? '#fbbf24' : '#f87171'}">${fmt(avgMarginPct, 1)}%</div>
          <div style="font-size:var(--text-xs);color:rgba(255,255,255,.4);margin-top:2px">Across all primary lines</div>
        </div>
      </div>
      <div style="border-top:1px solid rgba(255,255,255,.1);padding-top:var(--space-4);display:flex;justify-content:flex-end">
        <button class="btn btn-primary" onclick="switchTab('build')">Build Customer Quote →</button>
      </div>
    </div>
  `;
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

function updateExpiryDisplay() {
  const dateStr = document.getElementById('bq-date')?.value;
  const days    = parseInt(document.getElementById('bq-valid-days')?.value) || 7;
  const el      = document.getElementById('bq-expiry-display');
  if (!el) return;
  if (!dateStr) { el.textContent = '—'; return; }
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  el.textContent = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

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

  // Sync quote currency from saved draft, then fall back to module state
  if (cq?.currency) _quoteCurrency = cq.currency;

  // Initialise working line items — prefer fresh calculator output (allows currency change),
  // then existing draft, then blank
  if (Array.isArray(_calcApplied) && _calcApplied.length) {
    // Multi-line from scenario pricing calculator
    const price = (ca) => _quoteCurrency === 'USD' ? (ca.unitPriceUsd || ca.unitPrice) : (ca.unitPriceGbp || ca.unitPrice);
    _quoteLines = _calcApplied.map((ca, i) => {
      const p   = price(ca);
      const amt = p * (ca.qty || 0);
      return {
        line_number:        i + 1,
        rfq_line_id:        ca.rfqLineId || null,
        item_code:          ca.cnCode || '',
        product_family:     ca.productFamily || ca.plName || '',
        product_type:       ca.productType || '',
        description:        ca.description || ca.plName,
        grade_specification: ca.gradeSpec || '',
        quantity:           ca.qty || null,
        unit:               ca.unit || 'MT',
        unit_price_gbp:     p,
        amount_gbp:         amt,
        vat_rate:           ca.vatRate,
        vat_amount_gbp:     amt * (ca.vatRate / 100),
        is_alternative:     ca.isAlternative || false,
      };
    });
    // _calcApplied kept alive so currency changes can re-derive prices
  } else if (existingLines.length) {
    _quoteLines = existingLines.map(l => ({ ...l }));
  } else if (!_quoteLines.length) {
    _quoteLines = [blankLine(1)];
  }

  const overheadTotal = (overheads||[]).reduce((s,o) => s + parseFloat(o.amount_gbp||0), 0);

  const today = new Date().toISOString().split('T')[0];
  const ref   = cq?.quote_reference || generateQuoteReference();

  // Parse existing lead_time string (e.g. "4 weeks") into qty + unit
  const _leadMatch = (cq?.lead_time || '').match(/^(\d+)\s*(days?|weeks?|months?)$/i);
  const leadQty    = _leadMatch ? _leadMatch[1] : '';
  const leadUnit   = _leadMatch ? (_leadMatch[2].toLowerCase().endsWith('s') ? _leadMatch[2].toLowerCase() : _leadMatch[2].toLowerCase() + 's') : 'weeks';

  // Derive "valid for" days from existing quote; default 7
  let selectedValidDays = 7;
  if (cq?.validity_date && cq?.issued_date) {
    const diff = Math.round((new Date(cq.validity_date) - new Date(cq.issued_date)) / 86400000);
    if ([7, 14, 30].includes(diff)) selectedValidDays = diff;
  }
  const baseDate    = cq?.issued_date || today;
  const expiryDate  = new Date(baseDate);
  expiryDate.setDate(expiryDate.getDate() + selectedValidDays);
  const expiryDisplay = expiryDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

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
            <input type="date" class="form-input" id="bq-date" value="${esc(cq?.issued_date || today)}" onchange="updateExpiryDisplay()" />
          </div>
          <div class="form-group">
            <label class="form-label">Valid For</label>
            <select class="form-select" id="bq-valid-days" onchange="updateExpiryDisplay()">
              ${[7,14,30].map(d => `<option value="${d}" ${d === selectedValidDays ? 'selected' : ''}>${d} days</option>`).join('')}
            </select>
            <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-1)">Expires: <span id="bq-expiry-display">${expiryDisplay}</span></div>
          </div>
          <div class="form-group">
            <label class="form-label">Quote Currency</label>
            <select class="form-select" id="bq-currency" onchange="_quoteCurrency=this.value;renderBuildTab()">
              <option value="GBP" ${_quoteCurrency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
              <option value="USD" ${_quoteCurrency === 'USD' ? 'selected' : ''}>USD ($)</option>
            </select>
            <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-1)">
              ${_quoteCurrency === 'GBP' && _calc.fx ? `Converted from USD at £1 = $${fmt(_calc.fx, 3)}` : 'No conversion — prices shown as USD'}
            </div>
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
            <div style="display:flex;gap:var(--space-2)">
              <input type="number" class="form-input" id="bq-lead-qty" value="${esc(leadQty)}" min="1" max="99" step="1" placeholder="e.g. 4" style="width:90px;flex-shrink:0" />
              <select class="form-select" id="bq-lead-unit">
                <option value="days"   ${leadUnit === 'days'   ? 'selected' : ''}>Days</option>
                <option value="weeks"  ${leadUnit === 'weeks'  ? 'selected' : ''}>Weeks</option>
                <option value="months" ${leadUnit === 'months' ? 'selected' : ''}>Months</option>
              </select>
            </div>
            <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-1)">From order confirmation</div>
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
          <th style="min-width:120px">Product</th>
          <th style="min-width:100px">Type</th>
          <th style="min-width:140px">Specification</th>
          <th style="min-width:180px">Description *</th>
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
  return { line_number: num, item_code: '', product_family: '', product_type: '', description: '', grade_specification: '', quantity: '', unit: 'MT', unit_price_gbp: '', vat_rate: 20, amount_gbp: 0, vat_amount_gbp: 0, is_alternative: false };
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
      <td><input class="line-input" type="text" value="${esc(l.product_family||'')}" oninput="_quoteLines[${i}].product_family=this.value" placeholder="e.g. Antimony" /></td>
      <td><input class="line-input" type="text" value="${esc(l.product_type||'')}" list="physical-form-options" oninput="_quoteLines[${i}].product_type=this.value" placeholder="e.g. Ingot" /></td>
      <td><input class="line-input" type="text" value="${esc(l.grade_specification||'')}" oninput="_quoteLines[${i}].grade_specification=this.value" placeholder="Specification" /></td>
      <td><input class="line-input" type="text" value="${esc(l.description||'')}" oninput="_quoteLines[${i}].description=this.value" required placeholder="Product description" /></td>
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
    validity_date:            (() => { const d = new Date(document.getElementById('bq-date')?.value || new Date().toISOString().split('T')[0]); d.setDate(d.getDate() + (parseInt(document.getElementById('bq-valid-days')?.value) || 7)); return d.toISOString().split('T')[0]; })(),
    currency:                 document.getElementById('bq-currency')?.value || _quoteCurrency || 'GBP',
    customer_name:            document.getElementById('bq-cust-name')?.value.trim() || null,
    customer_company:         document.getElementById('bq-cust-company')?.value.trim() || null,
    customer_address_line_1:  document.getElementById('bq-addr1')?.value.trim() || null,
    customer_address_line_2:  document.getElementById('bq-addr2')?.value.trim() || null,
    customer_city:            document.getElementById('bq-city')?.value.trim() || null,
    customer_postcode:        document.getElementById('bq-postcode')?.value.trim() || null,
    customer_country:         document.getElementById('bq-country')?.value.trim() || null,
    customer_vat_number:      document.getElementById('bq-vat')?.value.trim() || null,
    payment_terms:            (() => { const sel = document.getElementById('bq-payment-select')?.value; return sel === 'other' ? (document.getElementById('bq-payment-other')?.value.trim() || null) : (sel || null); })(),
    lead_time:                (() => { const qty = parseInt(document.getElementById('bq-lead-qty')?.value); const unit = document.getElementById('bq-lead-unit')?.value || 'weeks'; return qty > 0 ? `${qty} ${unit}` : null; })(),
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
    product_family:    l.product_family || null,
    product_type:      l.product_type || null,
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

// ── Delete RFQ (test-data cleanup) ────────────────────────────────────────────

function openDeleteRfqModal() {
  const company = _rfqData?.company || '';
  showDynModal('delete-rfq-modal', 'Delete RFQ', `
    <p style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-4)">
      This permanently deletes this RFQ and everything attached to it — quote lines, supplier and logistics quotes, other costs, and any customer quotes drafted from it. This cannot be undone. Use only to remove test data.
    </p>
    <div class="form-group">
      <label class="form-label">Type the customer company name <strong>${esc(company)}</strong> to confirm</label>
      <input type="text" class="form-input" id="delete-rfq-confirm" oninput="checkDeleteRfqConfirm()" autocomplete="off" />
    </div>
    <div id="delete-rfq-alert" class="alert alert-error" style="display:none;margin-top:var(--space-3)"></div>
    <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
      <button type="button" class="btn btn-sm" style="background:var(--color-danger);color:#fff;border:none" id="delete-rfq-btn" disabled onclick="confirmDeleteRfq()">Permanently Delete</button>
      <button type="button" class="btn btn-ghost" onclick="closeDynModal('delete-rfq-modal')">Cancel</button>
    </div>
  `);
}

function checkDeleteRfqConfirm() {
  const company = (_rfqData?.company || '').trim();
  const input   = document.getElementById('delete-rfq-confirm')?.value.trim();
  const btn     = document.getElementById('delete-rfq-btn');
  if (btn) btn.disabled = !(company && input === company);
}

async function confirmDeleteRfq() {
  const alertEl = document.getElementById('delete-rfq-alert');
  const btn     = document.getElementById('delete-rfq-btn');
  btn.disabled = true; btn.textContent = 'Checking…';
  alertEl.style.display = 'none';

  // Refuse to delete if this RFQ has already been converted into a real order/trade —
  // that's a live business record, not test data.
  const { data: trades } = await supabaseClient.from('trades').select('id').eq('rfq_id', _rfqId).limit(1);
  if (trades && trades.length) {
    alertEl.style.display = 'block';
    alertEl.textContent = 'This RFQ has already been converted into an order and cannot be deleted from here.';
    btn.disabled = true; btn.textContent = 'Permanently Delete';
    return;
  }

  btn.textContent = 'Deleting…';
  try {
    const { data: cqRows } = await supabaseClient.from('customer_quotes').select('id').eq('rfq_id', _rfqId);
    const cqIds = (cqRows || []).map(r => r.id);
    if (cqIds.length) {
      await supabaseClient.from('customer_quote_lines').delete().in('customer_quote_id', cqIds);
      await supabaseClient.from('customer_quotes').delete().in('id', cqIds);
    }
    await supabaseClient.from('rfq_overhead_costs').delete().eq('rfq_id', _rfqId);
    await supabaseClient.from('supplier_quotes').delete().eq('rfq_id', _rfqId);
    await supabaseClient.from('logistics_quotes').delete().eq('rfq_id', _rfqId);
    await supabaseClient.from('rfq_lines').delete().eq('rfq_id', _rfqId);

    const { error } = await supabaseClient.from('rfq_submissions').delete().eq('id', _rfqId);
    if (error) throw new Error(error.message);

    window.location.href = 'index.html';
  } catch (err) {
    alertEl.style.display = 'block';
    alertEl.textContent = 'Delete failed: ' + err.message;
    btn.disabled = false; btn.textContent = 'Permanently Delete';
  }
}

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
  refreshRfqStatusBadge();
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

function formatDeliveryAddress(isLinked, contact, contactId) {
  if (!isLinked) {
    return `<span style="color:var(--color-text-muted)">No customer record linked yet — create one to capture a delivery address.</span>`;
  }
  const parts = [contact?.address_line_1, contact?.address_line_2, contact?.city, contact?.postcode, contact?.country]
    .filter(Boolean).map(esc);
  if (!parts.length) {
    return `<span style="color:var(--color-text-muted)">Not on file — <a href="../customers/detail.html?id=${esc(contactId)}" style="color:var(--color-accent)">add an address on the customer record</a>.</span>`;
  }
  return parts.join(', ');
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
          ${!matchedBuyer ? `<span style="font-size:var(--text-xs);color:var(--color-text-muted)">No customer matched "${esc(_rfqData?.company||'')}". <a href="../contacts/index.html" style="color:var(--color-accent)" target="_blank">Add customer</a> if needed.</span>` : ''}
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
  (async () => {
    const u = await getCurrentUser();
    const el = document.getElementById('user-email');
    if (el) el.textContent = u?.email || '';
    loadRfqs();

    // Deep-link support: ?action=new opens the New RFQ modal directly
    // (used by the Customers/Sales homepage "+ New Customer RFQ" shortcuts)
    if (new URLSearchParams(location.search).get('action') === 'new') {
      openNewRfqModal();
    }
  })();
}
if (document.getElementById('rfq-detail') !== null) {
  (async () => { const u = await getCurrentUser(); const el = document.getElementById('user-email'); if (el) el.textContent = u?.email || ''; loadRfqDetail(); })();
}
