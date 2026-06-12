/**
 * Vertex Metals Portal — Supplier Document Checklist
 * Handles portal/suppliers/documents.html
 * Stage 3 (Documents) of the supplier onboarding workflow.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

const params       = new URLSearchParams(location.search);
const supplierId   = params.get('supplier_id');
const onboardingId = params.get('onboarding_id');

// ── Document type definitions ─────────────────────────────────────────────

const DOC_LABELS = {
  business_registration:        'Business Registration Certificate',
  beneficial_owner_declaration: 'Beneficial Owner Declaration',
  bank_details:                 'Bank Details',
  dpa:                          'Data Processing Agreement (DPA / GDPR)',
  tax_certificate:              'Tax / VAT / GST Certificate',
  quality_cert:                 'Quality Certificate (ISO 9001 or equivalent)',
  test_certificate:             'Test / Mill Certificates',
  iso_certificate:              'ISO Certificate',
  insurance_cargo:              'Cargo Insurance Certificate',
  insurance_liability:          'Liability Insurance Certificate',
  audit_report:                 'Factory / Supplier Audit Report',
  w9:                           'W-9 (US Tax Form)',
  other:                        'Other Document',
};

// Required document types by supplier_type
const REQUIRED_DOCS = {
  manufacturing:       ['business_registration','beneficial_owner_declaration','bank_details','dpa','tax_certificate','quality_cert','test_certificate','insurance_liability','audit_report'],
  materials_commodities:['business_registration','beneficial_owner_declaration','bank_details','dpa','tax_certificate','quality_cert','test_certificate','insurance_cargo','insurance_liability'],
  logistics:           ['business_registration','beneficial_owner_declaration','bank_details','dpa','tax_certificate','insurance_cargo','insurance_liability'],
  service_provider:    ['business_registration','beneficial_owner_declaration','bank_details','dpa','tax_certificate','insurance_liability'],
};

// ── Modal helpers ─────────────────────────────────────────────────────────

function openModal(html) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ── Expiry status helpers ─────────────────────────────────────────────────

function expiryStatus(expiryDate) {
  if (!expiryDate) return 'ok'; // no expiry required
  const exp = new Date(expiryDate);
  const now = new Date();
  const daysLeft = Math.floor((exp - now) / 86400000);
  if (daysLeft < 0)  return 'expired';
  if (daysLeft < 30) return 'expiring';
  return 'ok';
}

function expiryBadge(doc) {
  if (!doc.expiry_date) return '';
  const status = expiryStatus(doc.expiry_date);
  if (status === 'expired')  return `<span class="badge badge-danger" style="font-size:10px">Expired ${fmtDate(doc.expiry_date)}</span>`;
  if (status === 'expiring') return `<span class="badge badge-warning" style="font-size:10px">Expires ${fmtDate(doc.expiry_date)}</span>`;
  return `<span style="font-size:var(--text-xs);color:var(--color-text-muted)">Expires ${fmtDate(doc.expiry_date)}</span>`;
}

// ── Load and render document list ─────────────────────────────────────────

let supplierType = null;
let allDocs = [];

async function loadDocuments() {
  const { data: contact } = await supabaseClient
    .from('contacts')
    .select('company_name, supplier_type')
    .eq('id', supplierId)
    .single();

  if (contact) {
    supplierType = contact.supplier_type;
    document.getElementById('topbar-title').textContent = `Documents — ${contact.company_name}`;
    document.title = `Documents — ${contact.company_name}`;
  }

  const detailUrl = `detail.html?id=${supplierId}`;
  document.getElementById('back-link').href  = detailUrl;
  document.getElementById('cancel-link').href = detailUrl;

  const { data: docs } = await supabaseClient
    .from('supplier_documents')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('document_type')
    .order('version', { ascending: false });

  allDocs = docs || [];

  // Keep only current versions for display (latest per type)
  const currentByType = {};
  allDocs.forEach(d => {
    if (!currentByType[d.document_type] || d.version > currentByType[d.document_type].version) {
      currentByType[d.document_type] = d;
    }
  });

  renderMandatory(currentByType);
  renderAdditional(currentByType);
  updateCompleteness(currentByType);
}

function renderMandatory(currentByType) {
  const required = REQUIRED_DOCS[supplierType] || REQUIRED_DOCS.service_provider;
  const el = document.getElementById('mandatory-list');
  const countEl = document.getElementById('required-count');
  countEl.textContent = `${required.length} required for ${(supplierType||'').replace('_',' ')}`;

  el.innerHTML = required.map(type => {
    const doc = currentByType[type];
    return renderDocRow(type, doc, true);
  }).join('');
}

function renderAdditional(currentByType) {
  const required = REQUIRED_DOCS[supplierType] || [];
  const additionalDocs = Object.entries(currentByType).filter(([type]) => !required.includes(type));
  const el = document.getElementById('additional-list');

  if (additionalDocs.length === 0) {
    el.innerHTML = '<p style="font-size:var(--text-sm);color:var(--color-text-muted)">No additional documents uploaded.</p>';
    return;
  }
  el.innerHTML = additionalDocs.map(([type, doc]) => renderDocRow(type, doc, false)).join('');
}

function renderDocRow(type, doc, isMandatory) {
  const label = DOC_LABELS[type] || type;
  let statusIcon, statusText, actionButtons;

  if (!doc) {
    // Not uploaded
    statusIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-border)" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
    statusText = `<span style="font-size:var(--text-sm);color:var(--color-text-muted)">Not uploaded</span>`;
    actionButtons = `
      <button class="btn btn-sm btn-primary" style="font-size:var(--text-xs)" onclick="openUploadModal('${esc(type)}','${esc(label)}',true)">Upload</button>
      <button class="btn btn-sm btn-ghost" style="font-size:var(--text-xs);border:1px solid var(--color-border)" onclick="openNaModal('${esc(type)}','${esc(label)}')">N/A</button>`;

  } else if (doc.not_applicable) {
    // Marked not applicable
    statusIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
    statusText = `<span style="font-size:var(--text-sm);color:var(--color-text-muted)">Not applicable — ${esc(doc.not_applicable_reason||'—')}</span>`;
    actionButtons = `<button class="btn btn-sm btn-ghost" style="font-size:var(--text-xs);border:1px solid var(--color-border)" onclick="openUploadModal('${esc(type)}','${esc(label)}',true)">Upload instead</button>`;

  } else {
    const exp = expiryStatus(doc.expiry_date);
    const isExpired = exp === 'expired';
    const color = isExpired ? 'var(--color-danger)' : exp === 'expiring' ? '#d97706' : 'var(--color-success)';
    statusIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 16 9"/></svg>`;
    statusText = `<div style="font-size:var(--text-sm)">${esc(doc.file_name || '—')}
      ${doc.version > 1 ? `<span style="font-size:10px;color:var(--color-text-muted)"> v${doc.version}</span>` : ''}
      <span style="font-size:var(--text-xs);color:var(--color-text-muted);display:block">Uploaded ${fmtDate(doc.uploaded_at)}</span>
      ${expiryBadge(doc)}
    </div>`;
    actionButtons = `<button class="btn btn-sm btn-ghost" style="font-size:var(--text-xs);border:1px solid var(--color-border)" onclick="openUploadModal('${esc(type)}','${esc(label)}',true)">Update</button>`;
  }

  return `<div class="doc-row">
    <div style="display:flex;gap:var(--space-3);align-items:flex-start">
      <div style="margin-top:2px;flex-shrink:0">${statusIcon}</div>
      <div>
        <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:2px">${esc(label)}</div>
        ${statusText}
      </div>
    </div>
    <div class="doc-actions">${actionButtons}</div>
  </div>`;
}

function updateCompleteness(currentByType) {
  const required = REQUIRED_DOCS[supplierType] || [];
  const done = required.filter(type => {
    const d = currentByType[type];
    if (!d) return false;
    if (d.not_applicable) return true;
    if (d.file_path && expiryStatus(d.expiry_date) !== 'expired') return true;
    return false;
  });

  const pct = required.length ? Math.round((done.length / required.length) * 100) : 0;
  document.getElementById('completeness-pct').textContent = pct + '%';
  document.getElementById('completeness-fill').style.width = pct + '%';
  document.getElementById('completeness-fill').style.background =
    pct === 100 ? 'var(--color-success)' : pct >= 60 ? 'var(--color-accent)' : 'var(--color-danger)';
  document.getElementById('completeness-text').textContent = `${done.length} of ${required.length} complete`;
}

// ── Upload modal ──────────────────────────────────────────────────────────

function openUploadModal(docType, docLabel, isMandatory) {
  const isNew = !docType;
  openModal(`
    <div class="modal-head">
      <h3>${isNew ? 'Upload Additional Document' : `Upload — ${esc(docLabel)}`}</h3>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      ${isNew ? `<div class="form-group">
        <label class="form-label" for="up-type">Document Type <span class="required">*</span></label>
        <select class="form-select" id="up-type">
          <option value="">Select type…</option>
          ${Object.entries(DOC_LABELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" id="up-label-group" style="display:none">
        <label class="form-label" for="up-label">Document Description <span class="required">*</span></label>
        <input type="text" class="form-input" id="up-label" placeholder="Describe this document…" />
      </div>` : ''}
      <div class="form-group">
        <label class="form-label" for="up-file">File <span class="required">*</span></label>
        <input type="file" class="form-input" id="up-file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx" />
        <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:4px">Accepted: PDF, JPG, PNG, Word, Excel</div>
      </div>
      <div class="form-group">
        <label class="form-label" for="up-expiry">Expiry Date (if applicable)</label>
        <input type="date" class="form-input" id="up-expiry" />
      </div>
      <div class="form-group" id="up-reason-group">
        <label class="form-label" for="up-reason">Reason for Update</label>
        <input type="text" class="form-input" id="up-reason" placeholder="Why is this document being re-uploaded?" />
        <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:4px">Required when replacing an existing version.</div>
      </div>
      <div id="up-error" style="display:none;color:var(--color-danger);font-size:var(--text-sm)"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary btn-sm" id="up-submit-btn" onclick="submitUpload('${esc(docType||'')}','${esc(docLabel||'')}')">Upload</button>
    </div>
  `);

  if (isNew) {
    document.getElementById('up-type').addEventListener('change', function() {
      document.getElementById('up-label-group').style.display = this.value === 'other' ? 'block' : 'none';
    });
  }
}

async function submitUpload(docType, docLabel) {
  const errEl   = document.getElementById('up-error');
  const btn     = document.getElementById('up-submit-btn');
  errEl.style.display = 'none';

  // Resolve type if selecting from dropdown
  const resolvedType  = docType || document.getElementById('up-type')?.value;
  const resolvedLabel = resolvedType === 'other'
    ? (document.getElementById('up-label')?.value.trim() || null)
    : (docLabel || DOC_LABELS[resolvedType] || resolvedType);

  const file = document.getElementById('up-file')?.files[0];

  if (!resolvedType) { errEl.textContent = 'Please select a document type.'; errEl.style.display = 'block'; return; }
  if (!file)         { errEl.textContent = 'Please select a file to upload.'; errEl.style.display = 'block'; return; }

  btn.disabled = true;
  btn.textContent = 'Uploading…';

  try {
    const user = await getCurrentUser();

    // Determine version number
    const existing = allDocs.filter(d => d.document_type === resolvedType && !d.not_applicable);
    const nextVersion = existing.length > 0 ? Math.max(...existing.map(d => d.version)) + 1 : 1;

    const reason = document.getElementById('up-reason')?.value.trim() || null;
    if (nextVersion > 1 && !reason) {
      errEl.textContent = 'Please enter a reason for replacing the existing document.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Upload';
      return;
    }

    // Upload file to storage
    const ext = file.name.split('.').pop();
    const storagePath = `supplier-documents/${supplierId}/${resolvedType}/${Date.now()}-v${nextVersion}.${ext}`;
    const { error: uploadErr } = await supabaseClient.storage
      .from('order-documents')
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadErr) throw new Error('File upload failed: ' + uploadErr.message);

    // Supersede previous current version
    if (nextVersion > 1) {
      await supabaseClient.from('supplier_documents')
        .update({ is_current: false })
        .eq('supplier_id', supplierId)
        .eq('document_type', resolvedType)
        .eq('is_current', true);
    }

    // Insert new document record
    const expiry = document.getElementById('up-expiry')?.value || null;
    await supabaseClient.from('supplier_documents').insert({
      supplier_id:    supplierId,
      onboarding_id:  onboardingId,
      document_type:  resolvedType,
      document_label: resolvedType === 'other' ? resolvedLabel : null,
      version:        nextVersion,
      file_path:      storagePath,
      file_name:      file.name,
      file_size_bytes: file.size,
      mime_type:      file.type,
      uploaded_by:    user?.id,
      uploaded_at:    new Date().toISOString(),
      expiry_date:    expiry || null,
      is_current:     true,
      not_applicable: false,
      change_reason:  reason,
    });

    await OnboardingWorkflow.logEvent(supplierId, onboardingId,
      nextVersion > 1 ? 'document_superseded' : 'document_uploaded',
      `Document uploaded: "${resolvedLabel || resolvedType}" v${nextVersion}.${reason ? ' Reason: ' + reason : ''}`,
      { document_type: resolvedType, version: nextVersion }
    );

    closeModal();
    await loadDocuments();

  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Upload';
  }
}

// ── Not Applicable modal ──────────────────────────────────────────────────

function openNaModal(docType, docLabel) {
  openModal(`
    <div class="modal-head">
      <h3>Mark as Not Applicable</h3>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p style="font-size:var(--text-sm)">Marking <strong>${esc(docLabel)}</strong> as not applicable for this supplier. This is recorded in the compliance audit trail.</p>
      <div class="form-group">
        <label class="form-label" for="na-reason">Reason <span class="required">*</span></label>
        <textarea class="form-textarea" id="na-reason" rows="2" placeholder="e.g. Supplier is Indian company — W-9 applies to US entities only"></textarea>
      </div>
      <div id="na-error" style="display:none;color:var(--color-danger);font-size:var(--text-sm)"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary btn-sm" onclick="submitNa('${esc(docType)}','${esc(docLabel)}')">Confirm N/A</button>
    </div>
  `);
}

async function submitNa(docType, docLabel) {
  const reason  = document.getElementById('na-reason')?.value.trim();
  const errEl   = document.getElementById('na-error');
  if (!reason) { errEl.textContent = 'Reason is required.'; errEl.style.display = 'block'; return; }

  const user = await getCurrentUser();

  // Supersede any existing current version of this type
  await supabaseClient.from('supplier_documents')
    .update({ is_current: false })
    .eq('supplier_id', supplierId)
    .eq('document_type', docType)
    .eq('is_current', true);

  const existing = allDocs.filter(d => d.document_type === docType);
  const nextVersion = existing.length > 0 ? Math.max(...existing.map(d => d.version)) + 1 : 1;

  await supabaseClient.from('supplier_documents').insert({
    supplier_id:          supplierId,
    onboarding_id:        onboardingId,
    document_type:        docType,
    version:              nextVersion,
    uploaded_by:          user?.id,
    uploaded_at:          new Date().toISOString(),
    is_current:           true,
    not_applicable:       true,
    not_applicable_reason: reason,
  });

  await OnboardingWorkflow.logEvent(supplierId, onboardingId, 'document_marked_na',
    `Document "${docLabel}" marked as not applicable. Reason: ${reason}`,
    { document_type: docType }
  );

  closeModal();
  await loadDocuments();
}

// ── Advance to compliance stage ───────────────────────────────────────────

async function advanceToCompliance() {
  const errEl = document.getElementById('form-error');
  errEl.style.display = 'none';

  const result = await OnboardingWorkflow.advanceStage(onboardingId, 'compliance');
  if (!result.ok) {
    errEl.innerHTML = '<strong>Cannot advance yet:</strong><br>' + result.blockers.join('<br>');
    errEl.style.display = 'block';
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    return;
  }

  await OnboardingWorkflow.logEvent(supplierId, onboardingId, 'stage_advanced',
    'Document collection marked complete. Advanced to Compliance Review stage.',
    { from_stage: 'documents', to_stage: 'compliance' }
  );

  location.href = `compliance-review.html?supplier_id=${supplierId}&onboarding_id=${onboardingId}`;
}

// ── Init ──────────────────────────────────────────────────────────────────

(async () => {
  if (!supplierId || !onboardingId) {
    document.body.innerHTML = '<p style="padding:2rem;color:var(--color-danger)">Missing supplier_id or onboarding_id in URL.</p>';
    return;
  }
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  await loadDocuments();
})();
