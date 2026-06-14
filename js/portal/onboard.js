/**
 * Vertex Metals Portal — Stage 1 (Quoting Only Registration)
 * Handles portal/suppliers/onboard.html
 *
 * Captures company identity, address, primary contact, sanctions screening,
 * and a preliminary risk assessment. On "Complete Stage 1" the onboarding
 * moves to workflow_stage='stage1_complete'
 * (Ready to Quote). "Save Progress & Exit" persists a 'draft' for later resumption.
 *
 * If ?enquiry_id is in the URL, fields are pre-filled from the enquiry.
 * If ?supplier_id is in the URL, an existing contact is loaded — either to
 * resume a 'draft' onboarding or to re-onboard a previously 'rejected' supplier
 * (a fresh onboarding record is created in that case).
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

const params      = new URLSearchParams(location.search);
const enquiryId   = params.get('enquiry_id');
const reonboardId = params.get('supplier_id'); // existing contact — resume draft or re-onboard rejected

// ── State ────────────────────────────────────────────────────────────────

let contactId  = null;
let onboardingId = null;
let existingSanctionsScreen = null;
let existingRiskAssessment  = null;

const CONTACT_TYPE_MAP = {
  manufacturing:         'supplier',
  materials_commodities: 'supplier',
  logistics:             'logistics',
  packaging:             'other',
  service_provider:      'other',
};

const SANCTIONS_LISTS = [
  { name: 'UK Sanctions List', url: 'https://search-uk-sanctions-list.service.gov.uk/' },
  { name: 'UN',                url: 'https://www.un.org/securitycouncil/content/un-sc-consolidated-list' },
  { name: 'EU',                url: 'https://www.sanctionsmap.eu/#/main' },
];

// ── Risk assessment scoring ─────────────────────────────────────────────
//
// Which of the five criteria apply, and their relative weight in the
// overall score, are driven by OnboardingWorkflow.SUPPLIER_TYPE_PROFILES
// (see js/portal/supplier-onboarding.js) — keyed off the selected
// Supplier Type.

// Financial Viability rubric is tier-dependent. Full-diligence suppliers
// (manufacturing / materials_commodities) are settled by Irrevocable Letter
// of Credit, which hedges Vertex's capital exposure if goods aren't shipped —
// so the score reflects counterparty integrity / fraud and sanctions risk
// rather than balance-sheet strength. Simplified-track suppliers (logistics,
// packaging, service_provider) are paid directly on standard terms, so the
// traditional creditworthiness framing still applies.
const FINANCIAL_CRITERION = {
  full: {
    description: 'Settled by Irrevocable Letter of Credit, which hedges Vertex Metals’ capital exposure if goods are not shipped. Score reflects counterparty integrity and fraud/sanctions risk rather than balance-sheet strength.',
    options: [
      ['1', '1 — Strong: publicly listed, state-owned enterprise, or provides full audited accounts (e.g. SAIL)'],
      ['2', '2 — Good: private entity, but provides verified tax certificates, active export licences, and evidence of recent international shipments'],
      ['3', '3 — Acceptable (with LC): private entity, limited public footprint, but banking details match corporate registry and quality is independently verified (e.g. ASI reports)'],
      ['4', '4 — Elevated risk: newly incorporated (under 12 months), missing tax documentation, or pushing for non-standard payment terms — requires MLRO sign-off'],
      ['5', '5 — Unacceptable: cannot provide basic corporate registration, requests third-party payments, or matched on adverse media/sanctions'],
    ],
  },
  simplified: {
    description: 'Payment history, company age, availability of accounts or credit references',
    options: [
      ['1', '1 — Strong: listed or well-established company with audited accounts'],
      ['2', '2 — Good: private SME with accessible trade references'],
      ['3', '3 — Adequate: limited documentation; smaller operation'],
      ['4', '4 — Limited: new company or opaque financial structure'],
      ['5', '5 — Very limited: no financial information obtainable'],
    ],
  },
};

function renderFinancialCriterion() {
  const supplierType = document.getElementById('ob-type')?.value;
  const tier = OnboardingWorkflow.requiresFullDiligence(supplierType) ? 'full' : 'simplified';
  const def = FINANCIAL_CRITERION[tier];

  const descEl = document.getElementById('financial-criterion-desc');
  if (descEl) descEl.textContent = def.description;

  const sel = document.getElementById('score-financial');
  if (sel) {
    const current = sel.value;
    sel.innerHTML = '<option value="">Select…</option>' +
      def.options.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('');
    if (current) sel.value = current;
  }
}

function getScores(criteria) {
  return criteria.map(c => {
    const val = document.getElementById(`score-${c}`)?.value;
    return val ? parseFloat(val) : null;
  });
}

// Shows/hides each criterion card based on which risk criteria apply to the
// selected supplier type (OnboardingWorkflow.SUPPLIER_TYPE_PROFILES).
function applyCriteriaVisibility(supplierType) {
  const criteria = OnboardingWorkflow.getRiskCriteria(supplierType);
  OnboardingWorkflow.RISK_CRITERIA.forEach(c => {
    const card = document.getElementById(`criterion-${c}`);
    if (card) card.style.display = criteria.includes(c) ? '' : 'none';
  });
}

function updateOverallScore() {
  const supplierType = document.getElementById('ob-type')?.value;
  const criteria = OnboardingWorkflow.getRiskCriteria(supplierType);
  const scores = getScores(criteria);
  criteria.forEach((c, i) => {
    const disp = document.getElementById(`score-display-${c}`);
    if (disp) disp.textContent = scores[i] !== null ? scores[i] : '—';
  });

  const overall = OnboardingWorkflow.computeOverall(scores, criteria);
  const cat = OnboardingWorkflow.riskCategory(overall, scores);
  const baseCat = OnboardingWorkflow.riskCategoryFromScore(overall);

  const scoreVal   = document.getElementById('overall-score-value');
  const scoreBadge = document.getElementById('overall-risk-badge');
  const badgeEl    = document.getElementById('overall-score-badge');
  const overrideSec = document.getElementById('override-section');
  const escalationNote = document.getElementById('overall-score-escalation-note');

  if (scoreVal) scoreVal.textContent = overall !== null ? overall.toFixed(2) : '—';
  if (overrideSec) overrideSec.style.display = overall !== null ? 'block' : 'none';

  const badgeClass = cat === 'high' ? 'badge-danger' : cat === 'medium' ? 'badge-warning' : 'badge-success';
  const badgeHtml = cat ? `<span class="badge ${badgeClass}">${cat} risk</span>` : '';
  if (scoreBadge) scoreBadge.innerHTML = badgeHtml;
  if (badgeEl) badgeEl.innerHTML = badgeHtml;

  if (escalationNote) {
    const escalated = cat && cat !== baseCat;
    escalationNote.textContent = escalated
      ? `Escalated from ${baseCat} — at least one criterion scored 4/5 or higher.`
      : '';
    escalationNote.style.display = escalated ? 'block' : 'none';
  }
}

function prefillRiskAssessment(ra) {
  OnboardingWorkflow.RISK_CRITERIA.forEach(c => {
    const score = ra[`${OnboardingWorkflow.RISK_CRITERIA_COLUMN[c]}_score`];
    if (score != null) {
      const sel = document.getElementById(`score-${c}`);
      if (sel) sel.value = String(score);
    }
    const notes = ra[`${OnboardingWorkflow.RISK_CRITERIA_COLUMN[c]}_notes`];
    if (notes) setVal(`notes-${c}`, notes);
  });
  setVal('overall-notes', ra.overall_notes);
  if (ra.risk_category_override) {
    const chk = document.getElementById('override-check');
    if (chk) chk.checked = true;
    document.getElementById('override-reason-group').style.display = 'block';
    document.getElementById('override-category-group').style.display = 'block';
    setVal('override-reason', ra.risk_category_override_reason);
    const cat = document.getElementById('override-category');
    if (cat && ra.risk_category) cat.value = ra.risk_category;
  }
  updateOverallScore();
}

// ── Sanctions screening panel ───────────────────────────────────────────

function renderSanctionsListLinks() {
  document.getElementById('sanctions-list-links').innerHTML = SANCTIONS_LISTS.map(l =>
    `<a href="${esc(l.url)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)">${esc(l.name)} →</a>`
  ).join('');
}

async function loadSanctionsSection() {
  if (contactId) {
    const { data } = await supabaseClient
      .from('sanctions_screens')
      .select('id, screened_at, lists_screened, tool_used, result, match_resolution_notes')
      .eq('subject_id', contactId)
      .order('screened_at', { ascending: false })
      .limit(1);
    existingSanctionsScreen = data?.[0] || null;
  }
  renderSanctionsSection();
}

function renderSanctionsSection() {
  const el = document.getElementById('sanctions-section');
  const badgeEl = document.getElementById('sanctions-status-badge');
  const RESULT_CLASS = { clear: 'badge-success', potential_match: 'badge-warning', confirmed_match: 'badge-danger' };
  const companyName = document.getElementById('ob-company')?.value || '';

  if (existingSanctionsScreen) {
    const s = existingSanctionsScreen;
    badgeEl.innerHTML = `<span class="badge badge-success">Screen on file</span>`;
    el.innerHTML = `
      <div style="padding:var(--space-4);background:rgba(22,163,74,0.06);border:1px solid rgba(22,163,74,0.2);border-radius:var(--radius-sm);margin-bottom:var(--space-4)">
        <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:var(--space-2)">Sanctions screen on file</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-3);font-size:var(--text-sm)">
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Date</div>${fmtDate(s.screened_at)}</div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Lists</div>${(s.lists_screened||[]).join(', ')||'—'}</div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Result</div><span class="badge ${RESULT_CLASS[s.result]||'badge-neutral'}">${esc(s.result?.replace('_',' '))}</span></div>
          ${s.tool_used ? `<div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Tool</div>${esc(s.tool_used)}</div>` : ''}
        </div>
        ${s.match_resolution_notes ? `<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin:var(--space-2) 0 0">${esc(s.match_resolution_notes)}</p>` : ''}
      </div>
      <p style="font-size:var(--text-sm);color:var(--color-text-muted)">A screen is on file for this supplier and satisfies the Stage 1 requirement.</p>`;
    return;
  }

  badgeEl.innerHTML = `<span class="badge badge-danger">Screen required</span>`;
  el.innerHTML = buildNewScreenForm(companyName);
}

function buildNewScreenForm(companyName) {
  const today = new Date().toISOString().split('T')[0];
  return `
    <div style="display:flex;flex-direction:column;gap:var(--space-4)">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="s-name">Subject Name Screened</label>
          <input type="text" class="form-input" id="s-name" value="${esc(companyName)}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="s-date">Screening Date</label>
          <input type="date" class="form-input" id="s-date" value="${today}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Lists Screened</label>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-4)">
          ${SANCTIONS_LISTS.map(l =>
            `<label style="display:flex;gap:var(--space-2);align-items:center;font-size:var(--text-sm);cursor:pointer">
              <input type="checkbox" class="list-check" value="${esc(l.name)}" style="accent-color:var(--color-accent)" checked /> ${esc(l.name)}
            </label>`).join('')}
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="s-tool">Screening Tool / Source</label>
          <input type="text" class="form-input" id="s-tool" placeholder="e.g. Dow Jones, ComplyAdvantage, manual" />
        </div>
        <div class="form-group">
          <label class="form-label" for="s-result">Result <span class="required">*</span></label>
          <select class="form-select" id="s-result">
            <option value="">Select result…</option>
            <option value="clear">Clear — no matches</option>
            <option value="potential_match">Potential match — investigated and cleared</option>
            <option value="confirmed_match">Confirmed match</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="s-notes">Notes / Match Resolution</label>
        <textarea class="form-textarea" id="s-notes" rows="2" placeholder="Any potential matches and how they were resolved…"></textarea>
      </div>
    </div>`;
}

// Updates the "Before you begin" checklist for the selected supplier type.
function renderPrerequisites() {
  const supplierType = document.getElementById('ob-type')?.value;
  const items = OnboardingWorkflow.buildStage1Prerequisites(supplierType);
  const list = document.getElementById('prereq-list');
  if (list) list.innerHTML = items.map(item => `<li>${esc(item)}</li>`).join('');
}

function onSupplierTypeChange() {
  const supplierType = document.getElementById('ob-type')?.value;
  const profile = OnboardingWorkflow.getSupplierProfile(supplierType);

  renderFinancialCriterion();
  applyCriteriaVisibility(supplierType);
  renderPrerequisites();

  // Export licence only applies to suppliers exporting goods themselves.
  const exportLicenceGroup = document.getElementById('ob-export-licence-group');
  if (exportLicenceGroup) {
    exportLicenceGroup.style.display = profile.showExportLicence ? '' : 'none';
  }

  // QMS isn't a meaningful signal for some supplier types.
  const qmsGroup = document.getElementById('ob-qms-group');
  if (qmsGroup) {
    qmsGroup.style.display = profile.showQms ? '' : 'none';
    if (!profile.showQms) {
      document.getElementById('ob-qms-details').style.display = 'none';
    }
  }

  updateOverallScore();
}

// ── Pre-fill from enquiry / existing contact ────────────────────────────

async function loadEnquiry() {
  if (!enquiryId) return;

  const { data: e, error } = await supabaseClient
    .from('supplier_enquiries')
    .select('company_name, contact_name, email, phone, country, website, products_of_interest, hq_address')
    .eq('id', enquiryId)
    .single();

  if (error || !e) return;

  document.getElementById('enquiry-banner').style.display = 'block';
  document.getElementById('enquiry-banner-text').textContent = e.company_name;

  setVal('ob-company',       e.company_name);
  setVal('ob-country',       e.country);
  setVal('ob-website',       e.website);
  setVal('ob-contact-name',  e.contact_name);
  setVal('ob-contact-email', e.email);
  setVal('ob-contact-phone', e.phone);
  // hq_address from the enquiry is free text — drop it into Address Line 1
  // as a starting point; the field can be split into structured fields.
  setVal('ob-address1',      e.hq_address);
  if (e.products_of_interest) {
    setVal('ob-notes', `From enquiry — products / materials: ${e.products_of_interest}`);
  }
}

// Loads an existing contact for resume-draft or re-onboard-rejected flows.
async function loadExistingContact() {
  if (!reonboardId) return;

  const { data: c } = await supabaseClient
    .from('contacts')
    .select(`company_name, country, website, primary_contact_name, email, phone, vat_number,
      company_registration_number, beneficial_owner, supplier_type, address_line_1, address_line_2,
      city, postcode, dispatch_address_line_1, dispatch_address_line_2, dispatch_city, dispatch_postcode,
      dispatch_country, company_phone, export_licence_number, qms_certification, qms_certificate_ref,
      qms_expiry, supplier_reference, notes`)
    .eq('id', reonboardId)
    .single();

  if (!c) return;
  contactId = reonboardId;

  const { data: obRows } = await supabaseClient
    .from('supplier_onboarding')
    .select('id, workflow_stage')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(1);
  const latestOb = obRows?.[0];

  document.getElementById('enquiry-banner').style.display = 'block';
  document.getElementById('enquiry-banner-text').textContent = latestOb?.workflow_stage === 'draft'
    ? `Resuming draft for ${c.company_name}`
    : `Re-onboarding ${c.company_name} (previous onboarding rejected)`;

  if (latestOb?.workflow_stage === 'draft') {
    onboardingId = latestOb.id;
  }

  setVal('ob-company',        c.company_name);
  setVal('ob-registration',   c.company_registration_number);
  setVal('ob-country',        c.country);
  setVal('ob-vat',            c.vat_number);
  setVal('ob-website',        c.website);
  setVal('ob-beneficial',     c.beneficial_owner);
  setVal('ob-contact-name',   c.primary_contact_name);
  setVal('ob-contact-email',  c.email);
  setVal('ob-contact-phone',  c.phone);
  setVal('ob-address1',       c.address_line_1);
  setVal('ob-address2',       c.address_line_2);
  setVal('ob-city',           c.city);
  setVal('ob-postcode',       c.postcode);
  setVal('ob-company-phone',  c.company_phone);
  setVal('ob-export-licence', c.export_licence_number);
  setVal('ob-supplier-ref',   c.supplier_reference);
  setVal('ob-notes',          c.notes);
  setVal('ob-qms-ref',        c.qms_certificate_ref);
  if (c.qms_expiry) setVal('ob-qms-expiry', c.qms_expiry);
  if (c.qms_certification) document.getElementById('ob-qms').value = c.qms_certification;
  if (c.supplier_type) document.getElementById('ob-type').value = c.supplier_type;

  if (c.dispatch_address_line_1 || c.dispatch_city || c.dispatch_postcode || c.dispatch_country) {
    document.getElementById('ob-dispatch-different').checked = true;
    document.getElementById('ob-dispatch-address').style.display = 'flex';
    setVal('ob-dispatch-address1', c.dispatch_address_line_1);
    setVal('ob-dispatch-address2', c.dispatch_address_line_2);
    setVal('ob-dispatch-city',     c.dispatch_city);
    setVal('ob-dispatch-postcode', c.dispatch_postcode);
    setVal('ob-dispatch-country',  c.dispatch_country);
  }
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.value = value;
}

function toggleQmsFields() {
  const qms = document.getElementById('ob-qms')?.value;
  document.getElementById('ob-qms-details').style.display = (qms && qms !== 'none') ? 'flex' : 'none';
}

// Builds the address + dispatch address fields for the contacts payload.
function buildAddressPayload() {
  const dispatchDifferent = document.getElementById('ob-dispatch-different')?.checked;
  return {
    address_line_1: document.getElementById('ob-address1')?.value.trim() || null,
    address_line_2: document.getElementById('ob-address2')?.value.trim() || null,
    city:           document.getElementById('ob-city')?.value.trim()     || null,
    postcode:       document.getElementById('ob-postcode')?.value.trim() || null,
    dispatch_address_line_1: dispatchDifferent ? (document.getElementById('ob-dispatch-address1')?.value.trim() || null) : null,
    dispatch_address_line_2: dispatchDifferent ? (document.getElementById('ob-dispatch-address2')?.value.trim() || null) : null,
    dispatch_city:           dispatchDifferent ? (document.getElementById('ob-dispatch-city')?.value.trim()     || null) : null,
    dispatch_postcode:       dispatchDifferent ? (document.getElementById('ob-dispatch-postcode')?.value.trim() || null) : null,
    dispatch_country:        dispatchDifferent ? (document.getElementById('ob-dispatch-country')?.value.trim()  || null) : null,
  };
}

function buildContactPayload() {
  const supplierType = document.getElementById('ob-type')?.value || null;
  const qms = document.getElementById('ob-qms')?.value || null;
  const qmsHasDetails = qms && qms !== 'none';
  return {
    company_name:                document.getElementById('ob-company')?.value.trim(),
    company_registration_number: document.getElementById('ob-registration')?.value.trim() || null,
    country:                     document.getElementById('ob-country')?.value.trim() || null,
    supplier_type:                supplierType,
    primary_contact_name:        document.getElementById('ob-contact-name')?.value.trim() || null,
    email:                        document.getElementById('ob-contact-email')?.value.trim() || null,
    phone:                        document.getElementById('ob-contact-phone')?.value.trim() || null,
    company_phone:                document.getElementById('ob-company-phone')?.value.trim() || null,
    website:                      document.getElementById('ob-website')?.value.trim() || null,
    vat_number:                   document.getElementById('ob-vat')?.value.trim() || null,
    beneficial_owner:             document.getElementById('ob-beneficial')?.value.trim() || null,
    export_licence_number:        document.getElementById('ob-export-licence')?.value.trim() || null,
    qms_certification:            qms || null,
    qms_certificate_ref:          qmsHasDetails ? (document.getElementById('ob-qms-ref')?.value.trim() || null) : null,
    qms_expiry:                   qmsHasDetails ? (document.getElementById('ob-qms-expiry')?.value || null) : null,
    supplier_reference:           document.getElementById('ob-supplier-ref')?.value.trim() || null,
    notes:                         document.getElementById('ob-notes')?.value.trim() || null,
    approval_status:              'under_review',
    ...buildAddressPayload(),
  };
}

// Inserts a new contact, retrying once with a freshly generated
// supplier_reference if the unique index is violated.
async function insertContact(payload) {
  const contactType = CONTACT_TYPE_MAP[payload.supplier_type] || 'supplier';
  const { data, error } = await supabaseClient
    .from('contacts').insert({ ...payload, type: contactType }).select('id').single();

  if (!error) return data.id;

  if (error.code === '23505') {
    payload.supplier_reference = OnboardingWorkflow.generateSupplierReference();
    document.getElementById('ob-supplier-ref').value = payload.supplier_reference;
    const { data: retryData, error: retryErr } = await supabaseClient
      .from('contacts').insert({ ...payload, type: contactType }).select('id').single();
    if (retryErr) throw new Error('Failed to create supplier record: ' + retryErr.message);
    return retryData.id;
  }

  throw new Error('Failed to create supplier record: ' + error.message);
}

// ── Save Progress & Exit ─────────────────────────────────────────────────

async function submitSaveAndExit() {
  const errEl = document.getElementById('ob-error');
  errEl.style.display = 'none';

  const company = document.getElementById('ob-company')?.value.trim();
  if (!company) {
    errEl.textContent = 'Company Name is required to save progress.';
    errEl.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const btn = document.getElementById('save-exit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const user = await getCurrentUser();
    const payload = buildContactPayload();

    if (!contactId) {
      contactId = await insertContact(payload);
    } else {
      const { error } = await supabaseClient.from('contacts').update(payload).eq('id', contactId);
      if (error) throw new Error('Failed to update supplier record: ' + error.message);
    }

    if (!onboardingId) {
      const { data: onboarding, error: obErr } = await supabaseClient
        .from('supplier_onboarding')
        .insert({ contact_id: contactId, enquiry_id: enquiryId || null, workflow_stage: 'draft', raised_by: user?.id || null })
        .select('id').single();
      if (obErr) throw new Error('Failed to create onboarding record: ' + obErr.message);
      onboardingId = onboarding.id;
    } else {
      await supabaseClient.from('supplier_onboarding')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', onboardingId);
    }

    await OnboardingWorkflow.logEvent(contactId, onboardingId, 'onboarding_draft_saved',
      `Stage 1 progress saved as draft for ${company}.`, {}
    );

    location.href = `detail.html?id=${contactId}`;

  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Save Progress & Exit';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ── Complete Stage 1 ──────────────────────────────────────────────────────

async function submitStage1Complete() {
  const errEl = document.getElementById('ob-error');
  errEl.style.display = 'none';

  const company      = document.getElementById('ob-company')?.value.trim();
  const regNumber    = document.getElementById('ob-registration')?.value.trim();
  const country      = document.getElementById('ob-country')?.value.trim();
  const supplierType = document.getElementById('ob-type')?.value;
  const contactName  = document.getElementById('ob-contact-name')?.value.trim();
  const contactEmail = document.getElementById('ob-contact-email')?.value.trim();
  const qms          = document.getElementById('ob-qms')?.value;
  const profile      = OnboardingWorkflow.getSupplierProfile(supplierType);
  const criteria     = OnboardingWorkflow.getRiskCriteria(supplierType);

  const missing = [];
  if (!company)      missing.push('Company Name');
  if (!regNumber)    missing.push('Registration Number');
  if (!country)      missing.push('Country');
  if (!supplierType) missing.push('Supplier Type');
  if (!contactName)  missing.push('Contact Name');
  if (!contactEmail) missing.push('Email');
  if (!qms && profile.showQms) missing.push('Quality Management System');

  // Sanctions screening
  let sanctionsResult = existingSanctionsScreen?.result || null;
  if (!existingSanctionsScreen) {
    sanctionsResult = document.getElementById('s-result')?.value || null;
    if (!sanctionsResult) missing.push('Sanctions Screening Result');
  }

  // Risk assessment
  const scores = getScores(criteria);
  if (!existingRiskAssessment && scores.some(s => s === null)) {
    missing.push('Preliminary Risk Assessment (all required criteria)');
  }
  const overrideChecked = document.getElementById('override-check')?.checked;
  if (overrideChecked && !document.getElementById('override-reason')?.value.trim()) {
    missing.push('Risk assessment override reason');
  }

  if (missing.length) {
    errEl.textContent = `Please complete: ${missing.join(', ')}.`;
    errEl.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (sanctionsResult === 'confirmed_match') {
    if (!confirm('A confirmed sanctions match will result in this onboarding being rejected. Proceed?')) return;
  }

  const btn = document.getElementById('complete-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const user = await getCurrentUser();
    const payload = buildContactPayload();
    const contactTypeLabel = payload.supplier_type === 'logistics' ? 'logistics provider'
                            : payload.supplier_type === 'packaging' ? 'packaging supplier'
                            : ['service_provider'].includes(payload.supplier_type) ? 'service provider'
                            : 'supplier';

    // ── 1. Upsert contact ────────────────────────────────────────────
    if (!contactId) {
      const contactType = CONTACT_TYPE_MAP[payload.supplier_type] || 'supplier';
      const { data: existing } = await supabaseClient
        .from('contacts').select('id').eq('type', contactType).ilike('company_name', company).limit(1);
      if (existing && existing.length > 0) {
        const proceed = confirm(
          `A ${contactTypeLabel} named "${company}" already exists in the register.\n\nProceed and create a new record anyway? (Click Cancel to go back and check first.)`
        );
        if (!proceed) {
          btn.disabled = false;
          btn.textContent = 'Complete Stage 1 — Ready to Quote';
          return;
        }
      }
      contactId = await insertContact(payload);
    } else {
      const { error } = await supabaseClient.from('contacts').update(payload).eq('id', contactId);
      if (error) throw new Error('Failed to update supplier record: ' + error.message);
    }

    // ── 2. Upsert onboarding record ──────────────────────────────────
    if (!onboardingId) {
      const { data: complianceUsers } = await supabaseClient
        .from('user_roles').select('user_id').eq('role', 'director_compliance').limit(1);
      const vetterUserId = complianceUsers?.[0]?.user_id || null;

      const { data: onboarding, error: obErr } = await supabaseClient
        .from('supplier_onboarding')
        .insert({
          contact_id:          contactId,
          enquiry_id:          enquiryId || null,
          workflow_stage:      'draft',
          raised_by:           user?.id || null,
          vetting_assigned_to: vetterUserId,
        })
        .select('id').single();
      if (obErr) throw new Error('Failed to create onboarding record: ' + obErr.message);
      onboardingId = onboarding.id;

      await OnboardingWorkflow.logEvent(contactId, onboardingId, 'onboarding_created',
        `Onboarding created for ${company} (${contactTypeLabel}) by ${user?.email || 'unknown'}.`,
        { raised_by: user?.id, enquiry_id: enquiryId || null }
      );

      if (enquiryId) {
        await supabaseClient.from('supplier_enquiries').update({
          status: 'converted', converted_to_onboarding_id: onboarding.id,
          reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
        }).eq('id', enquiryId);
        await OnboardingWorkflow.logEvent(contactId, onboardingId, 'enquiry_converted',
          `Enquiry ${enquiryId} converted to onboarding.`, { enquiry_id: enquiryId }
        );
      }
    }

    // ── 3. Sanctions screen ───────────────────────────────────────────
    if (!existingSanctionsScreen) {
      const lists = Array.from(document.querySelectorAll('.list-check:checked')).map(el => el.value);
      const { data: screen, error: sErr } = await supabaseClient.from('sanctions_screens').insert({
        subject_type:           'contact',
        subject_id:             contactId,
        subject_name_snapshot:  document.getElementById('s-name')?.value.trim(),
        screened_at:            document.getElementById('s-date')?.value
                                  ? new Date(document.getElementById('s-date').value).toISOString()
                                  : new Date().toISOString(),
        screened_by:            user?.id,
        lists_screened:         lists,
        tool_used:              document.getElementById('s-tool')?.value.trim() || null,
        result:                 sanctionsResult,
        match_resolution_notes: document.getElementById('s-notes')?.value.trim() || null,
      }).select('id').single();
      if (sErr) throw new Error('Failed to save sanctions screen: ' + sErr.message);

      await supabaseClient.from('contacts').update({
        last_sanctions_screened_at: new Date().toISOString(),
        last_sanctions_result:      sanctionsResult,
      }).eq('id', contactId);

      await OnboardingWorkflow.logEvent(contactId, onboardingId, 'sanctions_linked',
        `Sanctions screen recorded: result = ${sanctionsResult}.`, { screen_id: screen.id }
      );
    }

    // ── 4. Preliminary risk assessment ────────────────────────────────
    let riskCat = existingRiskAssessment?.risk_category || null;
    if (!existingRiskAssessment) {
      const overall = OnboardingWorkflow.computeOverall(scores, criteria);
      const isOverride = overrideChecked || false;
      riskCat = isOverride
        ? (document.getElementById('override-category')?.value || OnboardingWorkflow.riskCategory(overall, scores))
        : OnboardingWorkflow.riskCategory(overall, scores);
      const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1);
      const notes = criteria.map(c => document.getElementById(`notes-${c}`)?.value.trim() || null);

      const { error: raErr } = await supabaseClient.from('supplier_risk_assessment').insert({
        supplier_id:                    contactId,
        onboarding_id:                  onboardingId,
        ...OnboardingWorkflow.buildRiskScorePayload(criteria, scores, notes),
        overall_score:                  overall,
        risk_category:                  riskCat,
        overall_notes:                  document.getElementById('overall-notes')?.value.trim()    || null,
        risk_category_override:         isOverride,
        risk_category_override_reason:  isOverride ? (document.getElementById('override-reason')?.value.trim() || null) : null,
        assessed_by:                    user?.id,
        assessment_date:                new Date().toISOString(),
        next_assessment_due:            nextYear.toISOString().split('T')[0],
      });
      if (raErr) throw new Error('Failed to save risk assessment: ' + raErr.message);

      await supabaseClient.from('supplier_onboarding')
        .update({ risk_level: riskCat, updated_at: new Date().toISOString() })
        .eq('id', onboardingId);

      await OnboardingWorkflow.logEvent(contactId, onboardingId, 'risk_assessment_saved',
        `Preliminary risk assessment completed. Overall score: ${overall?.toFixed(2)} → ${riskCat} risk.${isOverride ? ' (Category overridden)' : ''}`,
        { overall_score: overall, risk_category: riskCat, override: isOverride }
      );
    }

    // ── 5. Confirmed sanctions match → reject immediately ─────────────
    if (sanctionsResult === 'confirmed_match') {
      await OnboardingWorkflow.rejectOnboarding(onboardingId, 'stage1_complete',
        'Confirmed sanctions match identified during Stage 1 screening.');
      location.href = `detail.html?id=${contactId}`;
      return;
    }

    // ── 6. Advance to stage1_complete ─────────────────────────────────
    const result = await OnboardingWorkflow.advanceStage(onboardingId, 'stage1_complete');
    if (!result.ok) {
      errEl.innerHTML = '<strong>Saved, but Stage 1 cannot be marked complete yet:</strong>' + OnboardingWorkflow.renderBlockers(result.blockers);
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Complete Stage 1 — Ready to Quote';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    location.href = `detail.html?id=${contactId}&onboarding_new=1`;

  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Complete Stage 1 — Ready to Quote';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ── Init ──────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';

  renderSanctionsListLinks();

  document.getElementById('save-exit-btn').addEventListener('click', submitSaveAndExit);
  document.getElementById('complete-btn').addEventListener('click', submitStage1Complete);
  document.getElementById('ob-type').addEventListener('change', onSupplierTypeChange);
  document.getElementById('ob-qms').addEventListener('change', toggleQmsFields);

  if (enquiryId)   await loadEnquiry();
  if (reonboardId) await loadExistingContact();

  if (!document.getElementById('ob-supplier-ref').value) {
    document.getElementById('ob-supplier-ref').value = OnboardingWorkflow.generateSupplierReference();
  }

  toggleQmsFields();
  onSupplierTypeChange();

  await loadSanctionsSection();

  if (onboardingId) {
    const { data: ra } = await supabaseClient
      .from('supplier_risk_assessment').select('*').eq('onboarding_id', onboardingId).maybeSingle();
    existingRiskAssessment = ra || null;
    if (existingRiskAssessment) prefillRiskAssessment(existingRiskAssessment);
  }
})();
