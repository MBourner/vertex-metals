/**
 * Vertex Metals Portal — KYC Records
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function kycStatusBadge(status) {
  const map = {
    pending:     'warning',
    in_progress: 'info',
    approved:    'success',
    rejected:    'danger',
    expired:     'neutral',
  };
  const label = status ? status.replace('_', ' ') : '—';
  return `<span class="badge badge-${map[status] || 'neutral'}">${esc(label)}</span>`;
}

function riskBadge(risk) {
  const map = { low: 'success', medium: 'warning', high: 'danger', unrated: 'neutral' };
  return `<span class="badge badge-${map[risk] || 'neutral'}">${esc(risk || 'unrated')}</span>`;
}

const KYC_STATUSES = ['pending','in_progress','approved','rejected','expired'];
const RISK_LEVELS  = ['low','medium','high','unrated'];

// ── List page ───────────────────────────────────────────────────────────────

async function loadKyc() {
  const tbody = document.getElementById('kyc-body');

  const { data, error } = await supabaseClient
    .from('kyc_records')
    .select('*, contacts(company_name, type)')
    .order('next_review_date', { ascending: true, nullsFirst: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No KYC records found.</td></tr>';
    return;
  }

  const today = new Date();
  tbody.innerHTML = data.map(k => {
    const nextReview = k.next_review_date ? new Date(k.next_review_date) : null;
    const overdue = nextReview && nextReview < today;
    const rowClass = overdue ? 'class="row-danger"' : '';
    return `<tr ${rowClass} style="cursor:pointer" onclick="window.location.href='detail.html?id=${esc(k.id)}'">
      <td style="font-weight:600">${esc(k.contacts?.company_name || '—')}</td>
      <td>${esc(k.contacts?.type || '—')}</td>
      <td>${kycStatusBadge(k.kyc_status)}</td>
      <td>${riskBadge(k.risk_rating)}</td>
      <td>${k.last_screened_date ? new Date(k.last_screened_date).toLocaleDateString('en-GB') : '—'}</td>
      <td>${nextReview ? new Date(nextReview).toLocaleDateString('en-GB') + (overdue ? ' <span style="color:var(--color-danger);font-size:var(--text-xs)">OVERDUE</span>' : '') : '—'}</td>
    </tr>`;
  }).join('');
}

// ── Add KYC Record form ─────────────────────────────────────────────────────

async function buildKycForm(contacts) {
  return `
    <form id="kyc-form" onsubmit="submitKyc(event)">
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Contact / Company <span style="color:var(--color-danger)">*</span></label>
          <select class="form-select" id="kyc-contact" required>
            <option value="">— Select contact —</option>
            ${contacts.map(c => `<option value="${esc(c.id)}">${esc(c.company_name)} (${esc(c.type)})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">KYC Status</label>
          <select class="form-select" id="kyc-status">
            ${KYC_STATUSES.map(s => `<option value="${s}"${s==='pending'?' selected':''}>${s.replace('_',' ')}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Risk Rating</label>
          <select class="form-select" id="kyc-risk">
            ${RISK_LEVELS.map(r => `<option value="${r}"${r==='unrated'?' selected':''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Last Screened Date</label>
          <input type="date" class="form-input" id="kyc-screened" />
        </div>
        <div class="form-group">
          <label class="form-label">Next Review Date</label>
          <input type="date" class="form-input" id="kyc-next-review" />
        </div>
      </div>
      <div class="form-group" style="margin-top:var(--space-2)">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="kyc-notes" rows="3" placeholder="Due diligence notes, screening results…"></textarea>
      </div>
      <div id="kyc-form-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Add Record</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('new-kyc-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;
}

async function submitKyc(e) {
  e.preventDefault();
  const alertEl = document.getElementById('kyc-form-alert');
  const contact_id     = document.getElementById('kyc-contact').value;
  const kyc_status     = document.getElementById('kyc-status').value;
  const risk_rating    = document.getElementById('kyc-risk').value;
  const last_screened  = document.getElementById('kyc-screened').value || null;
  const next_review    = document.getElementById('kyc-next-review').value || null;
  const notes          = document.getElementById('kyc-notes').value.trim() || null;

  if (!contact_id) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Please select a contact.'; return;
  }

  const { error } = await supabaseClient.from('kyc_records').insert([{
    contact_id, kyc_status, risk_rating,
    last_screened_date: last_screened,
    next_review_date: next_review,
    notes
  }]);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
  } else {
    document.getElementById('new-kyc-modal').classList.remove('open');
    loadKyc();
  }
}

// ── Detail page ─────────────────────────────────────────────────────────────

async function loadKycDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { document.getElementById('kyc-title').textContent = 'Record not found'; return; }

  const { data: k, error } = await supabaseClient
    .from('kyc_records')
    .select('*, contacts(id, company_name, type, email, phone, country)')
    .eq('id', id)
    .single();

  if (error || !k) {
    document.getElementById('kyc-title').textContent = 'Error';
    document.getElementById('kyc-detail').innerHTML = `<div class="alert alert-error">${esc(error?.message || 'Not found')}</div>`;
    return;
  }

  document.getElementById('kyc-title').textContent = k.contacts?.company_name || 'KYC Record';
  document.title = `KYC — ${k.contacts?.company_name || ''} — Vertex Metals Portal`;

  document.getElementById('kyc-detail').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6);margin-bottom:var(--space-6)">
      <div>
        <h3 style="font-size:var(--text-sm);text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-muted);margin-bottom:var(--space-4)">Company</h3>
        <dl style="display:grid;grid-template-columns:auto 1fr;gap:var(--space-2) var(--space-4)">
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Name</dt><dd style="font-weight:600">${esc(k.contacts?.company_name || '—')}</dd>
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Type</dt><dd>${esc(k.contacts?.type || '—')}</dd>
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Country</dt><dd>${esc(k.contacts?.country || '—')}</dd>
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Email</dt><dd>${k.contacts?.email ? `<a href="mailto:${esc(k.contacts.email)}">${esc(k.contacts.email)}</a>` : '—'}</dd>
        </dl>
      </div>
      <div>
        <h3 style="font-size:var(--text-sm);text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-muted);margin-bottom:var(--space-4)">KYC Status</h3>
        <dl style="display:grid;grid-template-columns:auto 1fr;gap:var(--space-2) var(--space-4)">
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Status</dt><dd>${kycStatusBadge(k.kyc_status)}</dd>
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Risk Rating</dt><dd>${riskBadge(k.risk_rating)}</dd>
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Last Screened</dt><dd>${k.last_screened_date ? new Date(k.last_screened_date).toLocaleDateString('en-GB') : '—'}</dd>
          <dt style="color:var(--color-text-muted);font-size:var(--text-sm)">Next Review</dt><dd>${k.next_review_date ? new Date(k.next_review_date).toLocaleDateString('en-GB') : '—'}</dd>
        </dl>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 280px;gap:var(--space-6)">
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="kyc-notes-field" rows="6">${esc(k.notes || '')}</textarea>
        <button class="btn btn-primary btn-sm" style="margin-top:var(--space-3)" onclick="saveKycNotes('${esc(id)}')">Save Notes</button>
        <div id="notes-alert" class="alert" style="display:none;margin-top:var(--space-2)"></div>
      </div>
      <div>
        <div class="form-group">
          <label class="form-label">Update Status</label>
          <select class="form-select" id="kyc-status-select">
            ${KYC_STATUSES.map(s => `<option value="${s}"${s===k.kyc_status?' selected':''}>${s.replace('_',' ')}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Risk Rating</label>
          <select class="form-select" id="kyc-risk-select">
            ${RISK_LEVELS.map(r => `<option value="${r}"${r===k.risk_rating?' selected':''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Last Screened Date</label>
          <input type="date" class="form-input" id="kyc-screened-field" value="${k.last_screened_date || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Next Review Date</label>
          <input type="date" class="form-input" id="kyc-next-review-field" value="${k.next_review_date || ''}" />
        </div>
        <button class="btn btn-primary btn-sm" style="width:100%;margin-top:var(--space-2)" onclick="saveKycStatus('${esc(id)}')">Update Record</button>
        <div id="status-alert" class="alert" style="display:none;margin-top:var(--space-2)"></div>
      </div>
    </div>`;
}

async function saveKycNotes(id) {
  const notes = document.getElementById('kyc-notes-field').value.trim() || null;
  const alertEl = document.getElementById('notes-alert');
  const { error } = await supabaseClient.from('kyc_records').update({ notes }).eq('id', id);
  alertEl.style.display = 'block';
  alertEl.className = error ? 'alert alert-error' : 'alert alert-success';
  alertEl.textContent = error ? 'Save failed: ' + error.message : 'Notes saved.';
}

async function saveKycStatus(id) {
  const kyc_status = document.getElementById('kyc-status-select').value;
  const risk_rating = document.getElementById('kyc-risk-select').value;
  const last_screened_date = document.getElementById('kyc-screened-field').value || null;
  const next_review_date = document.getElementById('kyc-next-review-field').value || null;
  const alertEl = document.getElementById('status-alert');

  const { error } = await supabaseClient.from('kyc_records').update({
    kyc_status, risk_rating, last_screened_date, next_review_date
  }).eq('id', id);

  alertEl.style.display = 'block';
  alertEl.className = error ? 'alert alert-error' : 'alert alert-success';
  alertEl.textContent = error ? 'Update failed: ' + error.message : 'Record updated.';
}

// ── Init ───────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user?.email || '';

  if (document.getElementById('kyc-body')) {
    // List page — load contacts for the add form
    const { data: contacts } = await supabaseClient
      .from('contacts')
      .select('id, company_name, type')
      .order('company_name');

    const container = document.getElementById('kyc-form-container');
    if (container) container.innerHTML = await buildKycForm(contacts || []);

    loadKyc();
  } else if (document.getElementById('kyc-detail')) {
    loadKycDetail();
  }
})();
