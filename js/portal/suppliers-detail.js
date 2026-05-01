/**
 * Vertex Metals Portal — Supplier Detail
 * Handles portal/suppliers/detail.html
 */

function esc(s) { if (s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n,dp=2) { if (n==null||isNaN(n)) return '—'; return Number(n).toLocaleString('en-GB',{minimumFractionDigits:dp,maximumFractionDigits:dp}); }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }

const supplierId = new URLSearchParams(location.search).get('id');
const _tabLoaded = {};

function switchTab(name) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  if (!_tabLoaded[name]) { _tabLoaded[name] = true; loadTabData(name); }
}

async function loadTabData(name) {
  if (name === 'audits')      loadAudits();
  if (name === 'orders')      loadOrders();
  if (name === 'concessions') loadConcessions();
  if (name === 'disputes')    loadDisputes();
  if (name === 'sanctions')   loadSanctions();
  if (name === 'kyc')         loadKyc();
}

const APPROVAL_CLASS = { approved:'badge-success', under_audit:'badge-warning', prospect:'badge-neutral', suspended:'badge-danger', delisted:'badge-danger' };

async function loadAudits() {
  const el = document.getElementById('tab-audits');
  const { data, error } = await supabaseClient.from('supplier_audits').select('*').eq('supplier_id', supplierId).order('audit_date', { ascending: false });
  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!data || data.length === 0) {
    el.innerHTML = `<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No audit records.</p><a href="audit.html?supplier_id=${esc(supplierId)}" class="btn btn-primary btn-sm" style="margin-top:var(--space-3)">Record First Audit</a>`;
    return;
  }
  const outcomeClass = { approved:'badge-success', approved_with_conditions:'badge-warning', not_approved:'badge-danger' };
  el.innerHTML = `<div style="margin-bottom:var(--space-4);text-align:right"><a href="audit.html?supplier_id=${esc(supplierId)}" class="btn btn-primary btn-sm">+ Record Audit</a></div>
  <div class="table-wrapper"><table><thead><tr><th>Date</th><th>Type</th><th>Auditor</th><th>Outcome</th><th>Next Due</th><th>Conditions</th></tr></thead><tbody>
  ${data.map(a => `<tr>
    <td style="font-size:var(--text-sm)">${fmtDate(a.audit_date)}</td>
    <td style="font-size:var(--text-sm)">${esc(a.audit_type?.replace('_',' '))}</td>
    <td style="font-size:var(--text-sm)">${esc(a.auditor_name)}</td>
    <td><span class="badge ${outcomeClass[a.outcome]||'badge-neutral'}">${esc(a.outcome?.replace(/_/g,' '))}</span></td>
    <td style="font-size:var(--text-sm)">${fmtDate(a.next_audit_due_date)}</td>
    <td style="font-size:var(--text-sm);max-width:200px">${esc(a.conditions || '—')}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

async function loadOrders() {
  const el = document.getElementById('tab-orders');
  const { data, error } = await supabaseClient.from('trades').select('id, reference, product, quantity_mt, sell_price_gbp, current_state, created_at, buyer:contacts!trades_buyer_id_fkey(company_name)').eq('supplier_id', supplierId).order('created_at', { ascending: false });
  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!data || data.length === 0) { el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No orders for this supplier.</p>'; return; }
  el.innerHTML = `<div class="table-wrapper"><table><thead><tr><th>Reference</th><th>Buyer</th><th>Product</th><th>Qty</th><th>Value</th><th>State</th></tr></thead><tbody>
  ${data.map(t => `<tr style="cursor:pointer" onclick="location.href='../orders/detail.html?id=${esc(t.id)}'">
    <td style="font-family:var(--font-display);font-weight:600">${esc(t.reference || t.id.slice(0,8))}</td>
    <td style="font-size:var(--text-sm)">${esc(t.buyer?.company_name || '—')}</td>
    <td style="font-size:var(--text-sm)">${esc(t.product || '—')}</td>
    <td style="font-size:var(--text-sm)">${fmt(t.quantity_mt,0)} MT</td>
    <td style="font-size:var(--text-sm)">${t.sell_price_gbp != null ? '£'+fmt(t.sell_price_gbp) : '—'}</td>
    <td>${StateMachine.stateBadge(t.current_state)}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

async function loadConcessions() {
  const el = document.getElementById('tab-concessions');
  const { data, error } = await supabaseClient.from('concessions').select('*, trade:trades(reference, product)').eq('trades.supplier_id', supplierId);
  // Filter client-side since Supabase doesn't support nested eq filter this way
  const { data: tradeIds } = await supabaseClient.from('trades').select('id').eq('supplier_id', supplierId);
  const ids = (tradeIds || []).map(t => t.id);
  if (ids.length === 0) { el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No concessions for this supplier.</p>'; return; }
  const { data: conc, error: concErr } = await supabaseClient.from('concessions').select('*, trade:trades(reference, product)').in('trade_id', ids).order('created_at', { ascending: false });
  if (concErr) { el.innerHTML = `<div class="alert alert-error">${esc(concErr.message)}</div>`; return; }
  if (!conc || conc.length === 0) { el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No concessions for this supplier.</p>'; return; }
  el.innerHTML = `<div class="table-wrapper"><table><thead><tr><th>Order</th><th>Product</th><th>Delta</th><th>Customer Signed</th><th>Adjustment</th></tr></thead><tbody>
  ${conc.map(c => `<tr>
    <td style="font-size:var(--text-sm)">${esc(c.trade?.reference || '—')}</td>
    <td style="font-size:var(--text-sm)">${esc(c.trade?.product || '—')}</td>
    <td style="font-size:var(--text-sm);max-width:200px">${esc(c.delta_summary)}</td>
    <td style="font-size:var(--text-sm)">${fmtDate(c.customer_signed_at)}</td>
    <td style="font-size:var(--text-sm)">${c.commercial_adjustment_gbp != null ? '£'+fmt(c.commercial_adjustment_gbp) : '—'}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

async function loadDisputes() {
  const el = document.getElementById('tab-disputes');
  const { data: tradeIds } = await supabaseClient.from('trades').select('id').eq('supplier_id', supplierId);
  const ids = (tradeIds || []).map(t => t.id);
  if (ids.length === 0) { el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No disputes for this supplier.</p>'; return; }
  const { data, error } = await supabaseClient.from('disputes').select('*, trade:trades(reference)').in('trade_id', ids).order('created_at', { ascending: false });
  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!data || data.length === 0) { el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No disputes for this supplier.</p>'; return; }
  const statusClass = { open:'badge-danger', investigating:'badge-warning', supplier_notified:'badge-info', resolved:'badge-success', escalated:'badge-danger' };
  el.innerHTML = `<div class="table-wrapper"><table><thead><tr><th>Order</th><th>Category</th><th>Status</th><th>Raised</th><th>Resolution</th></tr></thead><tbody>
  ${data.map(d => `<tr style="cursor:pointer" onclick="location.href='../disputes/detail.html?id=${esc(d.id)}'">
    <td style="font-size:var(--text-sm)">${esc(d.trade?.reference || '—')}</td>
    <td style="font-size:var(--text-sm)">${esc(d.category)}</td>
    <td><span class="badge ${statusClass[d.status]||'badge-neutral'}">${esc(d.status?.replace('_',' '))}</span></td>
    <td style="font-size:var(--text-sm)">${fmtDate(d.raised_at)}</td>
    <td style="font-size:var(--text-sm)">${esc(d.resolution || '—')}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

async function loadSanctions() {
  const el = document.getElementById('tab-sanctions');
  const { data, error } = await supabaseClient.from('sanctions_screens').select('*').eq('subject_id', supplierId).order('screened_at', { ascending: false });
  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!data || data.length === 0) { el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No sanctions screens recorded.</p>'; return; }
  const resultClass = { clear:'badge-success', potential_match:'badge-warning', confirmed_match:'badge-danger' };
  el.innerHTML = `<div class="table-wrapper"><table><thead><tr><th>Date</th><th>Lists Screened</th><th>Tool</th><th>Result</th><th>Notes</th></tr></thead><tbody>
  ${data.map(s => `<tr>
    <td style="font-size:var(--text-sm)">${fmtDate(s.screened_at)}</td>
    <td style="font-size:var(--text-sm)">${(s.lists_screened||[]).join(', ')||'—'}</td>
    <td style="font-size:var(--text-sm)">${esc(s.tool_used||'—')}</td>
    <td><span class="badge ${resultClass[s.result]||'badge-neutral'}">${esc(s.result?.replace('_',' '))}</span></td>
    <td style="font-size:var(--text-sm)">${esc(s.match_resolution_notes||'—')}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

async function loadKyc() {
  const el = document.getElementById('tab-kyc');
  const { data, error } = await supabaseClient.from('kyc_records').select('*').eq('contact_id', supplierId).limit(1);
  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!data || data.length === 0) {
    el.innerHTML = `<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No KYC record. <a href="../kyc/index.html">Add one in KYC Records →</a></p>`;
    return;
  }
  const k = data[0];
  const statusClass = { approved:'badge-success', in_progress:'badge-info', pending:'badge-warning', rejected:'badge-danger', expired:'badge-danger' };
  const riskClass = { low:'badge-success', medium:'badge-warning', high:'badge-danger', unrated:'badge-neutral' };
  el.innerHTML = `<div class="panel"><div class="panel-body"><table style="width:100%"><tbody>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0;width:35%">Status</td><td><span class="badge ${statusClass[k.kyc_status]||'badge-neutral'}">${esc(k.kyc_status)}</span></td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Risk Rating</td><td><span class="badge ${riskClass[k.risk_rating]||'badge-neutral'}">${esc(k.risk_rating)}</span></td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Last Screened</td><td>${fmtDate(k.last_screened_date)}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Next Review</td><td>${fmtDate(k.next_review_date)}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Notes</td><td style="font-size:var(--text-sm)">${esc(k.notes||'—')}</td></tr>
  </tbody></table>
  <div style="margin-top:var(--space-4)"><a href="../kyc/detail.html?id=${esc(k.id)}" class="btn btn-ghost btn-sm">Open KYC Record →</a></div>
  </div></div>`;
}

(async () => {
  if (!supplierId) { document.body.innerHTML = '<p style="padding:2rem">No supplier ID specified.</p>'; return; }
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  await StateMachine.loadReference();

  const { data: supplier, error } = await supabaseClient.from('contacts').select('*').eq('id', supplierId).single();
  if (error || !supplier) { document.body.innerHTML = `<p style="padding:2rem;color:var(--color-danger)">Supplier not found.</p>`; return; }

  document.getElementById('topbar-title').textContent = supplier.company_name;
  document.title = `${supplier.company_name} — Vertex Metals Portal`;

  const approvalCls = APPROVAL_CLASS[supplier.approval_status] || 'badge-neutral';
  document.getElementById('supplier-header').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:var(--space-4)">
      <div>
        <h1 style="margin:0 0 var(--space-2)">${esc(supplier.company_name)}</h1>
        <div style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap">
          <span class="badge ${approvalCls}">${esc(supplier.approval_status || 'prospect')}</span>
          ${supplier.country ? `<span style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(supplier.country)}</span>` : ''}
          ${supplier.email ? `<a href="mailto:${esc(supplier.email)}" style="font-size:var(--text-sm);color:var(--color-accent)">${esc(supplier.email)}</a>` : ''}
        </div>
      </div>
      <a href="audit.html?supplier_id=${esc(supplierId)}" class="btn btn-primary btn-sm">Record Audit</a>
    </div>
    <div style="margin-top:var(--space-4);display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-4);font-size:var(--text-sm)">
      <div><div style="color:var(--color-text-muted);margin-bottom:2px">Phone</div>${esc(supplier.phone||'—')}</div>
      <div><div style="color:var(--color-text-muted);margin-bottom:2px">Website</div>${supplier.website?`<a href="${esc(supplier.website)}" target="_blank" style="color:var(--color-accent)">${esc(supplier.website)}</a>`:'—'}</div>
      <div><div style="color:var(--color-text-muted);margin-bottom:2px">Last Sanctions Screen</div>${fmtDate(supplier.last_sanctions_screened_at)} <span style="color:var(--color-text-muted)">(${supplier.last_sanctions_result||'—'})</span></div>
      <div><div style="color:var(--color-text-muted);margin-bottom:2px">Next Audit Due</div>${fmtDate(supplier.next_audit_due_date)}</div>
    </div>
    ${supplier.notes ? `<div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--color-surface);border-radius:var(--radius-sm);font-size:var(--text-sm)">${esc(supplier.notes)}</div>` : ''}
  `;

  _tabLoaded.audits = true;
  loadAudits();
})();
