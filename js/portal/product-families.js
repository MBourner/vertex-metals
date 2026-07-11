/**
 * Vertex Metals Portal — Product Families
 * Handles portal/product-lines/families.html
 */

function esc(s) { if (s == null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

let familiesCache = [];

// ── List ─────────────────────────────────────────────────────────────────────

async function loadFamiliesTable() {
  const tbody = document.getElementById('families-body');
  const { data, error } = await supabaseClient.from('product_families').select('*').order('name');
  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
    return;
  }
  familiesCache = data || [];

  if (!familiesCache.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No product families yet.</td></tr>';
    return;
  }

  tbody.innerHTML = familiesCache.map(f => `<tr>
    <td style="font-weight:600">${esc(f.name)}</td>
    <td style="color:var(--color-text-muted)">${esc(f.description || '—')}</td>
    <td>${f.reach_regulated
      ? `<span class="badge badge-warning" title="${esc(f.reach_notes || '')}">Regulated</span>`
      : '<span class="badge badge-neutral">Not Regulated</span>'}</td>
    <td><span class="badge ${f.active ? 'badge-success' : 'badge-neutral'}">${f.active ? 'Active' : 'Inactive'}</span></td>
    <td style="text-align:right;white-space:nowrap">
      <button class="btn btn-secondary btn-sm" onclick="openEditFamilyModal('${esc(f.id)}')">Edit</button>
      <button class="btn btn-secondary btn-sm" onclick="deleteFamily('${esc(f.id)}','${esc(f.name)}')" style="margin-left:var(--space-2)">Delete</button>
    </td>
  </tr>`).join('');
}

// ── Form builder (shared between Add and Edit) ───────────────────────────────

function familyFormHtml(f = {}, formId) {
  return `
    <div class="form-grid" style="margin-bottom:var(--space-4)">
      <div class="form-group">
        <label class="form-label">Family Name <span style="color:var(--color-danger)">*</span></label>
        <input type="text" class="form-input" id="${formId}-name" value="${esc(f.name || '')}" required placeholder="e.g. Fasteners" />
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Description</label>
        <input type="text" class="form-input" id="${formId}-description" value="${esc(f.description || '')}" placeholder="Optional description" />
      </div>
      <div class="form-group">
        <label class="form-label">Active</label>
        <label class="form-switch"><input type="checkbox" id="${formId}-active" ${f.active !== false ? 'checked' : ''}><span></span></label>
      </div>
      <div class="form-group">
        <label class="form-label">UK REACH Regulated</label>
        <label class="form-switch"><input type="checkbox" id="${formId}-reach" ${f.reach_regulated ? 'checked' : ''}><span></span></label>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">REACH Notes</label>
        <textarea class="form-input" id="${formId}-reach-notes" rows="2" placeholder="e.g. SVHC candidate — Cobalt sulphate. Registration No. XXXXXXXX" style="resize:vertical">${esc(f.reach_notes || '')}</textarea>
      </div>
    </div>
    <div id="${formId}-alert" class="alert" style="display:none;margin-bottom:var(--space-4)"></div>
  `;
}

function familyPayload(formId) {
  return {
    name:            document.getElementById(`${formId}-name`)?.value.trim(),
    description:     document.getElementById(`${formId}-description`)?.value.trim() || null,
    active:          document.getElementById(`${formId}-active`)?.checked ?? true,
    reach_regulated: document.getElementById(`${formId}-reach`)?.checked ?? false,
    reach_notes:     document.getElementById(`${formId}-reach-notes`)?.value.trim() || null,
  };
}

// ── Add ──────────────────────────────────────────────────────────────────────

function openAddFamilyModal() {
  document.getElementById('add-family-form-container').innerHTML = `
    <form id="add-family-form" onsubmit="submitAddFamily(event)">
      ${familyFormHtml({}, 'add-family')}
      <button type="submit" class="btn btn-primary">Add Family</button>
    </form>`;
  document.getElementById('add-family-modal').classList.add('open');
}

async function submitAddFamily(e) {
  e.preventDefault();
  const alertEl = document.getElementById('add-family-alert');
  const payload = familyPayload('add-family');

  if (!payload.name) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Family name is required.';
    return;
  }

  const { error } = await supabaseClient.from('product_families').insert([payload]);
  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
    return;
  }

  document.getElementById('add-family-modal').classList.remove('open');
  loadFamiliesTable();
}

// ── Edit ─────────────────────────────────────────────────────────────────────

function openEditFamilyModal(id) {
  const family = familiesCache.find(f => f.id === id);
  if (!family) return;
  document.getElementById('edit-family-form-container').innerHTML = `
    <form id="edit-family-form" onsubmit="submitEditFamily(event,'${esc(id)}')">
      ${familyFormHtml(family, 'edit-family')}
      <div style="display:flex;gap:var(--space-3)">
        <button type="submit" class="btn btn-primary">Save Changes</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('edit-family-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;
  document.getElementById('edit-family-modal').classList.add('open');
}

async function submitEditFamily(e, id) {
  e.preventDefault();
  const alertEl = document.getElementById('edit-family-alert');
  const payload = familyPayload('edit-family');

  if (!payload.name) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Family name is required.';
    return;
  }

  const current = familiesCache.find(f => f.id === id);
  const { error } = await supabaseClient.from('product_families').update(payload).eq('id', id);
  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
    return;
  }

  if (current && current.name !== payload.name) {
    const { error: relinkError } = await supabaseClient.from('product_lines').update({ metal_family: payload.name }).eq('metal_family', current.name);
    if (relinkError) {
      alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
      alertEl.textContent = 'Family renamed, but related product lines could not be updated: ' + relinkError.message;
      return;
    }
  }

  document.getElementById('edit-family-modal').classList.remove('open');
  loadFamiliesTable();
}

// ── Delete ───────────────────────────────────────────────────────────────────

async function deleteFamily(id, name) {
  if (!confirm(`Delete family '${name}'? This will clear the family from any product lines using it.`)) return;

  const { error: clearError } = await supabaseClient.from('product_lines').update({ metal_family: null }).eq('metal_family', name);
  if (clearError) {
    alert(`Unable to clear product lines for family ${name}: ${clearError.message}`);
    return;
  }

  const { error } = await supabaseClient.from('product_families').delete().eq('id', id);
  if (error) {
    alert(`Unable to delete family ${name}: ${error.message}`);
    return;
  }

  loadFamiliesTable();
}

// ── Init ─────────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user?.email || '';
  loadFamiliesTable();
})();
