/**
 * Vertex Metals Portal — Customers CRM
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function kycBadge(status) {
  if (!status) return '<span class="badge badge-neutral">none</span>';
  const map = { pending: 'warning', in_progress: 'info', approved: 'success', rejected: 'danger', expired: 'neutral' };
  return `<span class="badge badge-${map[status] || 'neutral'}">${esc(status.replace('_',' '))}</span>`;
}

// ── List ────────────────────────────────────────────────────────────────────

async function loadContacts() {
  const searchFilter = document.getElementById('filter-search')?.value?.toLowerCase() || '';
  const tbody = document.getElementById('contacts-body');

  const { data, error } = await supabaseClient
    .from('contacts')
    .select('*, kyc_records(kyc_status)')
    .eq('type', 'buyer')
    .order('company_name');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
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
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No customers found.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(c => {
    // kyc_records is an array (one-to-many) — take the most recent active one
    const kycStatus = c.kyc_records?.length ? c.kyc_records[0].kyc_status : null;
    const detailUrl = c.type === 'buyer'
      ? `../customers/detail.html?id=${esc(c.id)}`
      : `../suppliers/detail.html?id=${esc(c.id)}`;
    return `<tr style="cursor:pointer" onclick="location.href='${detailUrl}'">
      <td style="font-weight:600">${esc(c.company_name)}</td>
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
      <input type="hidden" id="${formId}-type" value="buyer" />
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Company Name <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-input" id="${formId}-company" value="${esc(c.company_name || '')}" required placeholder="e.g. Hindalco Industries Ltd" />
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
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Address Line 1</label>
          <input type="text" class="form-input" id="${formId}-address1" value="${esc(c.address_line_1 || '')}" placeholder="e.g. Unit 4A, Victor Business Centre" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Address Line 2</label>
          <input type="text" class="form-input" id="${formId}-address2" value="${esc(c.address_line_2 || '')}" placeholder="Street, area" />
        </div>
        <div class="form-group">
          <label class="form-label">City</label>
          <input type="text" class="form-input" id="${formId}-city" value="${esc(c.city || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Postcode</label>
          <input type="text" class="form-input" id="${formId}-postcode" value="${esc(c.postcode || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Country</label>
          <input type="text" class="form-input" id="${formId}-country" value="${esc(c.country || '')}" placeholder="e.g. United Kingdom" />
        </div>
        <div class="form-group">
          <label class="form-label">VAT Number</label>
          <input type="text" class="form-input" id="${formId}-vat" value="${esc(c.vat_number || '')}" placeholder="e.g. GB 432 4723 14" />
        </div>
      </div>
      <div class="form-group" style="margin-top:var(--space-2)">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="${formId}-notes" rows="3">${esc(c.notes || '')}</textarea>
      </div>
      <div id="${formId}-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">${c.id ? 'Save Changes' : 'Add Customer'}</button>
        <button type="button" class="btn btn-ghost" onclick="closeAddModal()">Cancel</button>
      </div>
    </form>
  `;
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

function getFormPayload(formId) {
  return {
    company_name:         document.getElementById(`${formId}-company`)?.value.trim() || null,
    type:                 'buyer',
    primary_contact_name: document.getElementById(`${formId}-contact-name`)?.value.trim() || null,
    email:                document.getElementById(`${formId}-email`)?.value.trim() || null,
    phone:                document.getElementById(`${formId}-phone`)?.value.trim() || null,
    address_line_1:       document.getElementById(`${formId}-address1`)?.value.trim() || null,
    address_line_2:       document.getElementById(`${formId}-address2`)?.value.trim() || null,
    city:                 document.getElementById(`${formId}-city`)?.value.trim() || null,
    postcode:             document.getElementById(`${formId}-postcode`)?.value.trim() || null,
    country:              document.getElementById(`${formId}-country`)?.value.trim() || null,
    vat_number:           document.getElementById(`${formId}-vat`)?.value.trim() || null,
    notes:                document.getElementById(`${formId}-notes`)?.value.trim() || null,
  };
}

// ── Init ───────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user?.email || '';

  loadContacts();

  // Deep-link support: ?action=new opens the Add Contact modal directly
  // (used by the Customers homepage's "+ New Customer" shortcut)
  if (new URLSearchParams(location.search).get('action') === 'new') {
    openAddModal();
  }
})();
