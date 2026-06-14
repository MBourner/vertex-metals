/**
 * Vertex Metals Portal — Customer Detail
 * Handles portal/customers/detail.html
 */

function esc(s) { if (s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n,dp=2) { if (n==null||isNaN(n)) return '—'; return Number(n).toLocaleString('en-GB',{minimumFractionDigits:dp,maximumFractionDigits:dp}); }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }

// Renders a label/value pair, falling back to an em-dash for empty values.
function fieldBlock(label, value) {
  return `<div>
    <div style="color:var(--color-text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">${esc(label)}</div>
    <div>${value != null && value !== '' ? esc(String(value)) : '—'}</div>
  </div>`;
}

function formatAddress(line1, line2, city, postcode, country) {
  const parts = [line1, line2, city, postcode, country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

const customerId = new URLSearchParams(location.search).get('id');
const _tabLoaded = {};
let customerData = null;
let kycData = null;

const KYC_CLASS = { approved:'badge-success', in_progress:'badge-info', pending:'badge-warning', rejected:'badge-danger', expired:'badge-danger' };
const RISK_CLASS = { low:'badge-success', medium:'badge-warning', high:'badge-danger', unrated:'badge-neutral' };
const RFQ_STATUS_CLASS = { new:'badge-accent', reviewing:'badge-info', quoted:'badge-warning', responded:'badge-warning', accepted:'badge-success', closed:'badge-neutral' };
const DISPUTE_STATUS_CLASS = { open:'badge-danger', investigating:'badge-warning', supplier_notified:'badge-info', resolved:'badge-success', escalated:'badge-danger' };

function kycBadge(status) {
  if (!status) return '<span class="badge badge-neutral">No KYC</span>';
  return `<span class="badge ${KYC_CLASS[status]||'badge-neutral'}">${esc(status.replace(/_/g,' '))}</span>`;
}

// ── Tabs ──────────────────────────────────────────────────────────────────

function switchTab(name) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  if (!_tabLoaded[name]) { _tabLoaded[name] = true; loadTabData(name); }
}

async function loadTabData(name) {
  if (name === 'overview') loadOverview();
  if (name === 'rfqs')     loadRfqsTab();
  if (name === 'orders')   loadOrdersTab();
  if (name === 'disputes') loadDisputesTab();
  if (name === 'kyc')      loadKycTab();
}

// ── Sticky header ─────────────────────────────────────────────────────────

function renderHeader() {
  const c = customerData;
  document.getElementById('customer-header').innerHTML = `
    <div class="detail-header__top">
      <div class="detail-header__id">
        <h1>${esc(c.company_name)}</h1>
        <div class="detail-header__tags">
          <span class="badge badge-accent">Customer</span>
          ${c.country ? `<span style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(c.country)}</span>` : ''}
          ${kycBadge(kycData?.kyc_status)}
        </div>
      </div>
      <div class="detail-header__actions">
        <a href="../rfq/index.html?action=new&company=${encodeURIComponent(c.company_name||'')}&email=${encodeURIComponent(c.email||'')}" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)">+ New RFQ</a>
        <a href="../orders/new.html?buyer_id=${esc(c.id)}" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)">+ New Order</a>
        <button class="btn btn-primary btn-sm" onclick="openEditModal()">Edit Customer</button>
      </div>
    </div>
  `;
}

// ── Overview tab ──────────────────────────────────────────────────────────

function companyInfoHtml(c) {
  const address = formatAddress(c.address_line_1, c.address_line_2, c.city, c.postcode, c.country);
  return `
    ${fieldBlock('Primary Contact', c.primary_contact_name)}
    ${fieldBlock('Email', c.email)}
    ${fieldBlock('Phone', c.phone)}
    ${fieldBlock('Website', c.website)}
    ${fieldBlock('Address', address)}
    ${fieldBlock('VAT Number', c.vat_number)}
    ${fieldBlock('Company Registration Number', c.company_registration_number)}
  `;
}

function complianceHtml(k) {
  if (!k) {
    return `<p style="color:var(--color-text-muted);font-size:var(--text-sm);margin:0">No KYC record. <a href="../kyc/index.html">Add one in KYC Records →</a></p>`;
  }
  return `
    <div>
      <div style="color:var(--color-text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">KYC Status</div>
      ${kycBadge(k.kyc_status)}
    </div>
    <div>
      <div style="color:var(--color-text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Risk Rating</div>
      <span class="badge ${RISK_CLASS[k.risk_rating]||'badge-neutral'}">${esc(k.risk_rating||'unrated')}</span>
    </div>
    ${fieldBlock('Last Screened', fmtDate(k.last_screened_date))}
    ${fieldBlock('Next Review', fmtDate(k.next_review_date))}
    <div><a href="../kyc/detail.html?id=${esc(k.id)}" class="btn btn-ghost btn-sm">Open KYC Record →</a></div>
  `;
}

async function activitySnapshotHtml() {
  const c = customerData;

  const [rfqRes, ordersRes, allOrdersRes] = await Promise.all([
    supabaseClient
      .from('rfq_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'buyer')
      .not('status', 'eq', 'closed')
      .ilike('company', c.company_name),

    supabaseClient
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', customerId)
      .not('current_state', 'in', '("complete","cancelled")'),

    supabaseClient
      .from('trades')
      .select('sell_price_gbp, created_at')
      .eq('buyer_id', customerId),
  ]);

  const orders = allOrdersRes.data || [];
  const lifetimeValue = orders.reduce((sum, t) => sum + (Number(t.sell_price_gbp) || 0), 0);
  const lastActivity = orders.length
    ? orders.map(t => t.created_at).sort().slice(-1)[0]
    : null;

  return `
    ${fieldBlock('Open RFQs', rfqRes.count ?? 0)}
    ${fieldBlock('Active Orders', ordersRes.count ?? 0)}
    ${fieldBlock('Lifetime Order Value', '£' + fmt(lifetimeValue))}
    ${fieldBlock('Last Activity', fmtDate(lastActivity))}
  `;
}

async function recentActivityHtml() {
  const c = customerData;

  const [rfqRes, ordersRes] = await Promise.all([
    supabaseClient
      .from('rfq_submissions')
      .select('id, created_at, product, status')
      .ilike('company', c.company_name)
      .order('created_at', { ascending: false })
      .limit(8),

    supabaseClient
      .from('trades')
      .select('id, reference, created_at, product, current_state')
      .eq('buyer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const items = [
    ...(rfqRes.data || []).map(r => ({ date: r.created_at, source: 'RFQ', text: `${r.product || 'Enquiry'} — ${r.status}` })),
    ...(ordersRes.data || []).map(t => ({ date: t.created_at, source: 'Order', text: `${t.reference || t.id.slice(0,8)} — ${t.product || ''} (${t.current_state})` })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  if (!items.length) return '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No activity recorded yet.</p>';

  return items.map(i => `<div class="activity-item">
    <span class="activity-item__date">${fmtDate(i.date)}</span>
    <span class="activity-item__source">${esc(i.source)}</span>
    <span>${esc(i.text)}</span>
  </div>`).join('');
}

async function loadOverview() {
  const el = document.getElementById('tab-overview');
  const c = customerData;

  el.innerHTML = `
    <div class="overview-grid">
      <div class="panel">
        <div class="panel-header"><h3>Company Info</h3></div>
        <div class="panel-body overview-card-body">${companyInfoHtml(c)}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>KYC / Compliance</h3></div>
        <div class="panel-body overview-card-body">${complianceHtml(kycData)}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Activity Snapshot</h3></div>
        <div class="panel-body overview-card-body" id="activity-snapshot"><div style="color:var(--color-text-muted)">Loading…</div></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-header">
        <h3>Recent Activity</h3>
        <a href="#" onclick="switchTab('rfqs');return false" class="btn btn-ghost btn-sm">View RFQs →</a>
      </div>
      <div class="panel-body" id="recent-activity"><div style="color:var(--color-text-muted)">Loading…</div></div>
    </div>
  `;

  document.getElementById('activity-snapshot').innerHTML = await activitySnapshotHtml();
  document.getElementById('recent-activity').innerHTML = await recentActivityHtml();
}

// ── RFQs tab ──────────────────────────────────────────────────────────────

async function loadRfqsTab() {
  const el = document.getElementById('tab-rfqs');
  const c = customerData;

  const { data, error } = await supabaseClient
    .from('rfq_submissions')
    .select('*')
    .ilike('company', c.company_name)
    .order('created_at', { ascending: false });

  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!data || data.length === 0) { el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No RFQs found for this customer.</p>'; return; }

  el.innerHTML = `<div class="table-wrapper"><table><thead><tr><th>Date</th><th>Contact</th><th>Product</th><th>Quantity</th><th>Status</th></tr></thead><tbody>
  ${data.map(r => `<tr style="cursor:pointer" onclick="location.href='../rfq/detail.html?id=${esc(r.id)}'">
    <td style="font-size:var(--text-sm)">${fmtDate(r.created_at)}</td>
    <td style="font-size:var(--text-sm)">${esc(r.name || '—')}</td>
    <td style="font-size:var(--text-sm)">${esc(r.product || '—')}</td>
    <td style="font-size:var(--text-sm)">${r.quantity_mt != null ? fmt(r.quantity_mt,0) + ' MT' : '—'}</td>
    <td><span class="badge ${RFQ_STATUS_CLASS[r.status]||'badge-neutral'}">${esc(r.status)}</span></td>
  </tr>`).join('')}</tbody></table></div>`;
}

// ── Orders tab ────────────────────────────────────────────────────────────

async function loadOrdersTab() {
  const el = document.getElementById('tab-orders');

  const { data, error } = await supabaseClient
    .from('trades')
    .select('id, reference, product, quantity_mt, sell_price_gbp, current_state, created_at')
    .eq('buyer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!data || data.length === 0) { el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No orders for this customer.</p>'; return; }

  el.innerHTML = `<div class="table-wrapper"><table><thead><tr><th>Reference</th><th>Product</th><th>Qty</th><th>Value</th><th>State</th></tr></thead><tbody>
  ${data.map(t => `<tr style="cursor:pointer" onclick="location.href='../orders/detail.html?id=${esc(t.id)}'">
    <td style="font-family:var(--font-display);font-weight:600">${esc(t.reference || t.id.slice(0,8))}</td>
    <td style="font-size:var(--text-sm)">${esc(t.product || '—')}</td>
    <td style="font-size:var(--text-sm)">${fmt(t.quantity_mt,0)} MT</td>
    <td style="font-size:var(--text-sm)">${t.sell_price_gbp != null ? '£'+fmt(t.sell_price_gbp) : '—'}</td>
    <td>${StateMachine.stateBadge(t.current_state)}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

// ── Disputes tab ──────────────────────────────────────────────────────────

async function loadDisputesTab() {
  const el = document.getElementById('tab-disputes');

  const { data: tradeIds } = await supabaseClient.from('trades').select('id').eq('buyer_id', customerId);
  const ids = (tradeIds || []).map(t => t.id);
  if (ids.length === 0) { el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No disputes for this customer.</p>'; return; }

  const { data, error } = await supabaseClient.from('disputes').select('*, trade:trades(reference)').in('trade_id', ids).order('created_at', { ascending: false });
  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!data || data.length === 0) { el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No disputes for this customer.</p>'; return; }

  el.innerHTML = `<div class="table-wrapper"><table><thead><tr><th>Order</th><th>Category</th><th>Status</th><th>Raised</th><th>Resolution</th></tr></thead><tbody>
  ${data.map(d => `<tr style="cursor:pointer" onclick="location.href='../disputes/detail.html?id=${esc(d.id)}'">
    <td style="font-size:var(--text-sm)">${esc(d.trade?.reference || '—')}</td>
    <td style="font-size:var(--text-sm)">${esc(d.category)}</td>
    <td><span class="badge ${DISPUTE_STATUS_CLASS[d.status]||'badge-neutral'}">${esc(d.status?.replace('_',' '))}</span></td>
    <td style="font-size:var(--text-sm)">${fmtDate(d.raised_at)}</td>
    <td style="font-size:var(--text-sm)">${esc(d.resolution || '—')}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

// ── KYC tab ───────────────────────────────────────────────────────────────

async function loadKycTab() {
  const el = document.getElementById('tab-kyc');
  const k = kycData;

  if (!k) {
    el.innerHTML = `<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No KYC record. <a href="../kyc/index.html">Add one in KYC Records →</a></p>`;
    return;
  }

  el.innerHTML = `<div class="panel"><div class="panel-body"><table style="width:100%"><tbody>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0;width:35%">Status</td><td>${kycBadge(k.kyc_status)}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Risk Rating</td><td><span class="badge ${RISK_CLASS[k.risk_rating]||'badge-neutral'}">${esc(k.risk_rating||'unrated')}</span></td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Last Screened</td><td>${fmtDate(k.last_screened_date)}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Next Review</td><td>${fmtDate(k.next_review_date)}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Notes</td><td style="font-size:var(--text-sm)">${esc(k.notes||'—')}</td></tr>
  </tbody></table>
  <div style="margin-top:var(--space-4)"><a href="../kyc/detail.html?id=${esc(k.id)}" class="btn btn-ghost btn-sm">Open KYC Record →</a></div>
  </div></div>`;
}

// ── Edit Customer modal ──────────────────────────────────────────────────

function buildCustomerFormHtml(c = {}) {
  return `
    <form id="edit-customer-form" onsubmit="submitEditCustomer(event)">
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Company Name <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-input" id="ec-company" value="${esc(c.company_name || '')}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Primary Contact Name</label>
          <input type="text" class="form-input" id="ec-contact-name" value="${esc(c.primary_contact_name || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="ec-email" value="${esc(c.email || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input type="text" class="form-input" id="ec-phone" value="${esc(c.phone || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Website</label>
          <input type="url" class="form-input" id="ec-website" value="${esc(c.website || '')}" placeholder="https://" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Address Line 1</label>
          <input type="text" class="form-input" id="ec-address1" value="${esc(c.address_line_1 || '')}" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Address Line 2</label>
          <input type="text" class="form-input" id="ec-address2" value="${esc(c.address_line_2 || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">City</label>
          <input type="text" class="form-input" id="ec-city" value="${esc(c.city || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Postcode</label>
          <input type="text" class="form-input" id="ec-postcode" value="${esc(c.postcode || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Country</label>
          <input type="text" class="form-input" id="ec-country" value="${esc(c.country || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">VAT Number</label>
          <input type="text" class="form-input" id="ec-vat" value="${esc(c.vat_number || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Company Registration Number</label>
          <input type="text" class="form-input" id="ec-regnumber" value="${esc(c.company_registration_number || '')}" />
        </div>
      </div>
      <div class="form-group" style="margin-top:var(--space-2)">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="ec-notes" rows="3">${esc(c.notes || '')}</textarea>
      </div>
      <div id="edit-customer-form-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Save Changes</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('edit-customer-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>
  `;
}

function openEditModal() {
  document.getElementById('edit-customer-form-container').innerHTML = buildCustomerFormHtml(customerData);
  document.getElementById('edit-customer-modal').classList.add('open');
}

async function submitEditCustomer(e) {
  e.preventDefault();
  const alertEl = document.getElementById('edit-customer-form-alert');

  const payload = {
    company_name:                document.getElementById('ec-company').value.trim() || null,
    primary_contact_name:        document.getElementById('ec-contact-name').value.trim() || null,
    email:                       document.getElementById('ec-email').value.trim() || null,
    phone:                       document.getElementById('ec-phone').value.trim() || null,
    website:                     document.getElementById('ec-website').value.trim() || null,
    address_line_1:              document.getElementById('ec-address1').value.trim() || null,
    address_line_2:              document.getElementById('ec-address2').value.trim() || null,
    city:                        document.getElementById('ec-city').value.trim() || null,
    postcode:                    document.getElementById('ec-postcode').value.trim() || null,
    country:                     document.getElementById('ec-country').value.trim() || null,
    vat_number:                  document.getElementById('ec-vat').value.trim() || null,
    company_registration_number: document.getElementById('ec-regnumber').value.trim() || null,
    notes:                       document.getElementById('ec-notes').value.trim() || null,
  };

  if (!payload.company_name) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Company name is required.'; return;
  }

  const { error } = await supabaseClient.from('contacts').update(payload).eq('id', customerId);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
  } else {
    customerData = { ...customerData, ...payload };
    document.getElementById('edit-customer-modal').classList.remove('open');
    renderHeader();
    if (_tabLoaded.overview) loadOverview();
  }
}

// ── Init ─────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user?.email || '';

  if (!customerId) {
    document.getElementById('customer-header').innerHTML = '<div class="alert alert-error">No customer ID specified.</div>';
    return;
  }

  const [customerRes, kycRes] = await Promise.all([
    supabaseClient.from('contacts').select('*').eq('id', customerId).single(),
    supabaseClient.from('kyc_records').select('*').eq('contact_id', customerId).limit(1),
  ]);

  if (customerRes.error || !customerRes.data) {
    document.getElementById('customer-header').innerHTML = `<div class="alert alert-error">${esc(customerRes.error?.message || 'Customer not found')}</div>`;
    return;
  }

  customerData = customerRes.data;
  kycData = kycRes.data?.[0] || null;

  document.title = `${customerData.company_name} — Vertex Metals Portal`;
  document.getElementById('topbar-title').textContent = customerData.company_name;

  renderHeader();
  loadOverview();
})();
