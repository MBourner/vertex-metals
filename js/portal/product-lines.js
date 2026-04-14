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

// ── List ─────────────────────────────────────────────────────────────────────

async function loadProductLines() {
  const tbody = document.getElementById('pl-body');

  const { data, error } = await supabaseClient
    .from('product_lines')
    .select('*')
    .order('name');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No product lines yet. Add your first product line to enable trade auto-calculation.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(pl => `
    <tr>
      <td style="font-weight:600">${esc(pl.name)}</td>
      <td style="font-family:var(--font-display);font-size:var(--text-xs)">${esc(pl.cn_code || '—')}</td>
      <td>${fmt(pl.default_markup_pct, 1)}%</td>
      <td>${fmt((pl.vat_rate || 0) * 100, 1)}%</td>
      <td>${fmt((pl.insurance_pct || 0), 3)}%</td>
      <td><span class="badge ${pl.active ? 'badge-success' : 'badge-neutral'}">${pl.active ? 'Active' : 'Inactive'}</span></td>
      <td style="text-align:right">
        <button class="btn btn-ghost btn-sm" onclick="openEditModal('${esc(pl.id)}');event.stopPropagation()">Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="toggleActive('${esc(pl.id)}',${!pl.active});event.stopPropagation()" style="margin-left:var(--space-2)">${pl.active ? 'Deactivate' : 'Activate'}</button>
      </td>
    </tr>`).join('');
}

// ── Form builder ─────────────────────────────────────────────────────────────

function buildPlForm(pl = {}, formId, submitFn, cancelModal) {
  return `
    <form id="${formId}" onsubmit="${submitFn}">
      <div class="form-group" style="margin-bottom:var(--space-4)">
        <label class="form-label">Product Name <span style="color:var(--color-danger)">*</span></label>
        <input type="text" class="form-input" id="${formId}-name" value="${esc(pl.name || '')}" required placeholder="e.g. Aluminium Alloy Core Wire EC Grade" />
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
      <div class="form-group" style="margin-top:var(--space-4)">
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
  const vatPct  = parseFloat(document.getElementById(`${formId}-vat`)?.value)  || 0;
  const markup  = parseFloat(document.getElementById(`${formId}-markup`)?.value) ?? 10;
  const ins     = parseFloat(document.getElementById(`${formId}-ins`)?.value)   ?? 0.125;
  return {
    name:                document.getElementById(`${formId}-name`)?.value.trim(),
    cn_code:             document.getElementById(`${formId}-cn`)?.value.trim()    || null,
    default_markup_pct:  markup,
    vat_rate:            vatPct / 100,
    insurance_pct:       ins,
    notes:               document.getElementById(`${formId}-notes`)?.value.trim() || null,
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

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  document.getElementById('user-email').textContent = user?.email || '';
  document.getElementById('add-pl-form-container').innerHTML =
    buildPlForm({}, 'add-pl-form', 'submitAddPl(event)', 'add-pl-modal');
  loadProductLines();
})();
