/**
 * Vertex Metals Portal — Product Lines
 * Product catalogue with default pricing parameters for trade auto-calculation.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// FX rate used throughout the portal for USD ↔ GBP conversion.
// Keep in sync with _calc.fx in rfq.js — update here when rate changes.
const FX_USD_PER_GBP = 1.27;

function updatePriceGbpPreview(formId, field) {
  const usd = parseFloat(document.getElementById(`${formId}-${field}-price`)?.value);
  const el  = document.getElementById(`${formId}-${field}-gbp-preview`);
  if (!el) return;
  el.textContent = usd > 0 ? `≈ £${fmt(usd / FX_USD_PER_GBP)}/MT (GBP)` : '';
}

let productFamilies = [];


async function loadFamilies() {
  const sel = document.getElementById('filter-family');
  if (!sel) return;
  sel.innerHTML = '<option value="">All families</option>';

  try {
    const { data, error } = await supabaseClient.from('product_families').select('*').order('name');
    if (error) throw error;
    productFamilies = (data || []).filter(f => f.active !== false);
  } catch (error) {
    console.warn('Unable to load product_families table, falling back to distinct metal_family values:', error.message);
    const { data: allFamilies, error: legacyError } = await supabaseClient.from('product_lines').select('metal_family').order('metal_family');
    if (legacyError) {
      console.error('Unable to load legacy family values:', legacyError.message);
      productFamilies = [];
    } else {
      const names = [...new Set((allFamilies || []).map(r => r.metal_family).filter(Boolean))];
      productFamilies = names.map(name => ({ id: null, name, active: true }));
    }
  }

  productFamilies.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.name;
    opt.textContent = f.name;
    sel.appendChild(opt);
  });

  const addContainer = document.getElementById('add-pl-form-container');
  if (addContainer) {
    addContainer.innerHTML = buildPlForm({}, 'add-pl-form', 'submitAddPl(event)', 'add-pl-modal');
  }
  const editContainer = document.getElementById('edit-pl-form-container');
  if (editContainer && editContainer.innerHTML.trim()) {
    // Keep edit form updated for open edit modal if present.
    const editFormId = 'edit-pl-form';
    const editPlId = editContainer.dataset.plId;
    if (editPlId) {
      openEditModal(editPlId);
    }
  }
}

// ── List ─────────────────────────────────────────────────────────────────────

async function loadProductLines() {
  const tbody        = document.getElementById('pl-body');
  const familyFilter = document.getElementById('filter-family')?.value || '';

  let query = supabaseClient.from('product_lines').select('*')
    .order('metal_family').order('sub_type').order('name');
  if (familyFilter) query = query.eq('metal_family', familyFilter);

  const { data, error } = await query;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No product lines yet.</td></tr>';
    return;
  }

  // Group rows by metal_family for section headers
  const grouped = {};
  data.forEach(pl => {
    const family = pl.metal_family || 'Other';
    if (!grouped[family]) grouped[family] = [];
    grouped[family].push(pl);
  });

  const rows = [];
  Object.entries(grouped).forEach(([family, items]) => {
    rows.push(`<tr><td colspan="10" style="background:var(--color-navy);color:var(--color-steel);font-family:var(--font-display);font-size:var(--text-xs);font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:var(--space-2) var(--space-4)">${esc(family)}</td></tr>`);
    items.forEach(pl => {
      const stdUsd = pl.standard_sell_price_usd   ?? (pl.standard_sell_price_gbp   != null ? pl.standard_sell_price_gbp   * FX_USD_PER_GBP : null);
      const stdGbp = pl.standard_sell_price_gbp   ?? (pl.standard_sell_price_usd   != null ? pl.standard_sell_price_usd   / FX_USD_PER_GBP : null);
      const mktUsd = pl.market_reference_price_usd ?? (pl.market_reference_price_gbp != null ? pl.market_reference_price_gbp * FX_USD_PER_GBP : null);
      const mktGbp = pl.market_reference_price_gbp ?? (pl.market_reference_price_usd != null ? pl.market_reference_price_usd / FX_USD_PER_GBP : null);
      const stdPrice = stdUsd != null
        ? `<div style="font-family:var(--font-display);font-weight:600">$${fmt(stdUsd)}</div><div style="font-size:var(--text-xs);color:var(--color-text-muted)">£${fmt(stdGbp)}</div>`
        : '—';
      const mktPrice = mktUsd != null
        ? `<div style="font-family:var(--font-display);font-weight:600">$${fmt(mktUsd)}</div><div style="font-size:var(--color-text-muted);font-size:var(--text-xs)">£${fmt(mktGbp)}</div>`
        : '—';
      rows.push(`<tr style="cursor:pointer" onclick="location.href='detail.html?id=${esc(pl.id)}'">
        <td style="padding-left:var(--space-6);color:var(--color-text-muted);font-size:var(--text-sm)">${esc(pl.sub_type || '—')}</td>
        <td style="font-weight:600">${esc(pl.name)}</td>
        <td style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(pl.physical_form || '—')}</td>
        <td style="font-family:var(--font-display);font-size:var(--text-xs)">${esc(pl.cn_code || '—')}</td>
        <td>${fmt(pl.default_markup_pct, 1)}%</td>
        <td>${fmt((pl.vat_rate || 0) * 100, 1)}%</td>
        <td style="font-family:var(--font-display)">${stdPrice}</td>
        <td style="font-family:var(--font-display)">${mktPrice}</td>
        <td><span class="badge ${pl.active ? 'badge-success' : 'badge-neutral'}">${pl.active ? 'Active' : 'Inactive'}</span></td>
        <td style="text-align:right">
          <button class="btn btn-secondary btn-sm" onclick="openEditModal('${esc(pl.id)}');event.stopPropagation()">Edit</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleActive('${esc(pl.id)}',${!pl.active});event.stopPropagation()" style="margin-left:var(--space-2)">${pl.active ? 'Deactivate' : 'Activate'}</button>
        </td>
      </tr>`);
    });
  });
  tbody.innerHTML = rows.join('');

  // Populate family filter once with distinct values from the full dataset
  const sel = document.getElementById('filter-family');
  if (sel && sel.options.length <= 1) {
    const { data: all } = await supabaseClient.from('product_lines').select('metal_family').order('metal_family');
    const families = [...new Set((all || []).map(r => r.metal_family).filter(Boolean))];
    families.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f; opt.textContent = f;
      sel.appendChild(opt);
    });
  }
}

// ── Form builder ─────────────────────────────────────────────────────────────

function buildPlForm(pl = {}, formId, submitFn, cancelModal) {
  const stdUsdVal = pl.standard_sell_price_usd   != null ? pl.standard_sell_price_usd
                  : pl.standard_sell_price_gbp   != null ? +(pl.standard_sell_price_gbp   * FX_USD_PER_GBP).toFixed(2)
                  : null;
  const mktUsdVal = pl.market_reference_price_usd != null ? pl.market_reference_price_usd
                  : pl.market_reference_price_gbp  != null ? +(pl.market_reference_price_gbp  * FX_USD_PER_GBP).toFixed(2)
                  : null;
  return `
    <form id="${formId}" onsubmit="${submitFn}">
      <div class="form-grid" style="margin-bottom:var(--space-4)">
        <div class="form-group">
          <label class="form-label">Metal Family <span style="color:var(--color-danger)">*</span></label>
          ${productFamilies.length > 0
            ? `<select class="form-select" id="${formId}-family" required>
                <option value="">— Select family —</option>
                ${productFamilies.map(f => `<option value="${esc(f.name)}" ${pl.metal_family === f.name ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
               </select>`
            : `<div class="alert alert-warning" style="font-size:var(--text-sm)">No families set up yet. <a href="families.html" class="btn btn-ghost btn-sm">Add a family first →</a></div>
               <input type="hidden" id="${formId}-family" value="" />`
          }
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
        <button type="submit" class="btn btn-primary">${pl.id ? 'Save Changes' : 'Add Product Line'}</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('${cancelModal}').classList.remove('open')">Cancel</button>
      </div>
    </form>`;
}

function getPlPayload(formId) {
  const vatPct   = parseFloat(document.getElementById(`${formId}-vat`)?.value)       || 0;
  const markup   = parseFloat(document.getElementById(`${formId}-markup`)?.value)    ?? 10;
  const ins      = parseFloat(document.getElementById(`${formId}-ins`)?.value)       ?? 0.125;
  const stdUsdRaw = document.getElementById(`${formId}-std-price`)?.value.trim();
  const mktUsdRaw = document.getElementById(`${formId}-mkt-price`)?.value.trim();
  const stdUsd    = stdUsdRaw ? parseFloat(stdUsdRaw) : null;
  const mktUsd    = mktUsdRaw ? parseFloat(mktUsdRaw) : null;
  return {
    metal_family:                 document.getElementById(`${formId}-family`)?.value.trim()  || null,
    sub_type:                     document.getElementById(`${formId}-subtype`)?.value.trim() || null,
    physical_form:                document.getElementById(`${formId}-form`)?.value.trim()    || null,
    name:                         document.getElementById(`${formId}-name`)?.value.trim(),
    cn_code:                      document.getElementById(`${formId}-cn`)?.value.trim()      || null,
    default_markup_pct:           markup,
    vat_rate:                     vatPct / 100,
    insurance_pct:                ins,
    standard_sell_price_usd:      stdUsd,
    standard_sell_price_gbp:      stdUsd != null ? +(stdUsd / FX_USD_PER_GBP).toFixed(2) : null,
    market_reference_price_usd:   mktUsd,
    market_reference_price_gbp:   mktUsd != null ? +(mktUsd / FX_USD_PER_GBP).toFixed(2) : null,
    price_reference_source:       document.getElementById(`${formId}-price-source`)?.value || null,
    price_reference_code:         document.getElementById(`${formId}-price-code`)?.value.trim() || null,
    price_reference_updated_at:   document.getElementById(`${formId}-price-updated`)?.value || null,
    default_origin_country:       document.getElementById(`${formId}-origin`)?.value.trim() || null,
    default_destination:          document.getElementById(`${formId}-dest`)?.value.trim()   || null,
    reach_uk_regulated:           document.getElementById(`${formId}-reach-uk`)?.checked || false,
    reach_uk_notes:               document.getElementById(`${formId}-reach-uk-notes`)?.value.trim() || null,
    reach_eu_regulated:           document.getElementById(`${formId}-reach-eu`)?.checked || false,
    reach_eu_notes:               document.getElementById(`${formId}-reach-eu-notes`)?.value.trim() || null,
    import_restrictions_notes:    document.getElementById(`${formId}-import-restrictions`)?.value.trim() || null,
    notes:                        document.getElementById(`${formId}-notes`)?.value.trim()  || null,
  };
}

// ── Add ───────────────────────────────────────────────────────────────────────

async function submitAddPl(e) {
  e.preventDefault();
  const alertEl = document.getElementById('add-pl-form-alert');
  const payload = { ...getPlPayload('add-pl-form'), active: true };

  if (!payload.name) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Product name is required.'; return;
  }

  const { error } = await supabaseClient.from('product_lines').insert([payload]);
  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
  } else {
    document.getElementById('add-pl-modal').classList.remove('open');
    loadProductLines();
  }
}

// ── Edit ──────────────────────────────────────────────────────────────────────

async function openEditModal(id) {
  const { data: pl, error } = await supabaseClient.from('product_lines').select('*').eq('id', id).single();
  if (error || !pl) return;
  document.getElementById('edit-pl-form-container').innerHTML =
    buildPlForm(pl, 'edit-pl-form', `submitEditPl(event,'${esc(id)}')`, 'edit-pl-modal');
  document.getElementById('edit-pl-modal').classList.add('open');
}

async function submitEditPl(e, id) {
  e.preventDefault();
  const alertEl = document.getElementById('edit-pl-form-alert');
  const payload = getPlPayload('edit-pl-form');

  if (!payload.name) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Product name is required.'; return;
  }

  const { error } = await supabaseClient.from('product_lines').update(payload).eq('id', id);
  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
  } else {
    document.getElementById('edit-pl-modal').classList.remove('open');
    loadProductLines();
  }
}

async function toggleActive(id, active) {
  await supabaseClient.from('product_lines').update({ active }).eq('id', id);
  loadProductLines();
}

// ── List ─────────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  document.getElementById('user-email').textContent = user?.email || '';
  await loadFamilies();
  document.getElementById('add-pl-form-container').innerHTML =
    buildPlForm({}, 'add-pl-form', 'submitAddPl(event)', 'add-pl-modal');
  loadProductLines();

  // Deep-link support: ?action=new opens the Add Product Line modal directly
  // (used by the supplier detail page's "Add a new product line" link)
  if (new URLSearchParams(location.search).get('action') === 'new') {
    document.getElementById('add-pl-modal').classList.add('open');
  }
})();
