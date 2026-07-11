/**
 * Vertex Metals Portal — Product Line Detail
 * Handles portal/product-lines/detail.html
 */

function esc(s) { if (s == null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n, dp = 2) { if (n == null || isNaN(n)) return '—'; return Number(n).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

// Keep in sync with FX_USD_PER_GBP in product-lines.js / _calc.fx in rfq.js.
const FX_USD_PER_GBP = 1.27;

function fieldBlock(label, value) {
  return `<div>
    <div style="color:var(--color-text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">${esc(label)}</div>
    <div>${value != null && value !== '' ? value : '—'}</div>
  </div>`;
}

const plId = new URLSearchParams(location.search).get('id');
const _tabLoaded = {};
let plData = null;
let productFamilies = [];

const PRICE_SOURCE_LABELS = { fastmarkets: 'Fastmarkets', smm: 'SMM (Shanghai Metals Market)', manual: 'Manual / Other' };
const RFQ_STATUS_CLASS = { new: 'badge-accent', reviewing: 'badge-info', quoted: 'badge-warning', responded: 'badge-warning', accepted: 'badge-success', closed: 'badge-neutral' };

// ── Tabs ────────────────────────────────────────────────────────────────────

function switchTab(name) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  if (!_tabLoaded[name]) { _tabLoaded[name] = true; loadTabData(name); }
}

function loadTabData(name) {
  if (name === 'overview')   loadOverview();
  if (name === 'grades')     loadGrades();
  if (name === 'compliance') loadCompliance();
  if (name === 'usage')      loadUsage();
}

// ── Sticky header ───────────────────────────────────────────────────────────

function renderHeader() {
  const pl = plData;
  document.getElementById('topbar-title').textContent = pl.name;
  document.getElementById('pl-header').innerHTML = `
    <div class="detail-header__top">
      <div class="detail-header__id">
        <h1>${esc(pl.name)}</h1>
        <div class="detail-header__tags">
          <span class="badge badge-accent">${esc(pl.metal_family || 'Uncategorised')}</span>
          ${pl.physical_form ? `<span style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(pl.physical_form)}</span>` : ''}
          <span class="badge ${pl.active ? 'badge-success' : 'badge-neutral'}">${pl.active ? 'Active' : 'Inactive'}</span>
        </div>
      </div>
      <div class="detail-header__actions">
        <button class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)" onclick="toggleActive()">${pl.active ? 'Deactivate' : 'Activate'}</button>
        <button class="btn btn-primary btn-sm" onclick="openEditPlModal()">Edit Product</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--color-danger);border:1px solid var(--color-border)" onclick="openDeletePlModal()">Delete</button>
      </div>
    </div>
  `;
}

// ── Overview tab ────────────────────────────────────────────────────────────

function loadOverview() {
  const pl = plData;
  const stdUsd = pl.standard_sell_price_usd ?? (pl.standard_sell_price_gbp != null ? pl.standard_sell_price_gbp * FX_USD_PER_GBP : null);
  const stdGbp = pl.standard_sell_price_gbp ?? (pl.standard_sell_price_usd != null ? pl.standard_sell_price_usd / FX_USD_PER_GBP : null);
  const mktUsd = pl.market_reference_price_usd ?? (pl.market_reference_price_gbp != null ? pl.market_reference_price_gbp * FX_USD_PER_GBP : null);
  const mktGbp = pl.market_reference_price_gbp ?? (pl.market_reference_price_usd != null ? pl.market_reference_price_usd / FX_USD_PER_GBP : null);

  document.getElementById('tab-overview').innerHTML = `
    <div class="panel" style="margin-bottom:var(--space-4)">
      <div class="panel-header"><h3>Classification</h3></div>
      <div class="panel-body">
        <div class="form-grid">
          ${fieldBlock('Metal Family', esc(pl.metal_family))}
          ${fieldBlock('Subtype', esc(pl.sub_type))}
          ${fieldBlock('Type', esc(pl.physical_form))}
          ${fieldBlock('CN Code', esc(pl.cn_code))}
        </div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:var(--space-4)">
      <div class="panel-header"><h3>Pricing</h3></div>
      <div class="panel-body">
        <div class="form-grid" style="margin-bottom:var(--space-5)">
          ${fieldBlock('Default Markup', pl.default_markup_pct != null ? `${fmt(pl.default_markup_pct, 1)}%` : null)}
          ${fieldBlock('VAT Rate', `${fmt((pl.vat_rate || 0) * 100, 1)}%`)}
          ${fieldBlock('Insurance', pl.insurance_pct != null ? `${fmt(pl.insurance_pct, 3)}%` : null)}
        </div>
        <div class="form-grid" style="margin-bottom:var(--space-5)">
          ${fieldBlock('Standard Sell Price', stdUsd != null ? `$${fmt(stdUsd)}/MT <span style="color:var(--color-text-muted);font-size:var(--text-xs)">(≈ £${fmt(stdGbp)}/MT)</span>` : null)}
          ${fieldBlock('Latest Price (Fastmarkets/SMM)', mktUsd != null ? `$${fmt(mktUsd)}/MT <span style="color:var(--color-text-muted);font-size:var(--text-xs)">(≈ £${fmt(mktGbp)}/MT)</span>` : null)}
        </div>
        <div class="form-grid">
          ${fieldBlock('Price Source', pl.price_reference_source ? esc(PRICE_SOURCE_LABELS[pl.price_reference_source] || pl.price_reference_source) : null)}
          ${fieldBlock('Price Reference Code', esc(pl.price_reference_code))}
          ${fieldBlock('Price Last Updated', pl.price_reference_updated_at ? fmtDate(pl.price_reference_updated_at) : null)}
        </div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:var(--space-4)">
      <div class="panel-header"><h3>Trade Defaults</h3></div>
      <div class="panel-body">
        <div class="form-grid">
          ${fieldBlock('Default Origin Country', esc(pl.default_origin_country))}
          ${fieldBlock('Default Destination', esc(pl.default_destination))}
        </div>
      </div>
    </div>

    ${pl.notes ? `
    <div class="panel">
      <div class="panel-header"><h3>Notes</h3></div>
      <div class="panel-body"><p style="white-space:pre-wrap;margin:0;font-size:var(--text-sm)">${esc(pl.notes)}</p></div>
    </div>` : ''}
  `;
}

// ── Grades tab ───────────────────────────────────────────────────────────────

let gradesCache = [];

async function loadGrades() {
  const el = document.getElementById('tab-grades');
  el.innerHTML = '<div style="color:var(--color-text-muted);padding:var(--space-4)">Loading…</div>';

  const { data, error } = await supabaseClient.from('product_line_grades').select('*').eq('product_line_id', plId).order('grade');
  if (error) {
    el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`;
    return;
  }
  gradesCache = data || [];

  const rows = gradesCache.length ? `
    <div class="table-wrapper" style="margin:0"><table>
      <thead><tr><th>Grade</th><th>Notes</th><th></th></tr></thead>
      <tbody>${gradesCache.map(g => `<tr>
        <td style="font-weight:600">${esc(g.grade)}</td>
        <td style="color:var(--color-text-muted)">${esc(g.notes || '—')}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-secondary btn-sm" onclick="openEditGradeModal('${esc(g.id)}')">Edit</button>
          <button class="btn btn-secondary btn-sm" onclick="deleteGrade('${esc(g.id)}','${esc(g.grade)}')" style="margin-left:var(--space-2)">Delete</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`
    : `<div style="padding:var(--space-6);text-align:center;color:var(--color-text-muted);font-size:var(--text-sm)">No grades added yet.</div>`;

  el.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3>Available Grades</h3>
        <button class="btn btn-primary btn-sm" onclick="openAddGradeModal()">+ Add Grade</button>
      </div>
      ${rows}
    </div>
  `;
}

function gradeFormHtml(g = {}) {
  return `
    <form id="grade-form" onsubmit="submitGradeForm(event${g.id ? `,'${esc(g.id)}'` : ''})">
      <div class="form-group">
        <label class="form-label">Grade <span style="color:var(--color-danger)">*</span></label>
        <input type="text" class="form-input" id="grade-form-name" value="${esc(g.grade || '')}" required placeholder="e.g. Grade II 99.65%" />
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input type="text" class="form-input" id="grade-form-notes" value="${esc(g.notes || '')}" placeholder="Optional detail" />
      </div>
      <div id="grade-form-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">${g.id ? 'Save Changes' : 'Add Grade'}</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('grade-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;
}

function openAddGradeModal() {
  document.getElementById('grade-modal-title').textContent = 'Add Grade';
  document.getElementById('grade-form-container').innerHTML = gradeFormHtml();
  document.getElementById('grade-modal').classList.add('open');
}

function openEditGradeModal(id) {
  const grade = gradesCache.find(g => g.id === id);
  if (!grade) return;
  document.getElementById('grade-modal-title').textContent = 'Edit Grade';
  document.getElementById('grade-form-container').innerHTML = gradeFormHtml(grade);
  document.getElementById('grade-modal').classList.add('open');
}

async function submitGradeForm(e, id) {
  e.preventDefault();
  const alertEl = document.getElementById('grade-form-alert');
  const grade   = document.getElementById('grade-form-name')?.value.trim();
  const notes   = document.getElementById('grade-form-notes')?.value.trim() || null;

  if (!grade) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Grade is required.';
    return;
  }

  const { error } = id
    ? await supabaseClient.from('product_line_grades').update({ grade, notes }).eq('id', id)
    : await supabaseClient.from('product_line_grades').insert([{ product_line_id: plId, grade, notes }]);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
    return;
  }

  document.getElementById('grade-modal').classList.remove('open');
  loadGrades();
}

async function deleteGrade(id, grade) {
  if (!confirm(`Remove grade '${grade}'?`)) return;
  const { error } = await supabaseClient.from('product_line_grades').delete().eq('id', id);
  if (error) { alert(`Unable to delete grade: ${error.message}`); return; }
  loadGrades();
}

// ── Compliance tab ──────────────────────────────────────────────────────────

async function loadCompliance() {
  const el = document.getElementById('tab-compliance');
  el.innerHTML = '<div style="color:var(--color-text-muted);padding:var(--space-4)">Loading…</div>';

  const pl = plData;
  let family = null;
  if (pl.metal_family) {
    const { data } = await supabaseClient.from('product_families').select('reach_regulated,reach_notes').eq('name', pl.metal_family).limit(1);
    family = data?.[0] || null;
  }

  const reachRow = (label, regulated, notes) => `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4);padding:var(--space-3) 0;border-bottom:1px solid var(--color-border)">
      <div>
        <div style="font-weight:600;font-size:var(--text-sm)">${esc(label)}</div>
        ${notes ? `<div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:2px">${esc(notes)}</div>` : ''}
      </div>
      <span class="badge ${regulated ? 'badge-warning' : 'badge-neutral'}" style="flex-shrink:0">${regulated ? 'Regulated' : 'Not regulated'}</span>
    </div>`;

  el.innerHTML = `
    <div class="panel" style="margin-bottom:var(--space-4)">
      <div class="panel-header"><h3>REACH</h3></div>
      <div class="panel-body">
        ${family ? `
          <p style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-1)">Family default (UK REACH — set in Manage Families)</p>
          ${reachRow(pl.metal_family, family.reach_regulated, family.reach_notes)}
        ` : ''}
        <p style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin:var(--space-4) 0 var(--space-1)">This product line</p>
        ${reachRow('UK REACH', pl.reach_uk_regulated, pl.reach_uk_notes)}
        ${reachRow('EU REACH', pl.reach_eu_regulated, pl.reach_eu_notes)}
      </div>
    </div>
    <div class="panel">
      <div class="panel-header"><h3>Other Import Restrictions</h3></div>
      <div class="panel-body">
        <p style="font-size:var(--text-sm);white-space:pre-wrap;margin:0">${pl.import_restrictions_notes ? esc(pl.import_restrictions_notes) : '<span style="color:var(--color-text-muted)">None recorded.</span>'}</p>
      </div>
    </div>
  `;
}

// ── Usage tab ────────────────────────────────────────────────────────────────

async function loadUsage() {
  const el = document.getElementById('tab-usage');
  el.innerHTML = '<div style="color:var(--color-text-muted);padding:var(--space-4)">Loading…</div>';

  const [rfqLinesRes, sqRes] = await Promise.all([
    supabaseClient.from('rfq_lines')
      .select('id,line_number,quantity,quantity_unit,is_alternative,rfq_submissions(id,company,created_at,status)')
      .eq('product_line_id', plId).order('created_at', { ascending: false }),
    supabaseClient.from('supplier_quotes')
      .select('id,fob_price_usd,pricing_basis,status,created_at,contacts(company_name)')
      .eq('product_line_id', plId).order('created_at', { ascending: false }),
  ]);

  const rfqRows = rfqLinesRes.data || [];
  const sqRows  = sqRes.data || [];

  const rfqTable = rfqRows.length ? `
    <div class="table-wrapper" style="margin:0"><table>
      <thead><tr><th>RFQ</th><th>Date</th><th>Status</th><th style="text-align:right">Qty</th><th></th></tr></thead>
      <tbody>${rfqRows.map(r => `<tr>
        <td>${esc(r.rfq_submissions?.company || '—')}${r.is_alternative ? ' <span class="badge badge-info" style="font-size:10px">Alt</span>' : ''}</td>
        <td style="font-size:var(--text-sm);color:var(--color-text-muted)">${fmtDate(r.rfq_submissions?.created_at)}</td>
        <td><span class="badge ${RFQ_STATUS_CLASS[r.rfq_submissions?.status] || 'badge-neutral'}">${esc(r.rfq_submissions?.status || '—')}</span></td>
        <td style="text-align:right">${r.quantity != null ? fmt(r.quantity, 0) + ' ' + esc(r.quantity_unit || 'MT') : '—'}</td>
        <td><a href="../rfq/detail.html?id=${esc(r.rfq_submissions?.id)}" class="btn btn-ghost btn-sm">View →</a></td>
      </tr>`).join('')}</tbody>
    </table></div>`
    : `<div style="padding:var(--space-6);text-align:center;color:var(--color-text-muted);font-size:var(--text-sm)">No RFQs have used this product line yet.</div>`;

  const sqTable = sqRows.length ? `
    <div class="table-wrapper" style="margin:0"><table>
      <thead><tr><th>Supplier</th><th>Date</th><th>Status</th><th style="text-align:right">Price</th></tr></thead>
      <tbody>${sqRows.map(q => `<tr>
        <td>${esc(q.contacts?.company_name || '—')}</td>
        <td style="font-size:var(--text-sm);color:var(--color-text-muted)">${fmtDate(q.created_at)}</td>
        <td><span class="badge badge-neutral">${esc(q.status || '—')}</span></td>
        <td style="text-align:right">${q.fob_price_usd != null ? `$${fmt(q.fob_price_usd)}` : '—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`
    : `<div style="padding:var(--space-6);text-align:center;color:var(--color-text-muted);font-size:var(--text-sm)">No supplier quotes reference this product line yet.</div>`;

  el.innerHTML = `
    <div class="panel" style="margin-bottom:var(--space-4)">
      <div class="panel-header"><h3>RFQ Lines</h3></div>
      ${rfqTable}
    </div>
    <div class="panel">
      <div class="panel-header"><h3>Supplier Quotes</h3></div>
      ${sqTable}
    </div>
  `;
}

// ── Edit modal ───────────────────────────────────────────────────────────────

function updatePriceGbpPreview(formId, field) {
  const usd = parseFloat(document.getElementById(`${formId}-${field}-price`)?.value);
  const el  = document.getElementById(`${formId}-${field}-gbp-preview`);
  if (!el) return;
  el.textContent = usd > 0 ? `≈ £${fmt(usd / FX_USD_PER_GBP)}/MT (GBP)` : '';
}

function buildPlForm(pl, formId) {
  const stdUsdVal = pl.standard_sell_price_usd   != null ? pl.standard_sell_price_usd
                  : pl.standard_sell_price_gbp   != null ? +(pl.standard_sell_price_gbp   * FX_USD_PER_GBP).toFixed(2)
                  : null;
  const mktUsdVal = pl.market_reference_price_usd != null ? pl.market_reference_price_usd
                  : pl.market_reference_price_gbp  != null ? +(pl.market_reference_price_gbp  * FX_USD_PER_GBP).toFixed(2)
                  : null;
  return `
    <form id="${formId}" onsubmit="submitEditPl(event)">
      <div class="form-grid" style="margin-bottom:var(--space-4)">
        <div class="form-group">
          <label class="form-label">Metal Family <span style="color:var(--color-danger)">*</span></label>
          <select class="form-select" id="${formId}-family" required>
            <option value="">— Select family —</option>
            ${productFamilies.map(f => `<option value="${esc(f.name)}" ${pl.metal_family === f.name ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Subtype</label>
          <input type="text" class="form-input" id="${formId}-subtype" value="${esc(pl.sub_type || '')}" placeholder="e.g. Alloy Wire, EC Grade, 6XXX Series" />
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <input type="text" class="form-input" id="${formId}-form" list="physical-form-options" value="${esc(pl.physical_form || '')}" placeholder="e.g. Ingot, Bar, Rod, Powder" />
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">Physical form — shown on customer quotes; pick a suggestion or type your own</span>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Product Name <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-input" id="${formId}-name" value="${esc(pl.name || '')}" required placeholder="e.g. Aluminium Alloy Core Wire EC Grade" />
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">CN Code</label>
          <input type="text" class="form-input" id="${formId}-cn" value="${esc(pl.cn_code || '')}" placeholder="e.g. 7605 19 00" />
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">Combined Nomenclature code — used for CBAM reporting</span>
        </div>
        <div class="form-group">
          <label class="form-label">Default Markup (%)</label>
          <input type="number" class="form-input" id="${formId}-markup" value="${pl.default_markup_pct ?? 10}" step="0.1" min="0" max="100" />
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">Applied automatically when creating a trade — can be overridden</span>
        </div>
        <div class="form-group">
          <label class="form-label">VAT Rate (%)</label>
          <input type="number" class="form-input" id="${formId}-vat" value="${fmt((pl.vat_rate || 0.20) * 100, 1)}" step="0.1" min="0" max="100" />
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">20% standard rate · 0% if zero-rated</span>
        </div>
        <div class="form-group">
          <label class="form-label">Insurance (%)</label>
          <input type="number" class="form-input" id="${formId}-ins" value="${pl.insurance_pct ?? 0.125}" step="0.001" min="0" max="10" />
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">% of total FOB value — auto-calculated but editable per trade</span>
        </div>
      </div>
      <div style="border-top:1px solid var(--color-border);margin:var(--space-5) 0 var(--space-4);padding-top:var(--space-4)">
        <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-3)">Pricing Reference</p>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Standard Sell Price ($/MT)</label>
            <input type="number" class="form-input" id="${formId}-std-price" value="${stdUsdVal ?? ''}" step="0.01" min="0" placeholder="e.g. 1600.00"
                   oninput="updatePriceGbpPreview('${formId}','std')" />
            <span id="${formId}-std-gbp-preview" style="font-size:var(--text-xs);color:var(--color-text-muted)">${stdUsdVal ? `≈ £${fmt(stdUsdVal / FX_USD_PER_GBP)}/MT (GBP)` : 'Saved automatically from the pricing calculator'}</span>
          </div>
          <div class="form-group">
            <label class="form-label">Latest Price — Fastmarkets/SMM ($/MT)</label>
            <input type="number" class="form-input" id="${formId}-mkt-price" value="${mktUsdVal ?? ''}" step="0.01" min="0" placeholder="From Fastmarkets/SMM"
                   oninput="updatePriceGbpPreview('${formId}','mkt')" />
            <span id="${formId}-mkt-gbp-preview" style="font-size:var(--text-xs);color:var(--color-text-muted)">${mktUsdVal ? `≈ £${fmt(mktUsdVal / FX_USD_PER_GBP)}/MT (GBP)` : 'Used by the Market Rate pricing model'}</span>
          </div>
          <div class="form-group">
            <label class="form-label">Price Source</label>
            <select class="form-select" id="${formId}-price-source">
              <option value="">— Not set —</option>
              <option value="fastmarkets" ${pl.price_reference_source === 'fastmarkets' ? 'selected' : ''}>Fastmarkets</option>
              <option value="smm" ${pl.price_reference_source === 'smm' ? 'selected' : ''}>SMM (Shanghai Metals Market)</option>
              <option value="manual" ${pl.price_reference_source === 'manual' ? 'selected' : ''}>Manual / Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Price Reference Code</label>
            <input type="text" class="form-input" id="${formId}-price-code" value="${esc(pl.price_reference_code || '')}" placeholder="e.g. MB-SB-0001" />
          </div>
          <div class="form-group">
            <label class="form-label">Price Last Updated</label>
            <input type="date" class="form-input" id="${formId}-price-updated" value="${esc(pl.price_reference_updated_at || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Default Origin Country</label>
            <input type="text" class="form-input" id="${formId}-origin" value="${esc(pl.default_origin_country || '')}" placeholder="e.g. India" />
          </div>
          <div class="form-group">
            <label class="form-label">Default Destination</label>
            <input type="text" class="form-input" id="${formId}-dest" value="${esc(pl.default_destination || '')}" placeholder="e.g. United Kingdom" />
          </div>
        </div>
      </div>
      <div style="border-top:1px solid var(--color-border);margin:var(--space-5) 0 var(--space-4);padding-top:var(--space-4)">
        <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-3)">Compliance</p>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer">
              <input type="checkbox" id="${formId}-reach-uk" ${pl.reach_uk_regulated ? 'checked' : ''} /> UK REACH regulated
            </label>
          </div>
          <div class="form-group">
            <label class="form-label" style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer">
              <input type="checkbox" id="${formId}-reach-eu" ${pl.reach_eu_regulated ? 'checked' : ''} /> EU REACH regulated
            </label>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">UK REACH Notes</label>
            <input type="text" class="form-input" id="${formId}-reach-uk-notes" value="${esc(pl.reach_uk_notes || '')}" placeholder="e.g. SVHC candidate — registration no. XXXXXXXX" />
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">EU REACH Notes</label>
            <input type="text" class="form-input" id="${formId}-reach-eu-notes" value="${esc(pl.reach_eu_notes || '')}" placeholder="e.g. Annex XIV / XVII restriction detail" />
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Other Import Restrictions</label>
            <textarea class="form-textarea" id="${formId}-import-restrictions" rows="2" placeholder="e.g. Import licence required, quota, dual-use export control classification">${esc(pl.import_restrictions_notes || '')}</textarea>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="${formId}-notes" rows="2">${esc(pl.notes || '')}</textarea>
      </div>
      <div id="${formId}-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Save Changes</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('edit-pl-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;
}

function openEditPlModal() {
  document.getElementById('edit-pl-form-container').innerHTML = buildPlForm(plData, 'edit-pl-form');
  document.getElementById('edit-pl-modal').classList.add('open');
}

function getPlPayload(formId) {
  const vatPct    = parseFloat(document.getElementById(`${formId}-vat`)?.value) || 0;
  const markup    = parseFloat(document.getElementById(`${formId}-markup`)?.value) ?? 10;
  const ins       = parseFloat(document.getElementById(`${formId}-ins`)?.value) ?? 0.125;
  const stdUsdRaw = document.getElementById(`${formId}-std-price`)?.value.trim();
  const mktUsdRaw = document.getElementById(`${formId}-mkt-price`)?.value.trim();
  const stdUsd    = stdUsdRaw ? parseFloat(stdUsdRaw) : null;
  const mktUsd    = mktUsdRaw ? parseFloat(mktUsdRaw) : null;
  return {
    metal_family:                document.getElementById(`${formId}-family`)?.value.trim() || null,
    sub_type:                    document.getElementById(`${formId}-subtype`)?.value.trim() || null,
    physical_form:               document.getElementById(`${formId}-form`)?.value.trim() || null,
    name:                        document.getElementById(`${formId}-name`)?.value.trim(),
    cn_code:                     document.getElementById(`${formId}-cn`)?.value.trim() || null,
    default_markup_pct:          markup,
    vat_rate:                    vatPct / 100,
    insurance_pct:               ins,
    standard_sell_price_usd:     stdUsd,
    standard_sell_price_gbp:     stdUsd != null ? +(stdUsd / FX_USD_PER_GBP).toFixed(2) : null,
    market_reference_price_usd:  mktUsd,
    market_reference_price_gbp:  mktUsd != null ? +(mktUsd / FX_USD_PER_GBP).toFixed(2) : null,
    price_reference_source:      document.getElementById(`${formId}-price-source`)?.value || null,
    price_reference_code:        document.getElementById(`${formId}-price-code`)?.value.trim() || null,
    price_reference_updated_at:  document.getElementById(`${formId}-price-updated`)?.value || null,
    default_origin_country:      document.getElementById(`${formId}-origin`)?.value.trim() || null,
    default_destination:         document.getElementById(`${formId}-dest`)?.value.trim() || null,
    reach_uk_regulated:          document.getElementById(`${formId}-reach-uk`)?.checked || false,
    reach_uk_notes:              document.getElementById(`${formId}-reach-uk-notes`)?.value.trim() || null,
    reach_eu_regulated:          document.getElementById(`${formId}-reach-eu`)?.checked || false,
    reach_eu_notes:              document.getElementById(`${formId}-reach-eu-notes`)?.value.trim() || null,
    import_restrictions_notes:   document.getElementById(`${formId}-import-restrictions`)?.value.trim() || null,
    notes:                       document.getElementById(`${formId}-notes`)?.value.trim() || null,
  };
}

async function submitEditPl(e) {
  e.preventDefault();
  const alertEl = document.getElementById('edit-pl-form-alert');
  const payload = getPlPayload('edit-pl-form');

  if (!payload.name) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Product name is required.'; return;
  }

  const { error } = await supabaseClient.from('product_lines').update(payload).eq('id', plId);
  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
    return;
  }

  document.getElementById('edit-pl-modal').classList.remove('open');
  await reloadPl();
  renderHeader();
  loadOverview();
  if (_tabLoaded.compliance) loadCompliance();
}

async function toggleActive() {
  await supabaseClient.from('product_lines').update({ active: !plData.active }).eq('id', plId);
  await reloadPl();
  renderHeader();
}

// ── Delete modal ─────────────────────────────────────────────────────────────

function openDeletePlModal() {
  document.getElementById('delete-pl-name-display').textContent = plData.name;
  document.getElementById('delete-pl-confirm-input').value = '';
  document.getElementById('delete-pl-error').textContent = '';
  document.getElementById('delete-pl-btn').disabled = true;
  document.getElementById('delete-pl-modal').classList.add('open');
}

function onDeletePlConfirmInput(value) {
  document.getElementById('delete-pl-btn').disabled = value.trim() !== plData.name;
}

async function confirmDeletePl() {
  const btn = document.getElementById('delete-pl-btn');
  const errEl = document.getElementById('delete-pl-error');
  btn.disabled = true; btn.textContent = 'Checking…'; errEl.textContent = '';

  const [rfqSub, rfqLine, sq, cql] = await Promise.all([
    supabaseClient.from('rfq_submissions').select('id', { count: 'exact', head: true }).eq('product_line_id', plId),
    supabaseClient.from('rfq_lines').select('id', { count: 'exact', head: true }).eq('product_line_id', plId),
    supabaseClient.from('supplier_quotes').select('id', { count: 'exact', head: true }).eq('product_line_id', plId),
    supabaseClient.from('customer_quote_lines').select('id', { count: 'exact', head: true }).eq('product_line_id', plId),
  ]);

  const totalUses = (rfqSub.count || 0) + (rfqLine.count || 0) + (sq.count || 0) + (cql.count || 0);
  if (totalUses > 0) {
    errEl.textContent = `Cannot delete — this product line is referenced by ${totalUses} existing record${totalUses === 1 ? '' : 's'} (RFQs, quote lines, or supplier quotes).`;
    btn.disabled = false; btn.textContent = 'Delete Product Line';
    return;
  }

  btn.textContent = 'Deleting…';
  const { error } = await supabaseClient.from('product_lines').delete().eq('id', plId);
  if (error) {
    errEl.textContent = 'Delete failed: ' + error.message;
    btn.disabled = false; btn.textContent = 'Delete Product Line';
    return;
  }

  window.location.href = 'index.html';
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function reloadPl() {
  const { data } = await supabaseClient.from('product_lines').select('*').eq('id', plId).single();
  plData = data;
}

(async () => {
  const user = await getCurrentUser();
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user?.email || '';

  if (!plId) {
    document.getElementById('pl-header').innerHTML = '<div class="alert alert-error">No product line ID specified.</div>';
    return;
  }

  const [plRes, familiesRes] = await Promise.all([
    supabaseClient.from('product_lines').select('*').eq('id', plId).single(),
    supabaseClient.from('product_families').select('name').order('name'),
  ]);

  if (plRes.error || !plRes.data) {
    document.getElementById('pl-header').innerHTML = `<div class="alert alert-error">${esc(plRes.error?.message || 'Product line not found')}</div>`;
    return;
  }

  plData = plRes.data;
  productFamilies = familiesRes.data || [];

  renderHeader();
  loadTabData('overview');
})();
