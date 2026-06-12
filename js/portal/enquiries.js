/**
 * Vertex Metals Portal — Enquiry Queue
 * Handles portal/enquiries/index.html
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

const SOURCE_LABEL = { website_form: 'Website Form', manual_entry: 'Manual Entry' };
const SOURCE_CLASS = { website_form: 'badge-info', manual_entry: 'badge-neutral' };
const STATUS_CLASS = {
  new:          'badge-warning',
  under_review: 'badge-info',
  converted:    'badge-success',
  declined:     'badge-neutral'
};

// ── Modal helpers ─────────────────────────────────────────────────────────

function openModal(html) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ── Load enquiries ────────────────────────────────────────────────────────

async function loadEnquiries() {
  const statusFilter = document.getElementById('filter-status')?.value || 'active';
  const search = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
  const tbody = document.getElementById('enquiries-body');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">Loading…</td></tr>';

  let query = supabaseClient
    .from('supplier_enquiries')
    .select('id, source, company_name, contact_name, email, country, submitted_at, status, reviewed_at, decline_reason, converted_to_onboarding_id')
    .order('submitted_at', { ascending: false });

  if (statusFilter === 'active') {
    query = query.in('status', ['new', 'under_review']);
  } else if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--color-danger);padding:var(--space-4)">${esc(error.message)}</td></tr>`;
    return;
  }

  let rows = data || [];
  if (search) {
    rows = rows.filter(r =>
      (r.company_name || '').toLowerCase().includes(search) ||
      (r.contact_name || '').toLowerCase().includes(search) ||
      (r.country      || '').toLowerCase().includes(search)
    );
  }

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No enquiries found.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(e => {
    const actionBtn = (e.status === 'converted')
      ? `<a href="../suppliers/detail.html" class="btn btn-sm btn-ghost" style="border:1px solid var(--color-border)">View Supplier →</a>`
      : `<button class="btn btn-sm" style="border:1px solid var(--color-border);background:var(--color-surface-raised)" onclick="openReviewModal('${esc(e.id)}')">Review</button>`;

    return `<tr>
      <td><strong>${esc(e.company_name)}</strong></td>
      <td style="font-size:var(--text-sm);color:var(--color-text-muted)">${esc(e.contact_name || '—')}</td>
      <td style="font-size:var(--text-sm)">${esc(e.country || '—')}</td>
      <td><span class="badge ${SOURCE_CLASS[e.source] || 'badge-neutral'}">${esc(SOURCE_LABEL[e.source] || e.source)}</span></td>
      <td style="font-size:var(--text-sm)">${fmtDate(e.submitted_at)}</td>
      <td><span class="badge ${STATUS_CLASS[e.status] || 'badge-neutral'}">${esc(e.status?.replace('_',' '))}</span></td>
      <td>${actionBtn}</td>
    </tr>`;
  }).join('');
}

// ── Review modal ──────────────────────────────────────────────────────────

async function openReviewModal(enquiryId) {
  openModal(`<div class="modal-head"><h3>Loading…</h3><button class="btn btn-ghost btn-sm" onclick="closeModal()">✕</button></div>`);

  const { data: e, error } = await supabaseClient
    .from('supplier_enquiries')
    .select('*')
    .eq('id', enquiryId)
    .single();

  if (error || !e) {
    openModal(`<div class="modal-body"><p style="color:var(--color-danger)">Could not load enquiry.</p></div>`);
    return;
  }

  const isActionable = e.status === 'new' || e.status === 'under_review';

  const fields = [
    ['Company Name',        e.company_name,             false],
    ['Country',             e.country,                  false],
    ['HQ Address',          e.hq_address,               false],
    ['Website',             e.website,                  false],
    ['Contact Name',        e.contact_name,             false],
    ['Position / Title',    e.position_title,           false],
    ['Email',               e.email,                    false],
    ['Phone',               e.phone,                    false],
    ['Monthly Capacity',    e.supply_capacity_mt,       false],
    ['Export Markets',      e.export_markets,           false],
    ['Shipping Terms',      e.shipping_terms,           false],
    ['Products / Materials',e.products_of_interest,     true],
    ['Testing Procedures',  e.testing_procedures,       true],
    ['Certifications',      e.certifications,           true],
  ].filter(([, v]) => v);

  const halfLen = Math.ceil(fields.length / 2);
  const col1 = fields.filter((_, i) => i < halfLen);
  const col2 = fields.filter((_, i) => i >= halfLen);

  function fieldHtml([label, value, isLong]) {
    return `<div class="detail-field${isLong ? ' detail-full' : ''}">
      <label>${esc(label)}</label>
      <p>${esc(value || '—')}</p>
    </div>`;
  }

  const actionButtons = isActionable ? `
    ${e.status === 'new' ? `<button class="btn btn-ghost btn-sm" onclick="markUnderReview('${esc(e.id)}')">Mark Under Review</button>` : ''}
    <button class="btn btn-ghost btn-sm" style="color:var(--color-danger);border-color:var(--color-danger)" onclick="openDeclineModal('${esc(e.id)}','${esc(e.company_name)}')">Decline</button>
    <a href="../suppliers/onboard.html?enquiry_id=${esc(e.id)}" class="btn btn-primary btn-sm">Convert to Onboarding →</a>
  ` : e.status === 'converted'
    ? `<a href="../suppliers/detail.html" class="btn btn-ghost btn-sm">View Supplier Record →</a>`
    : `<span style="font-size:var(--text-sm);color:var(--color-text-muted)">Declined: ${esc(e.decline_reason || '—')}</span>`;

  openModal(`
    <div class="modal-head">
      <div>
        <h3>${esc(e.company_name)}</h3>
        <div style="display:flex;gap:var(--space-2);margin-top:var(--space-1)">
          <span class="badge ${SOURCE_CLASS[e.source] || 'badge-neutral'}">${esc(SOURCE_LABEL[e.source] || e.source)}</span>
          <span class="badge ${STATUS_CLASS[e.status] || 'badge-neutral'}">${esc(e.status?.replace('_',' '))}</span>
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">${fmtDateTime(e.submitted_at)}</span>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="detail-grid">
        ${col1.map(fieldHtml).join('')}
        ${col2.map(fieldHtml).join('')}
      </div>
    </div>
    <div class="modal-foot">${actionButtons}</div>
  `);
}

async function markUnderReview(enquiryId) {
  const { error } = await supabaseClient
    .from('supplier_enquiries')
    .update({ status: 'under_review', reviewed_at: new Date().toISOString() })
    .eq('id', enquiryId);
  if (error) { alert('Error: ' + error.message); return; }
  closeModal();
  loadEnquiries();
}

// ── Decline modal ─────────────────────────────────────────────────────────

function openDeclineModal(enquiryId, companyName) {
  openModal(`
    <div class="modal-head">
      <h3>Decline Enquiry</h3>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p style="font-size:var(--text-sm)">Declining the enquiry from <strong>${esc(companyName)}</strong>. This is recorded and cannot be undone, but you can always raise a new enquiry later if circumstances change.</p>
      <div class="form-group">
        <label class="form-label" for="decline-reason">Reason for declining <span class="required">*</span></label>
        <textarea class="form-textarea" id="decline-reason" rows="3" placeholder="e.g. Insufficient quality certifications, supplier does not meet our minimum compliance requirements…"></textarea>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost btn-sm" onclick="openReviewModal('${esc(enquiryId)}')">Back</button>
      <button class="btn btn-sm" style="background:var(--color-danger);color:#fff;border:none" onclick="confirmDecline('${esc(enquiryId)}')">Confirm Decline</button>
    </div>
  `);
}

async function confirmDecline(enquiryId) {
  const reason = document.getElementById('decline-reason')?.value.trim();
  if (!reason) {
    document.getElementById('decline-reason').style.borderColor = 'var(--color-danger)';
    return;
  }
  const user = await getCurrentUser();
  const { error } = await supabaseClient
    .from('supplier_enquiries')
    .update({
      status:       'declined',
      decline_reason: reason,
      reviewed_by:  user?.id,
      reviewed_at:  new Date().toISOString()
    })
    .eq('id', enquiryId);
  if (error) { alert('Error: ' + error.message); return; }
  closeModal();
  loadEnquiries();
}

// ── New manual enquiry modal ──────────────────────────────────────────────

function openNewEnquiryModal() {
  openModal(`
    <div class="modal-head">
      <h3>New Manual Enquiry</h3>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p style="font-size:var(--text-sm);color:var(--color-text-muted)">Use this to record a supplier lead you have identified or been introduced to directly, before deciding whether to commence formal onboarding.</p>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="ne-company">Company Name <span class="required">*</span></label>
          <input type="text" class="form-input" id="ne-company" placeholder="Legal company name" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ne-country">Country <span class="required">*</span></label>
          <input type="text" class="form-input" id="ne-country" placeholder="e.g. India" />
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="ne-contact">Contact Name</label>
          <input type="text" class="form-input" id="ne-contact" placeholder="Primary contact" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ne-email">Email</label>
          <input type="email" class="form-input" id="ne-email" placeholder="contact@company.com" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="ne-products">Products / Materials</label>
        <input type="text" class="form-input" id="ne-products" placeholder="e.g. EC Grade aluminium wire, 9.5mm rod" />
      </div>
      <div class="form-group">
        <label class="form-label" for="ne-message">Notes</label>
        <textarea class="form-textarea" id="ne-message" rows="3" placeholder="How was this lead identified? Any initial notes from Jackson."></textarea>
      </div>
      <div id="ne-error" style="display:none;color:var(--color-danger);font-size:var(--text-sm)"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary btn-sm" onclick="submitNewEnquiry()">Save Enquiry</button>
    </div>
  `);
}

async function submitNewEnquiry() {
  const company = document.getElementById('ne-company')?.value.trim();
  const country = document.getElementById('ne-country')?.value.trim();
  const errEl   = document.getElementById('ne-error');

  if (!company || !country) {
    errEl.textContent = 'Company name and country are required.';
    errEl.style.display = 'block';
    return;
  }

  const user = await getCurrentUser();
  const { error } = await supabaseClient.from('supplier_enquiries').insert({
    source:             'manual_entry',
    company_name:       company,
    country,
    contact_name:       document.getElementById('ne-contact')?.value.trim() || null,
    email:              document.getElementById('ne-email')?.value.trim()   || null,
    products_of_interest: document.getElementById('ne-products')?.value.trim() || null,
    message:            document.getElementById('ne-message')?.value.trim() || null,
    status:             'new',
    submitted_at:       new Date().toISOString()
  });

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    return;
  }

  closeModal();
  loadEnquiries();
}

// ── Init ──────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  await loadEnquiries();
})();
