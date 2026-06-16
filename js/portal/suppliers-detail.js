/**
 * Vertex Metals Portal — Supplier Detail
 * Handles portal/suppliers/detail.html
 */

function esc(s) { if (s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n,dp=2) { if (n==null||isNaN(n)) return '—'; return Number(n).toLocaleString('en-GB',{minimumFractionDigits:dp,maximumFractionDigits:dp}); }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }
function fmtTime(d) { if (!d) return ''; return new Date(d).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }

// Groups timeline entries (already ordered newest-first) into per-day
// buckets so they can be rendered as collapsible rows.
function groupTrailByDate(trail) {
  const groups = [];
  for (const t of trail) {
    const date = fmtDate(t.occurred_at);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.items.push(t);
    else groups.push({ date, items: [t] });
  }
  return groups;
}

// Renders a label/value pair, falling back to an em-dash for empty values.
function fieldBlock(label, value) {
  return `<div>
    <div style="color:var(--color-text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">${esc(label)}</div>
    <div>${value != null && value !== '' ? esc(String(value)) : '—'}</div>
  </div>`;
}

const supplierId = new URLSearchParams(location.search).get('id');
const _tabLoaded = {};
let supplierData = null;
let allOnboardings = [];
let onboardingData = null;

// ── Address helpers ──────────────────────────────────────────────────────

function formatAddress(line1, line2, city, postcode, country) {
  const parts = [line1, line2, city, postcode, country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function hasDispatchAddress(s) {
  return !!(s.dispatch_address_line_1 || s.dispatch_address_line_2 || s.dispatch_city || s.dispatch_postcode || s.dispatch_country);
}

// ── Bank details ─────────────────────────────────────────────────────────

const QMS_LABELS = { none: 'None', iso_9001: 'ISO 9001', iatf_16949: 'IATF 16949', other: 'Other' };

function maskAccountNumber(v) {
  if (!v) return '—';
  const clean = v.replace(/\s+/g, '');
  return clean.length <= 4 ? clean : '**** '.repeat(Math.floor((clean.length - 4) / 4)) + clean.slice(-4);
}

function renderBankDetailsBlock() {
  const s = supplierData;
  const badgeEl = document.getElementById('bank-status-badge');
  const el = document.getElementById('bank-details-block');
  const hasBank = s.bank_account_number || s.bank_iban;

  if (!hasBank) {
    badgeEl.innerHTML = '<span class="badge badge-neutral">Not on file</span>';
    el.innerHTML = '<p style="color:var(--color-text-muted);margin:0">No bank details recorded.</p>';
    return;
  }

  badgeEl.innerHTML = s.bank_account_verified_in_name
    ? '<span class="badge badge-success">Verified</span>'
    : '<span class="badge badge-warning">Unverified</span>';

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--space-4)">
      <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Account Name</div>${esc(s.bank_account_name || '—')}</div>
      <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Bank Name</div>${esc(s.bank_name || '—')}</div>
      <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Account Number</div>
        <span id="bank-acct-display" data-revealed="0">${esc(maskAccountNumber(s.bank_account_number))}</span>
        ${s.bank_account_number ? `<button type="button" class="btn btn-ghost btn-sm" id="bank-acct-toggle" style="border:none;padding:0 0 0 4px">Show</button>` : ''}
      </div>
      <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">IBAN</div>
        <span id="bank-iban-display" data-revealed="0">${esc(maskAccountNumber(s.bank_iban))}</span>
        ${s.bank_iban ? `<button type="button" class="btn btn-ghost btn-sm" id="bank-iban-toggle" style="border:none;padding:0 0 0 4px">Show</button>` : ''}
      </div>
      <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Sort Code / Routing Number</div>${esc(s.bank_sort_code || '—')}</div>
      <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">SWIFT / BIC</div>${esc(s.bank_swift_bic || '—')}</div>
    </div>`;

  document.getElementById('bank-acct-toggle')?.addEventListener('click', (e) => {
    const span = document.getElementById('bank-acct-display');
    const revealed = span.dataset.revealed === '1';
    span.textContent = revealed ? maskAccountNumber(s.bank_account_number) : s.bank_account_number;
    span.dataset.revealed = revealed ? '0' : '1';
    e.target.textContent = revealed ? 'Show' : 'Hide';
  });
  document.getElementById('bank-iban-toggle')?.addEventListener('click', (e) => {
    const span = document.getElementById('bank-iban-display');
    const revealed = span.dataset.revealed === '1';
    span.textContent = revealed ? maskAccountNumber(s.bank_iban) : s.bank_iban;
    span.dataset.revealed = revealed ? '0' : '1';
    e.target.textContent = revealed ? 'Show' : 'Hide';
  });
}

// ── Tabs ──────────────────────────────────────────────────────────────────

function switchTab(name) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  if (!_tabLoaded[name]) { _tabLoaded[name] = true; loadTabData(name); }
}

async function loadTabData(name) {
  if (name === 'overview')    loadOverview();
  if (name === 'onboarding')  loadOnboarding();
  if (name === 'commercial')  loadCommercial();
  if (name === 'products')    loadProducts();
  if (name === 'documents')   loadDocumentsTab();
  if (name === 'compliance')  loadCompliance();
  if (name === 'finance')     loadFinance();
  if (name === 'activity')    loadActivity();
  if (name === 'orders')      loadOrders();
  if (name === 'concessions') loadConcessions();
  if (name === 'disputes')    loadDisputes();
}

const APPROVAL_CLASS = {
  approved:              'badge-success',
  conditionally_approved:'badge-warning',
  under_review:          'badge-info',
  pending_approval:      'badge-warning',
  under_audit:           'badge-warning',
  prospect:              'badge-neutral',
  rejected:              'badge-danger',
  suspended:             'badge-danger',
  delisted:              'badge-danger',
};

// ── Sticky header ─────────────────────────────────────────────────────────

function renderHeader() {
  const s = supplierData;
  const ob = onboardingData;
  const lifecycle = OnboardingWorkflow.lifecycleStatus(s, ob);
  const perms = OnboardingWorkflow.computePermissions(s, ob);
  const capSummary = OnboardingWorkflow.capabilitySummary(perms);

  document.getElementById('supplier-header').innerHTML = `
    <div class="supplier-header__top">
      <div class="supplier-header__id">
        <h1>${countryFlagEmoji(s.country) ? `<span style="margin-right:var(--space-2)">${countryFlagEmoji(s.country)}</span>` : ''}${esc(s.company_name)}</h1>
        <div class="supplier-header__tags">
          ${s.supplier_reference ? `<span class="badge badge-neutral" style="font-family:monospace">${esc(s.supplier_reference)}</span>` : ''}
          ${s.supplier_type ? `<span class="badge badge-accent">${esc(s.supplier_type.replace(/_/g,' '))}</span>` : ''}
          ${s.country ? `<span style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(s.country)}</span>` : ''}
        </div>
      </div>
      <div style="text-align:center">
        <span class="badge ${lifecycle.badgeClass}" style="font-size:var(--text-sm)">${esc(lifecycle.label)}</span>
        <div class="supplier-header__capability">${esc(capSummary)}</div>
      </div>
      <div class="supplier-header__actions">
        ${headerActionsHtml(ob)}
      </div>
    </div>
  `;
}

// Context-aware quick actions: stage-routed continue/reject (when an
// onboarding is in progress) plus the always-available edit/audit actions.
function headerActionsHtml(ob) {
  const common = `
    <button class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)" onclick="openEditAddressModal()">Edit Address</button>
    <button class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)" onclick="openEditBankModal()">Edit Bank Details</button>
    <a href="audit.html?supplier_id=${esc(supplierId)}" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)">Record Audit</a>`;

  if (!ob) return common;

  const isRejected   = ob.workflow_stage === 'rejected';
  const isTradeReady = ob.workflow_stage === 'trade_ready';
  if (isRejected || isTradeReady) return common;

  const rejectBtn = `<button class="btn btn-ghost btn-sm" style="color:var(--color-danger);border:1px solid var(--color-danger)"
    onclick="openRejectModal('${esc(ob.id)}','${esc(ob.workflow_stage)}')">Reject</button>`;

  let primary = '';
  if (ob.workflow_stage === 'draft') {
    primary = `<a href="onboard.html?supplier_id=${esc(supplierId)}" class="btn btn-primary btn-sm">Continue Registration →</a>`;
  } else if (ob.workflow_stage === 'pending_compliance') {
    const isCompliance = PortalRoles.getRoles().includes('director_compliance');
    primary = isCompliance
      ? `<a href="compliance-review.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}" class="btn btn-primary btn-sm">Compliance Review →</a>`
      : `<span class="badge badge-warning">Pending Compliance Review</span>`;
  } else if (ob.workflow_stage === 'stage1_complete') {
    primary = `<a href="pre-trade.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}" class="btn btn-primary btn-sm">Begin Stage 2 →</a>`;
  } else if (ob.workflow_stage === 'pending_stage2') {
    primary = `<a href="pre-trade.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}" class="btn btn-primary btn-sm">Continue Stage 2 →</a>`;
  } else if (ob.workflow_stage === 'awaiting_supplier_info') {
    primary = `<a href="pre-trade.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)">Continue Stage 2 →</a>
      <button class="btn btn-primary btn-sm" onclick="resumeVetting('${esc(ob.id)}')">Resume Vetting</button>`;
  } else if (ob.workflow_stage === 'stage2_complete') {
    primary = `<a href="trade-ready.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}" class="btn btn-primary btn-sm">Begin Stage 3 →</a>`;
  }

  return `${primary} ${rejectBtn} ${common}`;
}

// ── Overview tab ──────────────────────────────────────────────────────────

function sanctionsStaleness(lastScreenedAt) {
  if (!lastScreenedAt) return null;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return new Date(lastScreenedAt) < cutoff;
}

function companySummaryHtml(s) {
  const companyAddress  = formatAddress(s.address_line_1, s.address_line_2, s.city, s.postcode, s.country);
  const dispatchAddress = hasDispatchAddress(s)
    ? formatAddress(s.dispatch_address_line_1, s.dispatch_address_line_2, s.dispatch_city, s.dispatch_postcode, s.dispatch_country)
    : null;

  return `
    ${fieldBlock('Primary Contact', s.primary_contact_name)}
    ${fieldBlock('Email', s.email)}
    ${fieldBlock('Phone', s.phone)}
    ${fieldBlock('Company Phone', s.company_phone)}
    ${fieldBlock('Website', s.website)}
    ${fieldBlock('Company Address', companyAddress)}
    ${fieldBlock('Dispatch Address', dispatchAddress || (companyAddress ? 'Same as company address' : null))}
    ${fieldBlock('Onboarding Started', s.created_at ? fmtDate(s.created_at) : null)}
    ${s.notes ? `<div><div style="color:var(--color-text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Notes</div>${esc(s.notes)}</div>` : ''}
  `;
}

function commercialSnapshotHtml(s) {
  return `
    ${fieldBlock('Accepted Currencies', (s.accepted_currencies||[]).join(', ') || null)}
    ${fieldBlock('Default Currency', s.default_currency)}
    ${fieldBlock('Standard Incoterm', s.standard_incoterm)}
    ${fieldBlock('Initial Payment Terms', s.payment_terms_initial)}
    ${fieldBlock('Subsequent Payment Terms', s.payment_terms_subsequent)}
    ${fieldBlock('QMS Certification', s.qms_certification ? (QMS_LABELS[s.qms_certification] || s.qms_certification) : null)}
  `;
}

function complianceSnapshotHtml(s) {
  const ob = onboardingData;
  const catClass = { low: 'badge-success', medium: 'badge-warning', high: 'badge-danger' };
  const stale = sanctionsStaleness(s.last_sanctions_screened_at);

  return `
    <div>
      <div style="color:var(--color-text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Risk Level</div>
      ${ob?.risk_level ? `<span class="badge ${catClass[ob.risk_level]||'badge-neutral'}">${esc(ob.risk_level)} risk</span>` : '—'}
    </div>
    <div>
      <div style="color:var(--color-text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Last Sanctions Screen</div>
      ${fmtDate(s.last_sanctions_screened_at)} ${esc(s.last_sanctions_result ? `(${s.last_sanctions_result})` : '')}
      ${stale != null ? `<span class="badge ${stale?'badge-warning':'badge-success'}" style="margin-left:4px">${stale?'Re-screen due':'Current'}</span>` : ''}
    </div>
    ${fieldBlock('Next Audit Due', s.next_audit_due_date ? fmtDate(s.next_audit_due_date) : null)}
    <div>
      <div style="color:var(--color-text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Approval Status</div>
      <span class="badge ${APPROVAL_CLASS[s.approval_status]||'badge-neutral'}">${esc((s.approval_status||'prospect').replace(/_/g,' '))}</span>
    </div>
  `;
}

function permissionsHtml(perms) {
  return perms.map(p => `
    <div class="perm-row">
      <div>
        <div class="perm-row__label">${esc(p.label)}</div>
        <div class="perm-row__reason">${esc(p.reason)}</div>
      </div>
      <span class="badge ${p.state==='on'?'badge-success':'badge-neutral'} perm-pill">${p.state==='on'?'On':'Off'}</span>
    </div>`).join('');
}

function readinessHtml(ob) {
  const { quotePct, tradePct } = OnboardingWorkflow.readinessPercentages(ob);
  return `
    <div class="readiness-row">
      <div>
        <div class="readiness-item__label"><span>Quote Ready</span><span>${quotePct}%</span></div>
        <div class="readiness-bar"><div class="readiness-bar__fill ${quotePct>=100?'complete':''}" style="width:${quotePct}%"></div></div>
      </div>
      <div>
        <div class="readiness-item__label"><span>Trade Ready</span><span>${tradePct}%</span></div>
        <div class="readiness-bar"><div class="readiness-bar__fill ${tradePct>=100?'complete':''}" style="width:${tradePct}%"></div></div>
      </div>
    </div>
    ${ob ? `<div style="margin-top:var(--space-3)"><span class="badge ${OnboardingWorkflow.stageBadgeClass(ob.workflow_stage)}">${esc(OnboardingWorkflow.stageLabel(ob.workflow_stage))}</span></div>` : ''}
  `;
}

// Single most relevant blocker + CTA, derived from OnboardingWorkflow.checkGates()
// for the stage the supplier is currently working towards.
async function nextBestActionHtml() {
  const s = supplierData;
  const ob = onboardingData;
  const isCommercial = PortalRoles.getRoles().includes('director_commercial');
  const isCompliance = PortalRoles.getRoles().includes('director_compliance');

  if (!ob) {
    return `<p style="color:var(--color-text-muted);font-size:var(--text-sm);margin-bottom:var(--space-3)">No onboarding process has been started for this supplier.</p>
      ${isCommercial ? `<a href="onboard.html?supplier_id=${esc(supplierId)}" class="btn btn-primary btn-sm">Start Onboarding</a>` : ''}`;
  }

  if (ob.workflow_stage === 'rejected') {
    return `<p style="color:var(--color-text-muted);font-size:var(--text-sm);margin-bottom:var(--space-3)">This onboarding was rejected.</p>
      ${isCommercial ? `<a href="onboard.html?supplier_id=${esc(supplierId)}" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)">Start New Onboarding</a>` : ''}`;
  }

  if (ob.workflow_stage === 'trade_ready') {
    return `<p style="color:var(--color-text-muted);font-size:var(--text-sm);margin:0">Onboarding complete — supplier is Trade Ready. No outstanding actions.</p>`;
  }

  const target = ob.workflow_stage === 'draft' ? 'pending_compliance'
               : ob.workflow_stage === 'pending_compliance' ? 'stage1_complete'
               : ob.workflow_stage === 'stage2_complete' ? 'trade_ready'
               : 'stage2_complete';

  const gates = await OnboardingWorkflow.checkGates(ob, s, target);

  const ctas = {
    draft:                  { href: `onboard.html?supplier_id=${esc(supplierId)}`, label: 'Continue Registration →' },
    pending_compliance:     { href: `compliance-review.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}`, label: 'Compliance Review →' },
    stage1_complete:        { href: `pre-trade.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}`, label: 'Begin Stage 2 →' },
    pending_stage2:         { href: `pre-trade.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}`, label: 'Continue Stage 2 →' },
    awaiting_supplier_info: { href: `pre-trade.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}`, label: 'Continue Stage 2 →' },
    stage2_complete:        { href: `trade-ready.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}`, label: 'Begin Stage 3 — Trade Ready Sign-off →' },
  };
  const cta = ctas[ob.workflow_stage];

  if (ob.workflow_stage === 'pending_compliance' && !isCompliance) {
    return `
      <p style="color:var(--color-text-muted);font-size:var(--text-sm);margin-bottom:var(--space-3)">Awaiting compliance review.</p>
      <ul style="margin:0;padding-left:var(--space-4);font-size:var(--text-sm)">
        ${gates.blockers.map(b => `<li>${esc(b)}</li>`).join('')}
      </ul>
    `;
  }

  if (gates.passed) {
    return `<p style="font-size:var(--text-sm);margin-bottom:var(--space-3)">All requirements for the next stage are in place.</p>
      <a href="${cta.href}" class="btn btn-primary btn-sm">${cta.label}</a>`;
  }

  return `
    <ul style="margin:0 0 var(--space-3);padding-left:var(--space-4);font-size:var(--text-sm)">
      ${gates.blockers.map(b => `<li>${esc(b)}</li>`).join('')}
    </ul>
    <a href="${cta.href}" class="btn btn-primary btn-sm">${cta.label}</a>
  `;
}

async function recentActivityHtml() {
  const { data, error } = await supabaseClient
    .from('supplier_audit_trail')
    .select('occurred_at, description, actor_role')
    .eq('supplier_id', supplierId)
    .order('occurred_at', { ascending: false })
    .limit(8);

  if (error) return `<div class="alert alert-error">${esc(error.message)}</div>`;
  if (!data || !data.length) return '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No activity recorded yet.</p>';

  return data.map(t => `<div class="activity-item">
    <span class="activity-item__date">${fmtDate(t.occurred_at)}</span>
    <span class="activity-item__source">${esc((t.actor_role||'').replace(/_/g,' ') || '—')}</span>
    <span>${esc(t.description)}</span>
  </div>`).join('');
}

async function loadOverview() {
  const el = document.getElementById('tab-overview');
  const s = supplierData;
  const ob = onboardingData;
  const perms = OnboardingWorkflow.computePermissions(s, ob);

  el.innerHTML = `
    <div class="overview-grid">
      <div class="panel">
        <div class="panel-header"><h3>Readiness</h3></div>
        <div class="panel-body overview-card-body">${readinessHtml(ob)}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Company</h3></div>
        <div class="panel-body overview-card-body">${companySummaryHtml(s)}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Commercial</h3></div>
        <div class="panel-body overview-card-body">${commercialSnapshotHtml(s)}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Compliance</h3></div>
        <div class="panel-body overview-card-body">${complianceSnapshotHtml(s)}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Permissions</h3></div>
        <div class="panel-body">${permissionsHtml(perms)}</div>
      </div>
    </div>
    <div class="dashboard-panels">
      <div class="panel">
        <div class="panel-header"><h3>Next Best Action</h3></div>
        <div class="panel-body" id="next-best-action"><div style="color:var(--color-text-muted)">Loading…</div></div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h3>Recent Activity</h3>
          <a href="#" onclick="switchTab('activity');return false" class="btn btn-ghost btn-sm">View all →</a>
        </div>
        <div class="panel-body" id="recent-activity"><div style="color:var(--color-text-muted)">Loading…</div></div>
      </div>
    </div>
  `;

  document.getElementById('next-best-action').innerHTML = await nextBestActionHtml();
  document.getElementById('recent-activity').innerHTML = await recentActivityHtml();
}

// ── Commercial tab ────────────────────────────────────────────────────────

async function loadCommercial() {
  const el = document.getElementById('tab-commercial');
  const s = supplierData;

  el.innerHTML = `
    <div class="panel" style="margin-bottom:var(--space-6)">
      <div class="panel-header"><h3>Trading Terms</h3><button class="btn btn-secondary btn-sm" onclick="openEditCommercialModal()">Edit Commercial Terms</button></div>
      <div class="panel-body" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--space-4);font-size:var(--text-sm)">
        ${fieldBlock('Accepted Currencies', (s.accepted_currencies||[]).join(', ') || null)}
        ${fieldBlock('Default Currency', s.default_currency)}
        ${fieldBlock('Standard Incoterm', s.standard_incoterm)}
        ${fieldBlock('Initial Payment Terms', s.payment_terms_initial)}
        ${fieldBlock('Subsequent Payment Terms', s.payment_terms_subsequent)}
        ${fieldBlock('Export Licence Number', s.export_licence_number)}
      </div>
    </div>
    <div class="panel" style="margin-bottom:var(--space-6)">
      <div class="panel-header"><h3>Quality Management</h3></div>
      <div class="panel-body" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--space-4);font-size:var(--text-sm)">
        ${fieldBlock('QMS Certification', s.qms_certification ? (QMS_LABELS[s.qms_certification] || s.qms_certification) : null)}
        ${fieldBlock('Certificate Reference', s.qms_certificate_ref)}
        ${fieldBlock('Certificate Expiry', s.qms_expiry ? fmtDate(s.qms_expiry) : null)}
      </div>
    </div>
    <div class="panel">
      <div class="panel-header"><h3>ESG &amp; Environmental</h3></div>
      <div class="panel-body" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--space-4);font-size:var(--text-sm)">
        ${fieldBlock('ESG Policy In Place', s.esg_policy_in_place == null ? null : (s.esg_policy_in_place ? 'Yes' : 'No'))}
        ${fieldBlock('Carbon Reporting Available', s.carbon_reporting_available == null ? null : (s.carbon_reporting_available ? 'Yes' : 'No'))}
        ${fieldBlock('Environmental Permit Ref', s.environmental_permit_ref)}
        ${fieldBlock('Environmental Permit Expiry', s.environmental_permit_expiry ? fmtDate(s.environmental_permit_expiry) : null)}
        ${s.esg_notes ? `<div style="grid-column:1/-1"><div style="color:var(--color-text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">ESG Notes</div>${esc(s.esg_notes)}</div>` : ''}
      </div>
    </div>
  `;
}

// ── Products tab ──────────────────────────────────────────────────────────

const PRODUCT_STATUS_CLASS = { pending: 'badge-neutral', active: 'badge-success', expired: 'badge-neutral', used: 'badge-info' };
const PRODUCT_STATUS_LABEL = { pending: 'Pending quote', active: 'Active', expired: 'Expired', used: 'Used' };

let _productLines = null; // active product lines, cached for the Add Product search

async function loadProductLinesCache() {
  if (_productLines) return _productLines;
  const { data } = await supabaseClient.from('product_lines').select('id, name, cn_code, metal_family').eq('active', true).order('metal_family').order('name');
  _productLines = data || [];
  return _productLines;
}

function productRowHtml(q) {
  return `<tr>
    <td style="font-weight:600">${esc(q.product_line?.name || q.product)}</td>
    <td style="font-size:var(--text-sm)">${esc(q.specification || '—')}</td>
    <td style="font-family:var(--font-display)">${q.status === 'pending' ? '—' : '$' + fmt(q.fob_price_usd)}</td>
    <td>${esc(q.incoterm || '—')}</td>
    <td>${q.validity_date ? fmtDate(q.validity_date) : '—'}</td>
    <td>
      <span class="badge ${PRODUCT_STATUS_CLASS[q.status] || 'badge-neutral'}">${esc(PRODUCT_STATUS_LABEL[q.status] || q.status)}</span>
      ${q.onboarding_review_status ? `<span class="badge ${OnboardingWorkflow.PRODUCT_REVIEW_BADGE[q.onboarding_review_status] || 'badge-neutral'}" style="margin-left:var(--space-1)">${esc(OnboardingWorkflow.PRODUCT_REVIEW_LABELS[q.onboarding_review_status] || q.onboarding_review_status)}</span>` : ''}
    </td>
    <td style="text-align:right">
      <button class="btn btn-secondary btn-sm" onclick="openEditProductModal('${esc(q.id)}')">Edit</button>
      ${q.status === 'pending' ? `<button class="btn btn-ghost btn-sm" style="color:var(--color-danger)" onclick="removeProduct('${esc(q.id)}')">Remove</button>` : ''}
    </td>
  </tr>`;
}

async function loadProducts() {
  const el = document.getElementById('tab-products');
  el.innerHTML = '<div style="color:var(--color-text-muted)">Loading…</div>';

  const { data, error } = await supabaseClient
    .from('supplier_quotes')
    .select('*, product_line:product_lines(name, cn_code, metal_family)')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false });

  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }

  const rows = data || [];

  el.innerHTML = `
    <div class="panel">
      <div class="panel-header"><h3>Products Supplied</h3><button class="btn btn-primary btn-sm" onclick="openAddProductModal()">+ Add Product</button></div>
      <div class="panel-body">
        ${rows.length === 0
          ? '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No products linked to this supplier yet.</p>'
          : `<div class="table-wrapper"><table>
              <thead><tr><th>Product</th><th>Specification</th><th>FOB Price (USD/MT)</th><th>Incoterm</th><th>Validity</th><th>Status</th><th></th></tr></thead>
              <tbody>${rows.map(productRowHtml).join('')}</tbody>
            </table></div>`}
      </div>
    </div>
  `;
}

// ── Add Product modal ────────────────────────────────────────────────────

async function openAddProductModal() {
  const lines = await loadProductLinesCache();

  document.getElementById('add-product-form-container').innerHTML = `
    <form id="add-product-form" onsubmit="submitAddProduct(event)">
      <div class="form-group">
        <label class="form-label">Product <span style="color:var(--color-danger)">*</span></label>
        <input type="text" class="form-input" id="ap-product" list="ap-product-options" required autocomplete="off" placeholder="Search the product catalogue…" />
        <datalist id="ap-product-options">
          ${lines.map(pl => `<option value="${esc(pl.name)}"></option>`).join('')}
        </datalist>
        <span style="font-size:var(--text-xs);color:var(--color-text-muted)">Can't find it? <a href="../product-lines/index.html?action=new" target="_blank">Add a new product line →</a>, then try again.</span>
      </div>
      <p style="font-size:var(--text-sm);color:var(--color-text-muted);margin-top:var(--space-3)">This links the product to ${esc(supplierData?.company_name || 'this supplier')} as permitted to supply, without requiring pricing yet. Pricing, incoterm and validity can be added afterwards via Edit.</p>
      <div id="ap-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Add Product</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('add-product-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;

  document.getElementById('add-product-modal').classList.add('open');
}

async function submitAddProduct(e) {
  e.preventDefault();
  const alertEl = document.getElementById('ap-alert');
  const name = document.getElementById('ap-product').value.trim();

  const match = _productLines.find(pl => pl.name.toLowerCase() === name.toLowerCase());
  if (!match) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = `"${name}" was not found in the product catalogue. Add it as a new product line first, then try again.`;
    return;
  }

  const { data: existing } = await supabaseClient.from('supplier_quotes')
    .select('id').eq('supplier_id', supplierId).eq('product_line_id', match.id).limit(1);
  if (existing && existing.length) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = `${match.name} is already linked to this supplier.`;
    return;
  }

  const { error } = await supabaseClient.from('supplier_quotes').insert([{
    supplier_id:     supplierId,
    product_line_id: match.id,
    product:         match.name,
    incoterm:        'FOB',
    fob_price_usd:   0,
    status:          'pending',
  }]);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
    return;
  }

  document.getElementById('add-product-modal').classList.remove('open');
  loadProducts();
}

// ── Edit Product modal ───────────────────────────────────────────────────

async function openEditProductModal(id) {
  const { data: q, error } = await supabaseClient.from('supplier_quotes').select('*').eq('id', id).single();
  if (error || !q) return;

  document.getElementById('edit-product-form-container').innerHTML = `
    <form id="edit-product-form" onsubmit="submitEditProduct(event,'${esc(id)}')">
      <div class="form-group" style="margin-bottom:var(--space-4)">
        <label class="form-label">Product</label>
        <input type="text" class="form-input" value="${esc(q.product)}" disabled />
      </div>
      <div class="form-group">
        <label class="form-label">Specification</label>
        <input type="text" class="form-input" id="ep-spec" value="${esc(q.specification || '')}" placeholder="e.g. 1350-H19, 2mm dia, reel 25kg" />
      </div>
      <div class="form-grid" style="margin-top:var(--space-3)">
        <div class="form-group">
          <label class="form-label">FOB Price (USD/MT)</label>
          <input type="number" class="form-input" id="ep-fob" value="${q.fob_price_usd ?? ''}" step="0.01" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Quantity (MT)</label>
          <input type="number" class="form-input" id="ep-qty" value="${q.quantity_mt ?? ''}" step="0.001" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Incoterm</label>
          <select class="form-select" id="ep-incoterm">
            <option value="FOB" ${q.incoterm==='FOB'?'selected':''}>FOB</option>
            <option value="CIF" ${q.incoterm==='CIF'?'selected':''}>CIF</option>
            <option value="EXW" ${q.incoterm==='EXW'?'selected':''}>EXW</option>
            <option value="DAP" ${q.incoterm==='DAP'?'selected':''}>DAP</option>
            <option value="DDP" ${q.incoterm==='DDP'?'selected':''}>DDP</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Validity Date</label>
          <input type="date" class="form-input" id="ep-validity" value="${q.validity_date || ''}" />
        </div>
      </div>
      <div class="form-group" style="margin-top:var(--space-3)">
        <label class="form-label">Status</label>
        <select class="form-select" id="ep-status">
          <option value="pending" ${q.status==='pending'?'selected':''}>Pending quote</option>
          <option value="active"  ${q.status==='active' ?'selected':''}>Active</option>
          <option value="expired" ${q.status==='expired'?'selected':''}>Expired</option>
          <option value="used"    ${q.status==='used'   ?'selected':''}>Used</option>
        </select>
      </div>
      <div class="form-group" style="margin-top:var(--space-3)">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="ep-notes" rows="2">${esc(q.notes || '')}</textarea>
      </div>
      <div id="ep-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Save Changes</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('edit-product-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;

  document.getElementById('edit-product-modal').classList.add('open');
}

async function submitEditProduct(e, id) {
  e.preventDefault();
  const alertEl = document.getElementById('ep-alert');

  const payload = {
    specification: document.getElementById('ep-spec').value.trim() || null,
    fob_price_usd: parseFloat(document.getElementById('ep-fob').value) || 0,
    quantity_mt:   parseFloat(document.getElementById('ep-qty').value) || null,
    incoterm:      document.getElementById('ep-incoterm').value || 'FOB',
    validity_date: document.getElementById('ep-validity').value || null,
    status:        document.getElementById('ep-status').value,
    notes:         document.getElementById('ep-notes').value.trim() || null,
  };

  const { error } = await supabaseClient.from('supplier_quotes').update(payload).eq('id', id);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
    return;
  }

  document.getElementById('edit-product-modal').classList.remove('open');
  loadProducts();
}

async function removeProduct(id) {
  if (!confirm('Remove this product from the supplier? This only removes the pending link — it has no quote data yet.')) return;
  const { error } = await supabaseClient.from('supplier_quotes').delete().eq('id', id);
  if (error) { alert('Delete failed: ' + error.message); return; }
  loadProducts();
}

// ── Documents tab ─────────────────────────────────────────────────────────

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

function expiryStatus(expiryDate) {
  if (!expiryDate) return 'ok';
  const exp = new Date(expiryDate);
  const now = new Date();
  const daysLeft = Math.floor((exp - now) / 86400000);
  if (daysLeft < 0)  return 'expired';
  if (daysLeft < 30) return 'expiring';
  return 'ok';
}

function docCardHtml(type, doc) {
  const label = DOC_LABELS[type] || type.replace(/_/g,' ');
  let statusBadge, detail = '';

  if (!doc) {
    statusBadge = '<span class="badge badge-neutral">Missing</span>';
  } else if (doc.not_applicable) {
    statusBadge = '<span class="badge badge-neutral">N/A</span>';
    detail = esc(doc.not_applicable_reason || '');
  } else {
    const exp = expiryStatus(doc.expiry_date);
    statusBadge = exp === 'expired'  ? '<span class="badge badge-danger">Expired</span>'
                 : exp === 'expiring' ? '<span class="badge badge-warning">Expiring</span>'
                 : '<span class="badge badge-success">Verified</span>';
    detail = `${esc(doc.file_name || '')}${doc.expiry_date ? ` · Expires ${fmtDate(doc.expiry_date)}` : ''}`;
  }

  return `<div class="doc-card">
    <div class="doc-card__title">${esc(label)}</div>
    ${statusBadge}
    ${detail ? `<div style="font-size:var(--text-xs);color:var(--color-text-muted)">${detail}</div>` : ''}
  </div>`;
}

async function loadDocumentsTab() {
  const el = document.getElementById('tab-documents');
  const s = supplierData;
  const required = OnboardingWorkflow.getRequiredDocs(s.supplier_type);

  const { data: docs, error } = await supabaseClient
    .from('supplier_documents')
    .select('*')
    .eq('supplier_id', supplierId)
    .eq('is_current', true);

  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }

  const byType = {};
  (docs||[]).forEach(d => { byType[d.document_type] = d; });

  const requiredCards = required.map(type => docCardHtml(type, byType[type])).join('');
  const additional = Object.entries(byType).filter(([type]) => !required.includes(type));
  const additionalCards = additional.map(([type, doc]) => docCardHtml(type, doc)).join('');

  const onboardingId = onboardingData?.id || '';

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4);flex-wrap:wrap;gap:var(--space-3)">
      <div style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-text-muted)">Required Documents (${required.length})</div>
      <a href="documents.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(onboardingId)}" class="btn btn-primary btn-sm">Manage Documents →</a>
    </div>
    <div class="doc-grid">${requiredCards}</div>
    ${additionalCards ? `
      <div style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-text-muted);margin:var(--space-6) 0 var(--space-4)">Additional Documents</div>
      <div class="doc-grid">${additionalCards}</div>` : ''}
  `;
}

// ── Compliance tab ────────────────────────────────────────────────────────

async function loadCompliance() {
  const el = document.getElementById('tab-compliance');
  const s  = supplierData;
  const stale = sanctionsStaleness(s.last_sanctions_screened_at);
  const onbId = onboardingData?.id;

  const [compScoresRes, commScoresRes, approvalsRes, screensRes] = await Promise.all([
    onbId
      ? supabaseClient.from('supplier_compliance_scores').select('*').eq('onboarding_id', onbId).order('computed_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    onbId
      ? supabaseClient.from('supplier_commercial_scores').select('*').eq('onboarding_id', onbId).order('computed_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    onbId
      ? supabaseClient.from('supplier_approvals').select('*').eq('onboarding_id', onbId)
          .in('approval_stage', ['gate1_compliance', 'gate1_commercial', 'gate2_compliance', 'gate2_commercial'])
          .order('decided_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabaseClient.from('sanctions_screens').select('*').eq('subject_id', supplierId).order('screened_at', { ascending: false }),
  ]);

  const compScores = compScoresRes.data || [];
  const commScores = commScoresRes.data || [];
  const approvals  = approvalsRes.data  || [];
  const screens    = screensRes.data    || [];

  function scoreRows(scores, type) {
    if (!scores.length) return '<p style="font-size:var(--text-sm);color:var(--color-text-muted)">No scores recorded yet.</p>';
    return scores.map(score => {
      const bandClass = type === 'compliance'
        ? (score.rating_band === 'Low Risk' ? 'badge-success' : score.rating_band === 'Medium Risk' ? 'badge-warning' : 'badge-danger')
        : ((score.rating_band === 'Strategic Supplier' || score.rating_band === 'Strong Fit') ? 'badge-success' : score.rating_band === 'Moderate Fit' ? 'badge-warning' : 'badge-neutral');
      const pills = (score.components || []).map(c => {
        const cls = c.score < 0 ? 'score-pill score-pill-positive' : c.score > 0 ? 'score-pill score-pill-risk' : 'score-pill score-pill-neutral';
        return `<span class="${cls}">${esc(c.label)} ${c.score > 0 ? '+' : ''}${c.score}</span>`;
      }).join(' ');
      return `
        <div style="padding:var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-sm);margin-bottom:var(--space-3)">
          <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-bottom:${pills ? 'var(--space-2)' : '0'}">
            <span class="badge badge-neutral" style="font-size:10px">Gate ${score.gate}</span>
            <span class="badge ${bandClass}">${esc(score.rating_band)}</span>
            <span style="font-size:var(--text-sm);color:var(--color-text-muted)">Score: ${score.total_score !== null ? score.total_score : '—'}</span>
            <span style="font-size:var(--text-xs);color:var(--color-text-muted);margin-left:auto">${fmtDate(score.computed_at)}</span>
          </div>
          ${pills ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${pills}</div>` : ''}
        </div>`;
    }).join('');
  }

  const GATE_LABELS = {
    gate1_compliance: 'Gate 1 — Compliance Director',
    gate1_commercial: 'Gate 1 — Commercial Director',
    gate2_compliance: 'Gate 2 — Compliance Director',
    gate2_commercial: 'Gate 2 — Commercial Director',
  };

  const approvalsHtml = approvals.length
    ? approvals.map(a => {
        const decClass = (a.decision === 'reject' || a.decision === 'rejected') ? 'badge-danger'
          : (a.decision === 'approve_with_conditions' || a.decision === 'approved_with_conditions') ? 'badge-warning'
          : 'badge-success';
        return `
          <div style="padding:var(--space-3) var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-sm);margin-bottom:var(--space-3)">
            <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-bottom:${a.justification ? 'var(--space-2)' : '0'}">
              <span style="font-size:var(--text-xs);color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em">${esc(GATE_LABELS[a.approval_stage] || a.approval_stage)}</span>
              <span class="badge ${decClass}">${esc(a.decision.replace(/_/g,' '))}</span>
              <span style="font-size:var(--text-xs);color:var(--color-text-muted);margin-left:auto">${fmtDate(a.decided_at)}</span>
            </div>
            ${a.justification ? `<p style="font-size:var(--text-sm);margin:0">${esc(a.justification)}</p>` : ''}
            ${a.conditions ? `<p style="font-size:var(--text-xs);color:var(--color-text-muted);white-space:pre-line;margin:var(--space-1) 0 0">${esc(a.conditions)}</p>` : ''}
          </div>`;
      }).join('')
    : '<p style="font-size:var(--text-sm);color:var(--color-text-muted)">No director approvals recorded yet.</p>';

  const resultClass = { clear:'badge-success', potential_match:'badge-warning', confirmed_match:'badge-danger' };
  const screensHtml = screensRes.error
    ? `<p style="color:var(--color-danger);font-size:var(--text-sm)">${esc(screensRes.error.message)}</p>`
    : screens.length
      ? `<div class="table-wrapper"><table><thead><tr><th>Date</th><th>Lists Screened</th><th>Tool</th><th>Result</th><th>Notes</th></tr></thead><tbody>
          ${screens.map(sc => `<tr>
            <td style="font-size:var(--text-sm)">${fmtDate(sc.screened_at)}</td>
            <td style="font-size:var(--text-sm)">${(sc.lists_screened||[]).join(', ')||'—'}</td>
            <td style="font-size:var(--text-sm)">${esc(sc.tool_used||'—')}</td>
            <td><span class="badge ${resultClass[sc.result]||'badge-neutral'}">${esc((sc.result||'').replace(/_/g,' '))}</span></td>
            <td style="font-size:var(--text-sm)">${esc(sc.match_resolution_notes||'—')}</td>
          </tr>`).join('')}
        </tbody></table></div>`
      : '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No sanctions screens recorded.</p>';

  el.innerHTML = `
    <div class="panel" style="margin-bottom:var(--space-6)">
      <div class="panel-header"><h3>Compliance Risk Score</h3></div>
      <div class="panel-body">${scoreRows(compScores, 'compliance')}</div>
    </div>
    <div class="panel" style="margin-bottom:var(--space-6)">
      <div class="panel-header"><h3>Commercial Suitability Score</h3></div>
      <div class="panel-body">${scoreRows(commScores, 'commercial')}</div>
    </div>
    <div class="panel" style="margin-bottom:var(--space-6)">
      <div class="panel-header"><h3>Director Approvals</h3></div>
      <div class="panel-body">${approvalsHtml}</div>
    </div>
    <div class="panel" style="margin-bottom:var(--space-6)">
      <div class="panel-header">
        <h3>Sanctions Screening</h3>
        ${stale != null ? `<span class="badge ${stale ? 'badge-warning' : 'badge-success'}">${stale ? 'Re-screen due' : 'Current'}</span>` : ''}
      </div>
      <div class="panel-body">
        <div style="margin-bottom:var(--space-4);font-size:var(--text-sm)">
          <div style="color:var(--color-text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Last Screen</div>
          ${fmtDate(s.last_sanctions_screened_at)} <span style="color:var(--color-text-muted)">${esc(s.last_sanctions_result ? `(${s.last_sanctions_result})` : '')}</span>
        </div>
        ${screensHtml}
      </div>
    </div>
    <div class="panel">
      <div class="panel-header"><h3>Audit</h3></div>
      <div class="panel-body" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-4);font-size:var(--text-sm)">
        ${fieldBlock('Next Audit Due', s.next_audit_due_date ? fmtDate(s.next_audit_due_date) : null)}
        <div>
          <div style="color:var(--color-text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Approval Status</div>
          <span class="badge ${APPROVAL_CLASS[s.approval_status]||'badge-neutral'}">${esc((s.approval_status||'prospect').replace(/_/g,' '))}</span>
        </div>
      </div>
    </div>
  `;
}

// ── Finance tab ───────────────────────────────────────────────────────────

async function loadFinance() {
  const el = document.getElementById('tab-finance');
  el.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3>Bank Details</h3>
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <span id="bank-status-badge"></span>
          <button class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)" onclick="openEditBankModal()">Edit Bank Details</button>
        </div>
      </div>
      <div class="panel-body" id="bank-details-block"></div>
    </div>
  `;
  renderBankDetailsBlock();
}

// ── Activity tab ──────────────────────────────────────────────────────────

async function loadActivity() {
  const el = document.getElementById('tab-activity');

  const [{ data: trail, error: trailErr }, { data: screens }, { data: audits }] = await Promise.all([
    supabaseClient.from('supplier_audit_trail').select('occurred_at, description, actor_role').eq('supplier_id', supplierId).order('occurred_at', { ascending: false }),
    supabaseClient.from('sanctions_screens').select('screened_at, result, lists_screened').eq('subject_id', supplierId).order('screened_at', { ascending: false }),
    supabaseClient.from('supplier_audits').select('audit_date, audit_type, outcome, auditor_name').eq('supplier_id', supplierId).order('audit_date', { ascending: false }),
  ]);

  if (trailErr) { el.innerHTML = `<div class="alert alert-error">${esc(trailErr.message)}</div>`; return; }

  const resultLabels = { clear: 'no match', potential_match: 'potential match', confirmed_match: 'confirmed match' };

  const events = [
    ...(trail||[]).map(t => ({ occurred_at: t.occurred_at, description: t.description, source: (t.actor_role||'system').replace(/_/g,' ') })),
    ...(screens||[]).map(sc => ({ occurred_at: sc.screened_at, description: `Sanctions screen — ${resultLabels[sc.result]||sc.result}${(sc.lists_screened||[]).length ? ' (' + sc.lists_screened.join(', ') + ')' : ''}`, source: 'sanctions' })),
    ...(audits||[]).map(a => ({ occurred_at: a.audit_date, description: `${(a.audit_type||'').replace(/_/g,' ')} audit by ${a.auditor_name||'—'} — ${(a.outcome||'').replace(/_/g,' ')}`, source: 'audit' })),
  ].filter(e => e.occurred_at).sort((a,b) => new Date(b.occurred_at) - new Date(a.occurred_at));

  if (!events.length) {
    el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No activity recorded yet.</p>';
    return;
  }

  const groups = groupTrailByDate(events);
  el.innerHTML = `<div class="panel"><div class="panel-body">
    ${groups.map((g, i) => `
      <details ${i === 0 ? 'open' : ''} style="border-bottom:1px solid var(--color-border)">
        <summary style="cursor:pointer;display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) 0;font-size:var(--text-sm);font-weight:600">
          <span>${esc(g.date)}</span>
          <span class="badge badge-neutral" style="font-size:var(--text-xs);font-weight:500">${g.items.length} event${g.items.length === 1 ? '' : 's'}</span>
        </summary>
        <div style="display:flex;flex-direction:column;padding:0 0 var(--space-3) var(--space-2)">
          ${g.items.map(e => `
            <div class="activity-item">
              <span class="activity-item__date">${fmtTime(e.occurred_at)}</span>
              <span class="activity-item__source">${esc(e.source)}</span>
              <span>${esc(e.description)}</span>
            </div>`).join('')}
        </div>
      </details>`).join('')}
  </div></div>`;
}

// ── Onboarding tab ────────────────────────────────────────────────────────

async function loadOnboarding() {
  const el = document.getElementById('tab-onboarding');
  const obs = allOnboardings;
  const isCommercial = PortalRoles.getRoles().includes('director_commercial');

  if (!obs || obs.length === 0) {
    el.innerHTML = `
      <div style="padding:var(--space-6);text-align:center">
        <p style="color:var(--color-text-muted);margin-bottom:var(--space-4)">No onboarding process has been started for this supplier.</p>
        ${isCommercial ? `<a href="onboard.html?supplier_id=${esc(supplierId)}" class="btn btn-primary btn-sm">Start Onboarding</a>` : ''}
      </div>`;
    return;
  }

  const ob = obs[0]; // most recent
  const stageBadge   = OnboardingWorkflow.stageBadgeClass(ob.workflow_stage);
  const stageText    = OnboardingWorkflow.stageLabel(ob.workflow_stage);
  const isRejected   = ob.workflow_stage === 'rejected';
  const isTradeReady = ob.workflow_stage === 'trade_ready';
  const isTerminal   = isRejected || isTradeReady;

  // Stage-routed action buttons
  let advanceHtml = '';
  if (!isTerminal) {
    const rejectBtn = `<button class="btn btn-ghost btn-sm" style="color:var(--color-danger);border-color:var(--color-danger)"
      onclick="openRejectModal('${esc(ob.id)}','${esc(ob.workflow_stage)}')">Reject</button>`;

    if (ob.workflow_stage === 'draft') {
      advanceHtml = `<div style="display:flex;gap:var(--space-3);margin-top:var(--space-4);align-items:center">
        <a href="onboard.html?supplier_id=${esc(supplierId)}" class="btn btn-primary btn-sm">Continue Registration →</a>
        ${rejectBtn}</div>`;

    } else if (ob.workflow_stage === 'pending_compliance') {
      const isCompliance = PortalRoles.getRoles().includes('director_compliance');
      advanceHtml = `<div style="display:flex;gap:var(--space-3);margin-top:var(--space-4);align-items:center;flex-wrap:wrap">
        <span class="badge badge-warning">Pending Compliance Review</span>
        ${isCompliance ? `<a href="compliance-review.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}" class="btn btn-primary btn-sm">Begin Compliance Review →</a>` : ''}
        ${rejectBtn}</div>`;

    } else if (ob.workflow_stage === 'stage1_complete') {
      advanceHtml = `<div style="display:flex;gap:var(--space-3);margin-top:var(--space-4);align-items:center;flex-wrap:wrap">
        <span class="badge badge-info">Ready to Quote</span>
        <a href="pre-trade.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}" class="btn btn-primary btn-sm">
          Begin Stage 2 — Pre-Trade Vetting →
        </a>${rejectBtn}</div>`;

    } else if (ob.workflow_stage === 'pending_stage2') {
      advanceHtml = `<div style="display:flex;gap:var(--space-3);margin-top:var(--space-4);align-items:center">
        <a href="pre-trade.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}" class="btn btn-primary btn-sm">
          Continue Stage 2 →
        </a>${rejectBtn}</div>`;

    } else if (ob.workflow_stage === 'awaiting_supplier_info') {
      advanceHtml = `<div style="display:flex;gap:var(--space-3);margin-top:var(--space-4);align-items:center;flex-wrap:wrap">
        <span class="badge badge-warning">Awaiting Supplier Info</span>
        <a href="pre-trade.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)">
          Continue Stage 2 →
        </a>
        <button class="btn btn-primary btn-sm" onclick="resumeVetting('${esc(ob.id)}')">Resume Vetting</button>
        ${rejectBtn}</div>`;

    } else if (ob.workflow_stage === 'stage2_complete') {
      advanceHtml = `<div style="display:flex;gap:var(--space-3);margin-top:var(--space-4);align-items:center;flex-wrap:wrap">
        <span class="badge badge-success">Stage 2 Complete</span>
        <a href="trade-ready.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}" class="btn btn-primary btn-sm">
          Begin Stage 3 — Trade Ready Sign-off →
        </a>${rejectBtn}</div>`;
    }
  }

  // Previous onboarding records
  const prevHtml = obs.length > 1
    ? `<div style="margin-top:var(--space-6);padding-top:var(--space-4);border-top:1px solid var(--color-border)">
        <div style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-3)">Previous Onboarding Records (${obs.length - 1})</div>
        ${obs.slice(1).map(o => `
          <div style="font-size:var(--text-sm);color:var(--color-text-muted);padding:var(--space-2) 0;border-bottom:1px solid var(--color-border)">
            <span class="badge ${OnboardingWorkflow.stageBadgeClass(o.workflow_stage)}" style="margin-right:var(--space-2)">${esc(OnboardingWorkflow.stageLabel(o.workflow_stage))}</span>
            Started ${fmtDate(o.created_at)} — Risk: ${esc(o.risk_level || '—')}
          </div>`).join('')}
      </div>`
    : '';

  el.innerHTML = `
    <div class="panel">
      <div class="panel-body">

        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-2)">
          <span style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-text-muted)">Onboarding Progress</span>
          <a href="audit-trail.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}"
             class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border);font-size:var(--text-xs)">
            Export Audit Trail →
          </a>
        </div>

        ${OnboardingWorkflow.renderProgressSteps(ob.workflow_stage)}

        <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4)">
          <span class="badge ${stageBadge}">${esc(stageText)}</span>
          ${ob.risk_level ? `<span class="badge ${ob.risk_level === 'high' ? 'badge-danger' : ob.risk_level === 'medium' ? 'badge-warning' : 'badge-success'}">${esc(ob.risk_level)} risk</span>` : ''}
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">Started ${fmtDate(ob.created_at)}</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--space-4);font-size:var(--text-sm);margin-bottom:var(--space-4)">
          ${ob.recommendation ? `<div><div style="color:var(--color-text-muted);font-size:var(--text-xs);margin-bottom:2px;text-transform:uppercase;font-weight:600;letter-spacing:.08em">Compliance Recommendation</div>
            <span class="badge ${ob.recommendation === 'reject' ? 'badge-danger' : ob.recommendation === 'approve_with_conditions' ? 'badge-warning' : 'badge-success'}">${esc(ob.recommendation?.replace(/_/g,' '))}</span>
            ${ob.recommendation_rationale ? `<p style="margin:var(--space-2) 0 0;font-size:var(--text-xs);color:var(--color-text-muted)">${esc(ob.recommendation_rationale)}</p>` : ''}
          </div>` : ''}
          ${ob.decision ? `<div><div style="color:var(--color-text-muted);font-size:var(--text-xs);margin-bottom:2px;text-transform:uppercase;font-weight:600;letter-spacing:.08em">Director Decision</div>
            <span class="badge ${ob.decision === 'rejected' ? 'badge-danger' : ob.decision === 'approved_with_conditions' ? 'badge-warning' : 'badge-success'}">${esc(ob.decision?.replace(/_/g,' '))}</span>
            ${ob.decision_justification ? `<p style="margin:var(--space-2) 0 0;font-size:var(--text-xs);color:var(--color-text-muted)">${esc(ob.decision_justification)}</p>` : ''}
          </div>` : ''}
        </div>

        ${advanceHtml}

        ${isRejected && isCommercial ? `
          <div style="margin-top:var(--space-4);padding:var(--space-3);background:rgba(220,38,38,0.06);border-radius:var(--radius-sm)">
            <p style="font-size:var(--text-sm);margin:0 0 var(--space-2)">This onboarding was rejected. You can start a new onboarding process for this supplier if circumstances have changed.</p>
            <a href="onboard.html?supplier_id=${esc(supplierId)}" class="btn btn-sm btn-ghost" style="border:1px solid var(--color-border)">Start New Onboarding</a>
          </div>` : ''}

        ${prevHtml}
      </div>
    </div>`;
}

async function openRejectModal(onboardingId, currentStage) {
  const reason = prompt(`Rejecting at stage "${OnboardingWorkflow.stageLabel(currentStage)}".\n\nEnter rejection reason (required):`);
  if (!reason || !reason.trim()) return;
  const result = await OnboardingWorkflow.rejectOnboarding(onboardingId, currentStage, reason.trim());
  if (!result.ok) { alert('Error: ' + result.error); return; }
  location.reload();
}

async function resumeVetting(onboardingId) {
  const result = await OnboardingWorkflow.resumeFromAwaitingInfo(onboardingId);
  if (!result.ok) { alert('Error: ' + (result.blockers?.join(', ') || result.error)); return; }
  location.reload();
}

// ── Orders / Concessions / Disputes / KYC tabs ───────────────────────────────

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

// ── Edit Address modal ───────────────────────────────────────────────────

function openEditAddressModal() {
  const s = supplierData || {};
  const dispatchDifferent = hasDispatchAddress(s);

  document.getElementById('edit-address-form-container').innerHTML = `
    <form id="edit-address-form" onsubmit="submitEditAddress(event)">
      <div style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-3)">Company Address</div>
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div class="form-group">
          <label class="form-label">Address Line 1</label>
          <input type="text" class="form-input" id="addr-line1" value="${esc(s.address_line_1 || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Address Line 2</label>
          <input type="text" class="form-input" id="addr-line2" value="${esc(s.address_line_2 || '')}" />
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">City</label>
            <input type="text" class="form-input" id="addr-city" value="${esc(s.city || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Postcode</label>
            <input type="text" class="form-input" id="addr-postcode" value="${esc(s.postcode || '')}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Country</label>
          <select class="form-select" id="addr-country">${countryOptionsHtml(s.country)}</select>
        </div>
        <div class="form-group">
          <label class="form-label" style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer">
            <input type="checkbox" id="addr-dispatch-different" ${dispatchDifferent ? 'checked' : ''} onchange="document.getElementById('addr-dispatch-fields').style.display=this.checked?'flex':'none'" />
            Goods are dispatched from a different address (e.g. separate warehouse)
          </label>
        </div>
        <div id="addr-dispatch-fields" style="display:${dispatchDifferent ? 'flex' : 'none'};flex-direction:column;gap:var(--space-4);padding-top:var(--space-2);border-top:1px solid var(--color-border)">
          <div class="form-group">
            <label class="form-label">Dispatch Address Line 1</label>
            <input type="text" class="form-input" id="addr-dispatch-line1" value="${esc(s.dispatch_address_line_1 || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Dispatch Address Line 2</label>
            <input type="text" class="form-input" id="addr-dispatch-line2" value="${esc(s.dispatch_address_line_2 || '')}" />
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">City</label>
              <input type="text" class="form-input" id="addr-dispatch-city" value="${esc(s.dispatch_city || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Postcode</label>
              <input type="text" class="form-input" id="addr-dispatch-postcode" value="${esc(s.dispatch_postcode || '')}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Dispatch Country</label>
            <select class="form-select" id="addr-dispatch-country">${countryOptionsHtml(s.dispatch_country)}</select>
          </div>
        </div>
      </div>
      <div id="edit-address-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Save Changes</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('edit-address-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;

  document.getElementById('edit-address-modal').classList.add('open');
}

async function submitEditAddress(e) {
  e.preventDefault();
  const alertEl = document.getElementById('edit-address-alert');
  const dispatchDifferent = document.getElementById('addr-dispatch-different')?.checked;

  const payload = {
    address_line_1: document.getElementById('addr-line1')?.value.trim() || null,
    address_line_2: document.getElementById('addr-line2')?.value.trim() || null,
    city:           document.getElementById('addr-city')?.value.trim()  || null,
    postcode:       document.getElementById('addr-postcode')?.value.trim() || null,
    country:        document.getElementById('addr-country')?.value || null,
    dispatch_address_line_1: dispatchDifferent ? (document.getElementById('addr-dispatch-line1')?.value.trim() || null) : null,
    dispatch_address_line_2: dispatchDifferent ? (document.getElementById('addr-dispatch-line2')?.value.trim() || null) : null,
    dispatch_city:           dispatchDifferent ? (document.getElementById('addr-dispatch-city')?.value.trim()  || null) : null,
    dispatch_postcode:       dispatchDifferent ? (document.getElementById('addr-dispatch-postcode')?.value.trim() || null) : null,
    dispatch_country:        dispatchDifferent ? (document.getElementById('addr-dispatch-country')?.value || null) : null,
  };

  const { error } = await supabaseClient.from('contacts').update(payload).eq('id', supplierId);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
    return;
  }

  document.getElementById('edit-address-modal').classList.remove('open');
  location.reload();
}

// ── Edit Bank Details modal ──────────────────────────────────────────────

function openEditBankModal() {
  const s = supplierData || {};

  document.getElementById('edit-bank-form-container').innerHTML = `
    <form id="edit-bank-form" onsubmit="submitEditBank(event)">
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="bank-account-name">Account Name</label>
            <input type="text" class="form-input" id="bank-account-name" value="${esc(s.bank_account_name || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="bank-name">Bank Name</label>
            <input type="text" class="form-input" id="bank-name" value="${esc(s.bank_name || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="bank-account-number">Account Number</label>
            <input type="text" class="form-input" id="bank-account-number" value="${esc(s.bank_account_number || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="bank-sort-code">Sort Code / Routing Number</label>
            <input type="text" class="form-input" id="bank-sort-code" value="${esc(s.bank_sort_code || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="bank-iban">IBAN</label>
            <input type="text" class="form-input" id="bank-iban" value="${esc(s.bank_iban || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="bank-swift-bic">SWIFT / BIC</label>
            <input type="text" class="form-input" id="bank-swift-bic" value="${esc(s.bank_swift_bic || '')}" />
          </div>
        </div>
        <label style="display:flex;gap:var(--space-2);align-items:center;cursor:pointer;font-size:var(--text-sm)">
          <input type="checkbox" id="bank-verified" style="accent-color:var(--color-accent)" ${s.bank_account_verified_in_name ? 'checked' : ''} />
          I confirm this bank account is held in the exact name of the registered company above.
        </label>
      </div>
      <div id="edit-bank-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Save Changes</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('edit-bank-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;

  document.getElementById('edit-bank-modal').classList.add('open');
}

async function submitEditBank(e) {
  e.preventDefault();
  const alertEl = document.getElementById('edit-bank-alert');

  const payload = {
    bank_account_name:             document.getElementById('bank-account-name')?.value.trim() || null,
    bank_name:                      document.getElementById('bank-name')?.value.trim() || null,
    bank_account_number:           document.getElementById('bank-account-number')?.value.trim() || null,
    bank_sort_code:                 document.getElementById('bank-sort-code')?.value.trim() || null,
    bank_iban:                      document.getElementById('bank-iban')?.value.trim() || null,
    bank_swift_bic:                 document.getElementById('bank-swift-bic')?.value.trim() || null,
    bank_account_verified_in_name:  !!document.getElementById('bank-verified')?.checked,
  };

  const { error } = await supabaseClient.from('contacts').update(payload).eq('id', supplierId);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
    return;
  }

  document.getElementById('edit-bank-modal').classList.remove('open');
  location.reload();
}

// ── Edit Commercial Terms modal ──────────────────────────────────────────

const CURRENCIES = ['USD', 'GBP', 'EUR', 'INR', 'CNY', 'AED'];

function openEditCommercialModal() {
  const s = supplierData || {};
  const accepted = s.accepted_currencies || [];

  document.getElementById('edit-commercial-form-container').innerHTML = `
    <form id="edit-commercial-form" onsubmit="submitEditCommercial(event)">
      <div class="form-group" style="margin-bottom:var(--space-4)">
        <label class="form-label">Accepted Currencies</label>
        <div class="currency-grid">
          ${CURRENCIES.map(c => `
            <label class="currency-chip">
              <input type="checkbox" class="ec-currency-check" value="${c}" style="accent-color:var(--color-accent)" ${accepted.includes(c) ? 'checked' : ''} /> ${c}
            </label>`).join('')}
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Default Currency</label>
          <select class="form-select" id="ec-default-currency"></select>
        </div>
        <div class="form-group">
          <label class="form-label">Standard Incoterm</label>
          <select class="form-select" id="ec-incoterm">
            <option value="">Select…</option>
            <option value="FOB">FOB — Free on Board</option>
            <option value="CIF">CIF — Cost, Insurance &amp; Freight</option>
            <option value="DAP">DAP — Delivered at Place</option>
            <option value="EXW">EXW — Ex Works</option>
            <option value="CFR">CFR — Cost &amp; Freight</option>
            <option value="CPT">CPT — Carriage Paid To</option>
            <option value="FCA">FCA — Free Carrier</option>
            <option value="DDP">DDP — Delivered Duty Paid</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Initial Payment Terms</label>
          <input type="text" class="form-input" id="ec-payment-initial" value="${esc(s.payment_terms_initial || '')}" placeholder="e.g. 100% advance for first 3 orders" />
        </div>
        <div class="form-group">
          <label class="form-label">Subsequent Payment Terms</label>
          <input type="text" class="form-input" id="ec-payment-subsequent" value="${esc(s.payment_terms_subsequent || '')}" placeholder="e.g. 30% advance, 70% against B/L copy" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Export Licence Number</label>
          <input type="text" class="form-input" id="ec-export-licence" value="${esc(s.export_licence_number || '')}" />
        </div>
      </div>
      <div id="edit-commercial-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Save Changes</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('edit-commercial-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;

  document.getElementById('ec-incoterm').value = s.standard_incoterm || '';
  document.querySelectorAll('.ec-currency-check').forEach(cb => cb.addEventListener('change', updateEcDefaultCurrencyOptions));
  updateEcDefaultCurrencyOptions();

  document.getElementById('edit-commercial-modal').classList.add('open');
}

function updateEcDefaultCurrencyOptions() {
  const s = supplierData || {};
  const checked = Array.from(document.querySelectorAll('.ec-currency-check:checked')).map(cb => cb.value);
  const sel = document.getElementById('ec-default-currency');
  const current = sel.value || s.default_currency || '';
  sel.innerHTML = checked.length
    ? checked.map(c => `<option value="${c}">${c}</option>`).join('')
    : '<option value="">Select an accepted currency first…</option>';
  if (checked.includes(current)) sel.value = current;
}

async function submitEditCommercial(e) {
  e.preventDefault();
  const alertEl = document.getElementById('edit-commercial-alert');

  const accepted = Array.from(document.querySelectorAll('.ec-currency-check:checked')).map(cb => cb.value);

  const payload = {
    accepted_currencies:      accepted.length ? accepted : null,
    default_currency:         document.getElementById('ec-default-currency').value || null,
    standard_incoterm:        document.getElementById('ec-incoterm').value || null,
    payment_terms_initial:    document.getElementById('ec-payment-initial').value.trim() || null,
    payment_terms_subsequent: document.getElementById('ec-payment-subsequent').value.trim() || null,
    export_licence_number:    document.getElementById('ec-export-licence').value.trim() || null,
  };

  const { error } = await supabaseClient.from('contacts').update(payload).eq('id', supplierId);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
    return;
  }

  document.getElementById('edit-commercial-modal').classList.remove('open');
  location.reload();
}

// ── Init ──────────────────────────────────────────────────────────────────

(async () => {
  if (!supplierId) { document.body.innerHTML = '<p style="padding:2rem">No supplier ID specified.</p>'; return; }
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  await StateMachine.loadReference();

  const { data: supplier, error } = await supabaseClient.from('contacts').select('*').eq('id', supplierId).single();
  if (error || !supplier) { document.body.innerHTML = `<p style="padding:2rem;color:var(--color-danger)">Supplier not found.</p>`; return; }
  supplierData = supplier;

  document.getElementById('topbar-title').textContent = supplier.company_name;
  document.title = `${supplier.company_name} — Vertex Metals Portal`;

  const { data: obs } = await supabaseClient
    .from('supplier_onboarding')
    .select('*')
    .eq('contact_id', supplierId)
    .order('created_at', { ascending: false })
    .limit(5);
  allOnboardings = obs || [];
  onboardingData = allOnboardings[0] || null;

  renderHeader();

  // Show a flash banner if arriving from a fresh onboarding creation
  if (new URLSearchParams(location.search).get('onboarding_new') === '1') {
    const banner = document.createElement('div');
    banner.style.cssText = 'margin-bottom:var(--space-4);padding:var(--space-3) var(--space-4);background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.2);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--color-success)';
    banner.textContent = 'Onboarding created. Assigned to compliance director for vetting.';
    document.querySelector('.portal-content').prepend(banner);
    setTimeout(() => banner.remove(), 6000);
  }

  _tabLoaded.overview = true;
  loadOverview();
})();
