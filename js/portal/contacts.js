/**
 * Vertex Metals Portal — Contacts CRM
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function typeBadge(type) {
  const map = { buyer: 'info', supplier: 'success', logistics: 'accent', other: 'neutral' };
  return `<span class="badge badge-${map[type] || 'neutral'}">${esc(type || '—')}</span>`;
}

function kycBadge(status) {
  if (!status) return '<span class="badge badge-neutral">none</span>';
  const map = { pending: 'warning', in_progress: 'info', approved: 'success', rejected: 'danger', expired: 'neutral' };
  return `<span class="badge badge-${map[status] || 'neutral'}">${esc(status.replace('_',' '))}</span>`;
}

const CONTACT_TYPES = ['buyer', 'supplier', 'logistics', 'other'];

// ── List ────────────────────────────────────────────────────────────────────

async function loadContacts() {
  const typeFilter   = document.getElementById('filter-type')?.value   || '';
  const searchFilter = document.getElementById('filter-search')?.value?.toLowerCase() || '';
  const tbody = document.getElementById('contacts-body');

  let query = supabaseClient
    .from('contacts')
    .select('*, kyc_records(kyc_status)')
    .order('company_name');

  if (typeFilter) query = query.eq('type', typeFilter);

  const { data, error } = await query;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
    return;
  }

  let rows = data || [];
  if (searchFilter) {
    rows = rows.filter(c =>
      (c.company_name || '').toLowerCase().includes(searchFilter) ||
      (c.primary_contact_name || '').toLowerCase().includes(searchFilter)
    );
  }

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No contacts found.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(c => {
    // kyc_records is an array (one-to-many) — take the most recent active one
    const kycStatus = c.kyc_records?.length ? c.kyc_records[0].kyc_status : null;
    return `<tr style="cursor:pointer" onclick="openEditModal('${esc(c.id)}')">
      <td style="font-weight:600">${esc(c.company_name)}</td>
      <td>${typeBadge(c.type)}</td>
      <td>${esc(c.primary_contact_name || '—')}</td>
      <td>${esc(c.country || '—')}</td>
      <td>${c.email ? `<a href="mailto:${esc(c.email)}" onclick="event.stopPropagation()">${esc(c.email)}</a>` : '—'}</td>
      <td>${esc(c.phone || '—')}</td>
      <td>${kycBadge(kycStatus)}</td>
    </tr>`;
  }).join('');
}

// ── Add form ────────────────────────────────────────────────────────────────

function buildContactFormHtml(c = {}, formId = 'contact-form', submitFn = 'submitContact(event)') {
  return `
    <form id="${formId}" onsubmit="${submitFn}">
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Company Name <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-input" id="${formId}-company" value="${esc(c.company_name || '')}" required placeholder="e.g. Hindalco Industries Ltd" />
        </div>
        <div class="form-group">
          <label class="form-label">Type <span style="color:var(--color-danger)">*</span></label>
          <select class="form-select" id="${formId}-type" required>
            ${CONTACT_TYPES.map(t => `<option value="${t}"${t === (c.type || 'buyer') ? ' selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Country</label>
          <input type="text" class="form-input" id="${formId}-country" value="${esc(c.country || '')}" placeholder="e.g. India" />
        </div>
        <div class="form-group">
          <label class="form-label">Primary Contact Name</label>
          <input type="text" class="form-input" id="${formId}-contact-name" value="${esc(c.primary_contact_name || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="${formId}-email" value="${esc(c.email || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input type="text" class="form-input" id="${formId}-phone" value="${esc(c.phone || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Website</label>
          <input type="url" class="form-input" id="${formId}-website" value="${esc(c.website || '')}" placeholder="https://" />
        </div>
      </div>
      <div class="form-group" style="margin-top:var(--space-2)">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="${formId}-notes" rows="3">${esc(c.notes || '')}</textarea>
      </div>
      <div id="${formId}-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">${c.id ? 'Save Changes' : 'Add Contact'}</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('${c.id ? 'edit' : 'add'}-contact-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;
}

function openAddModal() {
  document.getElementById('contact-form-container').innerHTML = buildContactFormHtml({}, 'contact-form', 'submitContact(event)');
  document.getElementById('add-contact-modal').classList.add('open');
}

function closeAddModal() {
  document.getElementById('add-contact-modal').classList.remove('open');
}

async function submitContact(e) {
  e.preventDefault();
  const alertEl = document.getElementById('contact-form-alert');
  const payload = getFormPayload('contact-form');

  if (!payload.company_name) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Company name is required.'; return;
  }

  const { error } = await supabaseClient.from('contacts').insert([payload]);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
  } else {
    closeAddModal();
    loadContacts();
  }
}

// ── Edit ────────────────────────────────────────────────────────────────────

async function openEditModal(id) {
  const { data: c, error } = await supabaseClient.from('contacts').select('*').eq('id', id).single();
  if (error || !c) return;

  document.getElementById('edit-contact-form-container').innerHTML =
    buildContactFormHtml(c, 'edit-contact-form', `submitEditContact(event,'${esc(id)}')`);
  document.getElementById('edit-contact-modal').classList.add('open');
}

async function submitEditContact(e, id) {
  e.preventDefault();
  const alertEl = document.getElementById('edit-contact-form-alert');
  const payload = getFormPayload('edit-contact-form');

  if (!payload.company_name) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Company name is required.'; return;
  }

  const { error } = await supabaseClient.from('contacts').update(payload).eq('id', id);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
  } else {
    document.getElementById('edit-contact-modal').classList.remove('open');
    loadContacts();
  }
}

function getFormPayload(formId) {
  return {
    company_name:         document.getElementById(`${formId}-company`)?.value.trim() || null,
    type:                 document.getElementById(`${formId}-type`)?.value || 'buyer',
    country:              document.getElementById(`${formId}-country`)?.value.trim() || null,
    primary_contact_name: document.getElementById(`${formId}-contact-name`)?.value.trim() || null,
    email:                document.getElementById(`${formId}-email`)?.value.trim() || null,
    phone:                document.getElementById(`${formId}-phone`)?.value.trim() || null,
    website:              document.getElementById(`${formId}-website`)?.value.trim() || null,
    notes:                document.getElementById(`${formId}-notes`)?.value.trim() || null,
  };
}

// ── Init ───────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user?.email || '';
  loadContacts();
})();
