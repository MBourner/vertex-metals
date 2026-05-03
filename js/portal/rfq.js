/**
 * Vertex Metals Portal — RFQ Module (list + detail)
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
  const map = { new:'badge-accent', reviewing:'badge-info', quoted:'badge-warning', responded:'badge-warning', closed:'badge-neutral' };
  return `<span class="badge ${map[s]||'badge-neutral'}">${esc(s)}</span>`;
}

function cqStatusBadge(s) {
  const map = { draft:'badge-neutral', sent:'badge-info', accepted:'badge-success', rejected:'badge-danger', expired:'badge-neutral' };
  return `<span class="badge ${map[s]||'badge-neutral'}">${esc(s)}</span>`;
}

function generateOrderReference() {
  const year  = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix  = '';
  for (let i = 0; i < 5; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `VM-${year}-${suffix}`;
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

// ── Detail page ───────────────────────────────────────────────────────────────

let _rfqId           = null;
let _rfqData         = null;
let _allProductLines = [];

async function loadRfqDetail() {
  _rfqId = new URLSearchParams(window.location.search).get('id');
  if (!_rfqId) { document.getElementById('rfq-detail').innerHTML = '<div class="alert alert-error">No ID provided</div>'; return; }

  const [{ data, error }, { data: pls }] = await Promise.all([
    supabaseClient.from('rfq_submissions').select('*').eq('id', _rfqId).single(),
    supabaseClient.from('product_lines').select('id,name,standard_sell_price_gbp,market_reference_price_gbp,default_markup_pct').eq('active', true).order('name'),
  ]);

  if (error || !data) { document.getElementById('rfq-detail').innerHTML = '<div class="alert alert-error">Record not found</div>'; return; }
  _rfqData         = data;
  _allProductLines = pls || [];

  document.getElementById('rfq-title').textContent = `${data.company} — ${fmtDate(data.created_at)}`;
  await renderDetail();
}

async function renderDetail() {
  const data = _rfqData;

  const [
    { data: linkedSq },
    { data: linkedLq },
    { data: customerQuotes },
  ] = await Promise.all([
    supabaseClient.from('supplier_quotes').select('id,product,fob_price_usd,validity_date,status,contacts(company_name)').eq('rfq_id', _rfqId).order('created_at', { ascending: false }),
    supabaseClient.from('logistics_quotes').select('id,origin_country,destination_country,price_per_mt_usd,validity_date,status,contacts(company_name)').eq('rfq_id', _rfqId).order('created_at', { ascending: false }),
    supabaseClient.from('customer_quotes').select('*').eq('rfq_id', _rfqId).order('created_at', { ascending: false }),
  ]);

  // Fuzzy match RFQ product text to a product line
  const productText = (data.product || '').toLowerCase();
  const matchedPl   = _allProductLines.find(pl =>
    pl.name.toLowerCase().includes(productText) || productText.includes(pl.name.toLowerCase().split(' ')[0])
  );

  const el = document.getElementById('rfq-detail');

  el.innerHTML = `
    <!-- Info grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6);margin-bottom:var(--space-8)">
      ${field('Name', data.name)}${field('Company', data.company)}
      ${field('Role', data.role)}${field('Email', `<a href="mailto:${esc(data.email)}" style="color:var(--color-accent)">${esc(data.email)}</a>`)}
      ${field('Phone', data.phone)}${field('Type', data.type)}
      ${field('Product interest', data.product)}${field('Estimated quantity (MT)', data.quantity_mt != null ? fmt(data.quantity_mt, 0) + ' MT' : null)}
      ${field('Country', data.country)}
    </div>

    <div style="margin-bottom:var(--space-8)"><strong>Message:</strong><p style="margin-top:var(--space-2);white-space:pre-wrap">${esc(data.message)}</p></div>

    <!-- Status & actions -->
    <div style="display:flex;gap:var(--space-4);align-items:flex-end;flex-wrap:wrap;margin-bottom:var(--space-8)">
      <div class="form-group" style="min-width:200px">
        <label class="form-label">Update Status</label>
        <select class="form-select" id="status-select" onchange="updateStatus('${esc(_rfqId)}', this.value)">
          ${['new','reviewing','quoted','responded','closed'].map(s => `<option value="${s}" ${s===data.status?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <a href="../contacts/index.html?prefill=1&name=${encodeURIComponent(data.name)}&company=${encodeURIComponent(data.company)}&email=${encodeURIComponent(data.email)}&phone=${encodeURIComponent(data.phone||'')}&type=${encodeURIComponent(data.type)}"
         class="btn btn-secondary btn-sm">+ Create Contact</a>
      <button class="btn btn-primary btn-sm" onclick="openCreateQuoteModal()">+ Create Customer Quote</button>
    </div>

    <!-- Recommended price (if product matched) -->
    ${matchedPl ? `
    <div style="background:var(--color-navy);border-radius:var(--radius);padding:var(--space-4);margin-bottom:var(--space-6);display:flex;gap:var(--space-6);flex-wrap:wrap;align-items:center">
      <div><div style="font-size:var(--text-xs);color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-1)">Matched product</div>
        <div style="color:#fff;font-weight:600">${esc(matchedPl.name)}</div></div>
      <div><div style="font-size:var(--text-xs);color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-1)">Standard price</div>
        <div style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:var(--color-steel)">${matchedPl.standard_sell_price_gbp ? `£${fmt(matchedPl.standard_sell_price_gbp)}/MT` : 'Not set'}</div></div>
      ${matchedPl.market_reference_price_gbp ? `<div><div style="font-size:var(--text-xs);color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-1)">Market ref</div>
        <div style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:600;color:#fff">£${fmt(matchedPl.market_reference_price_gbp)}/MT</div></div>` : ''}
      <div><div style="font-size:var(--text-xs);color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-1)">Default markup</div>
        <div style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:600;color:#fff">${matchedPl.default_markup_pct != null ? fmt(matchedPl.default_markup_pct, 1) + '%' : '—'}</div></div>
      <a href="../quotes/calculator.html" class="btn btn-ghost btn-sm" style="margin-left:auto;color:#fff;border-color:rgba(255,255,255,.3)">Open Calculator →</a>
    </div>` : ''}

    <!-- Linked supplier quotes -->
    <div style="margin-bottom:var(--space-6)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
        <h4 style="margin:0">Linked Supplier Quotes</h4>
        <button class="btn btn-ghost btn-sm" onclick="openLinkSupplierQuoteModal()">Link / Add Quote</button>
      </div>
      ${(linkedSq && linkedSq.length > 0) ? `
      <div class="table-wrapper" style="margin:0"><table>
        <thead><tr><th>Supplier</th><th>Product</th><th>FOB (USD/MT)</th><th>Validity</th><th>Status</th></tr></thead>
        <tbody>${linkedSq.map(q => `<tr>
          <td>${esc(q.contacts?.company_name || '—')}</td>
          <td>${esc(q.product)}</td>
          <td style="font-family:var(--font-display);font-weight:600">$${fmt(q.fob_price_usd)}</td>
          <td>${fmtDate(q.validity_date)}</td>
          <td><span class="badge badge-${q.status === 'active' ? 'success' : 'neutral'}">${esc(q.status)}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>` : `<div style="color:var(--color-text-muted);font-size:var(--text-sm);padding:var(--space-3) 0">No supplier quotes linked yet.</div>`}
    </div>

    <!-- Linked logistics quotes -->
    <div style="margin-bottom:var(--space-6)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
        <h4 style="margin:0">Linked Logistics Quotes</h4>
        <button class="btn btn-ghost btn-sm" onclick="openLinkLogisticsQuoteModal()">Link / Add Quote</button>
      </div>
      ${(linkedLq && linkedLq.length > 0) ? `
      <div class="table-wrapper" style="margin:0"><table>
        <thead><tr><th>Provider</th><th>Route</th><th>Price (USD/MT)</th><th>Validity</th><th>Status</th></tr></thead>
        <tbody>${linkedLq.map(q => `<tr>
          <td>${esc(q.contacts?.company_name || '—')}</td>
          <td>${esc([q.origin_country, q.destination_country].filter(Boolean).join(' → '))}</td>
          <td style="font-family:var(--font-display);font-weight:600">$${fmt(q.price_per_mt_usd)}</td>
          <td>${fmtDate(q.validity_date)}</td>
          <td><span class="badge badge-${q.status === 'active' ? 'success' : 'neutral'}">${esc(q.status)}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>` : `<div style="color:var(--color-text-muted);font-size:var(--text-sm);padding:var(--space-3) 0">No logistics quotes linked yet.</div>`}
    </div>

    <!-- Customer quotes -->
    <div style="margin-bottom:var(--space-8)">
      <h4 style="margin-bottom:var(--space-3)">Customer Quotes</h4>
      ${(customerQuotes && customerQuotes.length > 0) ? `
      <div class="table-wrapper" style="margin:0"><table>
        <thead><tr><th>Price (£/MT)</th><th>Qty (MT)</th><th>Total (£)</th><th>Model</th><th>Validity</th><th>Status</th><th></th></tr></thead>
        <tbody>${customerQuotes.map(cq => {
          let actions = '';
          if (cq.status === 'draft') {
            actions = `<button onclick="updateCqStatus('${esc(cq.id)}','sent')" class="btn btn-secondary btn-sm">Mark Sent</button>`;
          } else if (cq.status === 'sent') {
            actions = `<button onclick="updateCqStatus('${esc(cq.id)}','accepted')" class="btn btn-primary btn-sm" style="margin-right:var(--space-1)">Mark Accepted</button>
                       <button onclick="updateCqStatus('${esc(cq.id)}','rejected')" class="btn btn-secondary btn-sm">Reject</button>`;
          } else if (cq.status === 'accepted') {
            actions = `<button onclick="openConvertOrderModal('${esc(cq.id)}')" class="btn btn-primary btn-sm">Create Order →</button>`;
          }
          return `<tr>
            <td style="font-family:var(--font-display);font-weight:700;color:var(--color-steel)">£${fmt(cq.sell_price_per_mt_gbp)}</td>
            <td>${cq.quantity_mt != null ? fmt(cq.quantity_mt, 0) : '—'}</td>
            <td style="font-family:var(--font-display)">${cq.total_value_gbp ? `£${fmt(cq.total_value_gbp)}` : '—'}</td>
            <td>${cq.pricing_model ? `<span class="badge badge-info">${esc(cq.pricing_model)}</span>` : '—'}</td>
            <td>${fmtDate(cq.validity_date)}</td>
            <td>${cqStatusBadge(cq.status)}</td>
            <td style="white-space:nowrap">${actions}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : `<div style="color:var(--color-text-muted);font-size:var(--text-sm);padding:var(--space-3) 0">No customer quotes created yet.</div>`}
    </div>

    <!-- Notes -->
    <div>
      <label class="form-label">Notes</label>
      <textarea class="form-textarea" id="notes-field" onblur="saveNotes('${esc(_rfqId)}')" placeholder="Add notes...">${esc(data.notes||'')}</textarea>
      <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-2)">Notes auto-save on blur.</p>
    </div>
  `;

  buildCreateQuoteModal(matchedPl, linkedSq || [], linkedLq || []);
}

function field(label, value) {
  return `<div><p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:4px">${label}</p><p style="font-size:var(--text-sm);color:var(--color-text-primary)">${value||'—'}</p></div>`;
}

// ── Link quote modals ─────────────────────────────────────────────────────────

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
      Or <a href="../quotes/index.html" style="color:var(--color-accent)">add a new supplier quote</a> then return here to link it.</p>`);
}

async function submitLinkSupplierQuote() {
  const id = document.getElementById('link-sq-select').value;
  const al = document.getElementById('link-sq-alert');
  if (!id) { al.style.display='block'; al.className='alert alert-error'; al.textContent='Select a quote.'; return; }
  const { error } = await supabaseClient.from('supplier_quotes').update({ rfq_id: _rfqId }).eq('id', id);
  if (error) { al.style.display='block'; al.className='alert alert-error'; al.textContent='Failed: '+error.message; return; }
  closeLinkModal();
  await renderDetail();
}

async function openLinkLogisticsQuoteModal() {
  const { data: quotes } = await supabaseClient
    .from('logistics_quotes').select('id,origin_country,destination_country,price_per_mt_usd,contacts(company_name)').eq('status','active').order('created_at', { ascending: false });
  const opts = (quotes || []).map(q => {
    const route = [q.origin_country, q.destination_country].filter(Boolean).join(' → ');
    return `<option value="${esc(q.id)}">${esc(q.contacts?.company_name || '?')} — ${esc(route)} — $${fmt(q.price_per_mt_usd)}/MT</option>`;
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
      Or <a href="../logistics-quotes/index.html" style="color:var(--color-accent)">add a new logistics quote</a> then return here to link it.</p>`);
}

async function submitLinkLogisticsQuote() {
  const id = document.getElementById('link-lq-select').value;
  const al = document.getElementById('link-lq-alert');
  if (!id) { al.style.display='block'; al.className='alert alert-error'; al.textContent='Select a quote.'; return; }
  const { error } = await supabaseClient.from('logistics_quotes').update({ rfq_id: _rfqId }).eq('id', id);
  if (error) { al.style.display='block'; al.className='alert alert-error'; al.textContent='Failed: '+error.message; return; }
  closeLinkModal();
  await renderDetail();
}

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

// ── Create Customer Quote modal ───────────────────────────────────────────────

function buildCreateQuoteModal(matchedPl, linkedSq, linkedLq) {
  const container = document.getElementById('create-quote-form-container');
  if (!container) return;

  const plOptions = _allProductLines.map(pl =>
    `<option value="${esc(pl.id)}" ${matchedPl && pl.id === matchedPl.id ? 'selected' : ''}>${esc(pl.name)}</option>`
  ).join('');

  const sqOptions = linkedSq.map(q =>
    `<option value="${esc(q.id)}">${esc(q.contacts?.company_name || '?')} — $${fmt(q.fob_price_usd)}/MT</option>`
  ).join('');

  const lqOptions = linkedLq.map(q => {
    const route = [q.origin_country, q.destination_country].filter(Boolean).join(' → ');
    return `<option value="${esc(q.id)}">${esc(q.contacts?.company_name || '?')} — ${esc(route)} — $${fmt(q.price_per_mt_usd)}/MT</option>`;
  }).join('');

  const suggestedPrice = matchedPl?.standard_sell_price_gbp ?? '';
  const suggestedQty   = _rfqData?.quantity_mt ?? '';

  container.innerHTML = `
    <form id="create-quote-form" onsubmit="submitCustomerQuote(event)">
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Product Line</label>
          <select class="form-select" id="cq-product-line"><option value="">— None —</option>${plOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Sell Price (£/MT) <span style="color:var(--color-danger)">*</span></label>
          <input type="number" class="form-input" id="cq-price" value="${suggestedPrice}" step="0.01" min="0" required oninput="updateCqTotal()" />
          ${matchedPl?.standard_sell_price_gbp ? `<span style="font-size:var(--text-xs);color:var(--color-text-muted)">Standard: £${fmt(matchedPl.standard_sell_price_gbp)}/MT</span>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label">Quantity (MT)</label>
          <input type="number" class="form-input" id="cq-qty" value="${suggestedQty}" step="0.1" min="0" oninput="updateCqTotal()" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Total Value (GBP)</label>
          <div id="cq-total" style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;color:var(--color-steel);padding:var(--space-1) 0">—</div>
        </div>
        <div class="form-group">
          <label class="form-label">Pricing Model</label>
          <select class="form-select" id="cq-model">
            <option value="standard">Standard</option>
            <option value="best">Best Price</option>
            <option value="market">Market Rate</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Validity Date</label>
          <input type="date" class="form-input" id="cq-validity" />
        </div>
        ${sqOptions ? `<div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Based on Supplier Quote</label>
          <select class="form-select" id="cq-sq"><option value="">— None —</option>${sqOptions}</select>
        </div>` : ''}
        ${lqOptions ? `<div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Based on Logistics Quote</label>
          <select class="form-select" id="cq-lq"><option value="">— None —</option>${lqOptions}</select>
        </div>` : ''}
      </div>
      <div class="form-group" style="margin-top:var(--space-3)">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="cq-notes" rows="2"></textarea>
      </div>
      <div id="cq-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Create Quote</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('create-quote-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;
  updateCqTotal();
}

function openCreateQuoteModal() {
  document.getElementById('create-quote-modal').classList.add('open');
}

function updateCqTotal() {
  const price = parseFloat(document.getElementById('cq-price')?.value) || 0;
  const qty   = parseFloat(document.getElementById('cq-qty')?.value)   || 0;
  const el    = document.getElementById('cq-total');
  if (!el) return;
  el.textContent = (price && qty) ? `£${(price * qty).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
}

async function submitCustomerQuote(e) {
  e.preventDefault();
  const alertEl  = document.getElementById('cq-alert');
  const price    = parseFloat(document.getElementById('cq-price')?.value);
  const qty      = parseFloat(document.getElementById('cq-qty')?.value)    || null;
  const plId     = document.getElementById('cq-product-line')?.value       || null;
  const model    = document.getElementById('cq-model')?.value              || null;
  const validity = document.getElementById('cq-validity')?.value           || null;
  const sqId     = document.getElementById('cq-sq')?.value                 || null;
  const lqId     = document.getElementById('cq-lq')?.value                 || null;
  const notes    = document.getElementById('cq-notes')?.value.trim()       || null;

  if (!price) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Sell price is required.'; return;
  }

  const { error } = await supabaseClient.from('customer_quotes').insert([{
    rfq_id:                _rfqId,
    product_line_id:       plId,
    supplier_quote_id:     sqId,
    logistics_quote_id:    lqId,
    sell_price_per_mt_gbp: price,
    quantity_mt:           qty,
    total_value_gbp:       qty ? price * qty : null,
    validity_date:         validity,
    pricing_model:         model,
    status:                'draft',
    notes,
  }]);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message; return;
  }

  // Auto-advance to 'quoted' if still new or reviewing
  if (['new', 'reviewing'].includes(_rfqData.status)) {
    await supabaseClient.from('rfq_submissions').update({ status: 'quoted' }).eq('id', _rfqId);
    _rfqData.status = 'quoted';
  }

  document.getElementById('create-quote-modal').classList.remove('open');
  await renderDetail();
}

// ── Shared actions ───────────────────────────────────────────────────────────

async function updateStatus(id, status) {
  await supabaseClient.from('rfq_submissions').update({ status }).eq('id', id);
  if (_rfqData) _rfqData.status = status;
}

async function saveNotes(id) {
  const notes = document.getElementById('notes-field')?.value;
  if (notes != null) await supabaseClient.from('rfq_submissions').update({ notes }).eq('id', id);
}

// ── Customer quote status update ─────────────────────────────────────────────

async function updateCqStatus(id, status) {
  const { error } = await supabaseClient.from('customer_quotes').update({ status }).eq('id', id);
  if (error) { showAlert('Update failed: ' + error.message, 'error'); return; }
  await renderDetail();
}

function showAlert(msg, type = 'info') {
  // Inline alert in the RFQ detail panel (reuse existing pattern)
  const existing = document.getElementById('rfq-alert-inline');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id        = 'rfq-alert-inline';
  el.className = `alert alert-${type === 'error' ? 'error' : 'success'}`;
  el.textContent = msg;
  el.style.marginBottom = 'var(--space-4)';
  const detail = document.getElementById('rfq-detail');
  if (detail) detail.prepend(el);
  setTimeout(() => el.remove(), 4000);
}

// ── Convert customer quote to order ──────────────────────────────────────────

async function openConvertOrderModal(quoteId) {
  const container = document.getElementById('convert-order-form-container');
  container.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">Loading…</p>';
  document.getElementById('convert-order-modal').classList.add('open');

  const [{ data: cq }, { data: buyers }] = await Promise.all([
    supabaseClient.from('customer_quotes')
      .select('*, product_line:product_lines(id,name)')
      .eq('id', quoteId).single(),
    supabaseClient.from('contacts').select('id, company_name').eq('type','buyer').order('company_name'),
  ]);

  if (!cq) {
    container.innerHTML = '<div class="alert alert-error">Quote not found.</div>';
    return;
  }

  const totalGBP   = cq.total_value_gbp ?? (cq.sell_price_per_mt_gbp && cq.quantity_mt
    ? (cq.sell_price_per_mt_gbp * cq.quantity_mt).toFixed(2) : '');
  const productName = cq.product_line?.name || '';

  // Try to pre-select a buyer matching the RFQ company name
  const rfqCompany = (_rfqData?.company || '').toLowerCase();
  const matchedBuyer = (buyers || []).find(b => b.company_name.toLowerCase().includes(rfqCompany) || rfqCompany.includes(b.company_name.toLowerCase()));

  const buyerOptions = (buyers || []).map(b =>
    `<option value="${esc(b.id)}" ${matchedBuyer && b.id === matchedBuyer.id ? 'selected' : ''}>${esc(b.company_name)}</option>`
  ).join('');

  container.innerHTML = `
    <form id="convert-order-form" onsubmit="submitConvertOrder(event,'${esc(quoteId)}')">
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Buyer <span style="color:var(--color-danger)">*</span></label>
          <select class="form-select" id="co-buyer" required>
            <option value="">— Select buyer —</option>${buyerOptions}
          </select>
          ${!matchedBuyer ? `<span style="font-size:var(--text-xs);color:var(--color-text-muted)">No contact matched "${esc(_rfqData?.company || '')}". <a href="../contacts/index.html" style="color:var(--color-accent)" target="_blank">Add contact first</a> if needed.</span>` : ''}
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Customer PO Reference <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-input" id="co-po-ref" required placeholder="The buyer's own PO number" />
        </div>
        <div class="form-group">
          <label class="form-label">Product</label>
          <input type="text" class="form-input" id="co-product" value="${esc(productName)}" placeholder="Product name" />
        </div>
        <div class="form-group">
          <label class="form-label">Quantity (MT)</label>
          <input type="number" class="form-input" id="co-qty" value="${cq.quantity_mt ?? ''}" step="0.001" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Agreed Sell Price (£ total)</label>
          <input type="number" class="form-input" id="co-price" value="${totalGBP}" step="0.01" min="0" />
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">£${fmt(cq.sell_price_per_mt_gbp)}/MT × ${fmt(cq.quantity_mt ?? 0, 0)} MT</span>
        </div>
        <div class="form-group">
          <label class="form-label">Payment Terms</label>
          <input type="text" class="form-input" id="co-payment-terms" placeholder="e.g. 30 days from invoice" />
        </div>
        <div class="form-group">
          <label class="form-label">Verification Priority</label>
          <select class="form-select" id="co-priority">
            <option value="routine">Routine (24 h SLA)</option>
            <option value="expedite">Expedite (4 h SLA)</option>
          </select>
        </div>
      </div>
      <div id="co-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Create Order & Submit for Verification</button>
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
  const qty      = parseFloat(document.getElementById('co-qty').value)   || null;
  const price    = parseFloat(document.getElementById('co-price').value) || null;
  const terms    = document.getElementById('co-payment-terms').value.trim() || null;
  const priority = document.getElementById('co-priority').value || 'routine';

  if (!buyerId || !poRef) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Buyer and customer PO reference are required.'; return;
  }

  btn.disabled = true; btn.textContent = 'Creating order…';
  alertEl.style.display = 'none';

  try {
    const actorId   = (await supabaseClient.auth.getUser()).data?.user?.id;
    const reference = generateOrderReference();
    const slaHours  = priority === 'expedite' ? 4 : 24;

    // Fetch product_line_id from the quote (for linking)
    const { data: cq } = await supabaseClient.from('customer_quotes')
      .select('product_line_id, supplier_quote_id').eq('id', quoteId).single();

    // 1. Create trade in order_drafted state
    const tradePayload = {
      reference,
      buyer_id:              buyerId,
      product_line_id:       cq?.product_line_id || null,
      product:               product,
      quantity_mt:           qty,
      sell_price_gbp:        price,
      customer_po_reference: poRef,
      payment_terms:         terms,
      rfq_id:                _rfqId,
      current_state:         'order_drafted',
      status:                'enquiry', // legacy field
    };

    // Include customer_quote_id if the column exists (added in pricing migration)
    tradePayload.customer_quote_id = quoteId;

    const { data: trade, error: tradeErr } = await supabaseClient
      .from('trades').insert(tradePayload).select('id').single();

    if (tradeErr) {
      // Retry without customer_quote_id if column doesn't exist yet
      if (tradeErr.message.includes('customer_quote_id')) {
        delete tradePayload.customer_quote_id;
        const { data: t2, error: e2 } = await supabaseClient
          .from('trades').insert(tradePayload).select('id').single();
        if (e2) throw new Error(e2.message);
        Object.assign(trade || {}, t2);
      } else {
        throw new Error(tradeErr.message);
      }
    }

    const tid = trade?.id;
    if (!tid) throw new Error('Trade was not created — no ID returned.');

    // 2. Mark customer quote as accepted
    await supabaseClient.from('customer_quotes').update({ status: 'accepted' }).eq('id', quoteId);

    // 3. Create po_translation verification queue item
    await supabaseClient.from('verification_queue').insert({
      trade_id:   tid,
      queue_type: 'po_translation',
      drafted_by: actorId,
      priority,
      sla_due_at: new Date(Date.now() + slaHours * 3600_000).toISOString(),
      status:     'pending',
    });

    // 4. Write first audit event
    await supabaseClient.from('order_events').insert({
      trade_id:   tid,
      event_type: 'state_change',
      from_state: null,
      to_state:   'order_drafted',
      actor_id:   actorId,
      actor_role: 'sales',
      notes:      `Created from customer quote — RFQ ${_rfqId}`,
    });

    // 5. Navigate to the new order
    window.location.href = `../orders/detail.html?id=${tid}`;

  } catch (err) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = err.message;
    btn.disabled = false; btn.textContent = 'Create Order & Submit for Verification';
  }
}

// ── Auto-detect page ──────────────────────────────────────────────────────────

if (document.getElementById('rfq-table-body')) {
  (async () => { const u = await getCurrentUser(); document.getElementById('user-email').textContent = u?.email || ''; loadRfqs(); })();
}
if (document.getElementById('rfq-detail') !== null) {
  (async () => { const u = await getCurrentUser(); document.getElementById('user-email').textContent = u?.email || ''; loadRfqDetail(); })();
}
