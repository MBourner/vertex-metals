/**
 * Vertex Metals Portal — Stage 2 (Pre-Trade Vetting)
 * Handles portal/suppliers/pre-trade.html
 *
 * For full-diligence suppliers (manufacturing / materials_commodities), reviews
 * the Stage 1 sanctions screen and preliminary risk assessment, re-screening/
 * updating as needed. For all suppliers, captures ESG details,
 * bank details + verification, generates and tracks the Terms of Business,
 * and records the vetting recommendation and final decision.
 *
 * On load, if workflow_stage === 'stage1_complete', advances to 'pending_stage2'.
 * "Save Progress & Exit" pauses to 'awaiting_supplier_info'. "Complete Stage 2"
 * advances to 'stage2_complete' once all gates pass.
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

// ── State ────────────────────────────────────────────────────────────────

let contact = null;
let onboarding = null;
let isFullDiligence = false;
let riskAssessment = null;
let bankEditMode = false;

const SANCTIONS_LISTS = [
  { name: 'UK Sanctions List', url: 'https://search-uk-sanctions-list.service.gov.uk/' },
  { name: 'UN',                url: 'https://www.un.org/securitycouncil/content/un-sc-consolidated-list' },
  { name: 'EU',                url: 'https://www.sanctionsmap.eu/#/main' },
];

// ── Icon helpers ─────────────────────────────────────────────────────────

function passIcon() {
  return `<div class="check-icon pass">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
  </div>`;
}
function failIcon() {
  return `<div class="check-icon fail">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </div>`;
}
function warnIcon() {
  return `<div class="check-icon warn">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  </div>`;
}

// ── Header: progress bar + stage badge ──────────────────────────────────

function renderHeader() {
  document.getElementById('progress-bar').innerHTML = OnboardingWorkflow.renderProgressSteps(onboarding.workflow_stage);

  const stageBadge = OnboardingWorkflow.stageBadgeClass(onboarding.workflow_stage);
  const stageText  = OnboardingWorkflow.stageLabel(onboarding.workflow_stage);
  let html = `<span class="badge ${stageBadge}">${esc(stageText)}</span>`;
  if (onboarding.workflow_stage === 'awaiting_supplier_info') {
    html += ` <button type="button" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border);margin-left:var(--space-2)" id="resume-btn">Resume Vetting</button>`;
  }
  document.getElementById('stage-badge').innerHTML = html;

  document.getElementById('resume-btn')?.addEventListener('click', async () => {
    const result = await OnboardingWorkflow.resumeFromAwaitingInfo(onboardingId);
    if (result.ok) {
      onboarding.workflow_stage = 'pending_stage2';
      renderHeader();
    }
  });
}

// ── Sanctions Review (full-diligence only) ─────────────────────────────

async function loadSanctionsReview() {
  const el      = document.getElementById('sanctions-review-section');
  const badgeEl = document.getElementById('sanctions-review-badge');

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  const { data } = await supabaseClient
    .from('sanctions_screens')
    .select('id, screened_at, lists_screened, tool_used, result, match_resolution_notes')
    .eq('subject_id', contact.id)
    .order('screened_at', { ascending: false })
    .limit(1);

  const latest = data?.[0] || null;
  const isCurrent = latest && new Date(latest.screened_at) >= cutoff;
  const RESULT_CLASS = { clear:'badge-success', potential_match:'badge-warning', confirmed_match:'badge-danger' };

  if (!latest) {
    badgeEl.innerHTML = '<span class="badge badge-danger">No screen on file</span>';
    el.innerHTML = `
      <div class="check-item">
        ${failIcon()}
        <div style="flex:1"><p style="font-size:var(--text-sm);margin:0">No sanctions screening record exists for this supplier.</p></div>
      </div>` + buildRescreenForm();
    wireRescreenForm();
    return;
  }

  const age = Math.floor((Date.now() - new Date(latest.screened_at)) / 86400000);

  if (!isCurrent) badgeEl.innerHTML = '<span class="badge badge-warning">Screen overdue</span>';
  else if (latest.result === 'confirmed_match') badgeEl.innerHTML = '<span class="badge badge-danger">Confirmed match</span>';
  else badgeEl.innerHTML = '<span class="badge badge-success">Current</span>';

  const gateOk = isCurrent && latest.result !== 'confirmed_match';
  const icon = gateOk ? passIcon() : warnIcon();

  el.innerHTML = `
    <div class="check-item" style="background:${gateOk ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)'}">
      ${icon}
      <div style="flex:1">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-3);font-size:var(--text-sm)">
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Date</div>${fmtDate(latest.screened_at)} (${age}d ago)</div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Result</div><span class="badge ${RESULT_CLASS[latest.result]||'badge-neutral'}">${esc(latest.result?.replace('_',' '))}</span></div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Lists</div>${(latest.lists_screened||[]).join(', ')||'—'}</div>
          ${latest.tool_used ? `<div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Tool</div>${esc(latest.tool_used)}</div>` : ''}
        </div>
        ${latest.match_resolution_notes ? `<p style="font-size:var(--text-sm);color:var(--color-text-muted);margin:var(--space-2) 0 0">${esc(latest.match_resolution_notes)}</p>` : ''}
      </div>
    </div>
    ${!isCurrent ? `<p style="font-size:var(--text-sm);color:#d97706;margin:var(--space-3) 0 0">This screen is more than 12 months old. A new screen is required before Stage 2 can be completed.</p>${buildRescreenForm()}` : ''}
    ${latest.result === 'confirmed_match' ? `<p style="font-size:var(--text-sm);color:var(--color-danger);margin:var(--space-3) 0 0">A confirmed sanctions match was recorded. This onboarding cannot proceed without re-screening and documented resolution.</p>${isCurrent ? buildRescreenForm() : ''}` : ''}`;

  wireRescreenForm();
}

function buildRescreenForm() {
  const today = new Date().toISOString().split('T')[0];
  return `
    <div id="rescreen-form" style="margin-top:var(--space-4);padding:var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-sm);display:flex;flex-direction:column;gap:var(--space-4)">
      <div style="font-size:var(--text-sm);font-weight:600">Record New Sanctions Screen</div>
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-3)">
        ${SANCTIONS_LISTS.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)">${esc(l.name)} →</a>`).join('')}
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="rs-name">Subject Name Screened</label>
          <input type="text" class="form-input" id="rs-name" value="${esc(contact.company_name)}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="rs-date">Screening Date</label>
          <input type="date" class="form-input" id="rs-date" value="${today}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Lists Screened</label>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-4)">
          ${SANCTIONS_LISTS.map(l =>
            `<label style="display:flex;gap:var(--space-2);align-items:center;font-size:var(--text-sm);cursor:pointer">
              <input type="checkbox" class="rs-list-check" value="${esc(l.name)}" style="accent-color:var(--color-accent)" checked /> ${esc(l.name)}
            </label>`).join('')}
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="rs-tool">Screening Tool / Source</label>
          <input type="text" class="form-input" id="rs-tool" placeholder="e.g. Dow Jones, ComplyAdvantage, manual" />
        </div>
        <div class="form-group">
          <label class="form-label" for="rs-result">Result <span class="required">*</span></label>
          <select class="form-select" id="rs-result">
            <option value="">Select result…</option>
            <option value="clear">Clear — no matches</option>
            <option value="potential_match">Potential match — investigated and cleared</option>
            <option value="confirmed_match">Confirmed match</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="rs-notes">Notes / Match Resolution</label>
        <textarea class="form-textarea" id="rs-notes" rows="2" placeholder="Any potential matches and how they were resolved…"></textarea>
      </div>
      <div id="rs-error" style="display:none;color:var(--color-danger);font-size:var(--text-sm)"></div>
      <div><button type="button" class="btn btn-primary btn-sm" id="rs-submit-btn">Save Sanctions Screen</button></div>
    </div>`;
}

function wireRescreenForm() {
  document.getElementById('rs-submit-btn')?.addEventListener('click', submitRescreen);
}

async function submitRescreen() {
  const errEl = document.getElementById('rs-error');
  errEl.style.display = 'none';

  const result = document.getElementById('rs-result')?.value;
  if (!result) {
    errEl.textContent = 'Please select a result.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('rs-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const user = await getCurrentUser();
  const lists = Array.from(document.querySelectorAll('.rs-list-check:checked')).map(el => el.value);

  const { data: screen, error } = await supabaseClient.from('sanctions_screens').insert({
    subject_type:           'contact',
    subject_id:             contact.id,
    subject_name_snapshot:  document.getElementById('rs-name')?.value.trim(),
    screened_at:            document.getElementById('rs-date')?.value
                              ? new Date(document.getElementById('rs-date').value).toISOString()
                              : new Date().toISOString(),
    screened_by:            user?.id,
    lists_screened:         lists,
    tool_used:              document.getElementById('rs-tool')?.value.trim() || null,
    result,
    match_resolution_notes: document.getElementById('rs-notes')?.value.trim() || null,
  }).select('id').single();

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Save Sanctions Screen';
    return;
  }

  await supabaseClient.from('contacts').update({
    last_sanctions_screened_at: new Date().toISOString(),
    last_sanctions_result:      result,
  }).eq('id', contact.id);

  await OnboardingWorkflow.logEvent(contact.id, onboardingId, 'sanctions_linked',
    `Sanctions re-screen recorded during Stage 2: result = ${result}.`, { screen_id: screen.id }
  );

  if (result === 'confirmed_match') {
    if (confirm('A confirmed sanctions match will result in this onboarding being rejected. Proceed?')) {
      await OnboardingWorkflow.rejectOnboarding(onboardingId, onboarding.workflow_stage,
        'Confirmed sanctions match identified during Stage 2 re-screening.');
      location.href = `detail.html?id=${contact.id}`;
      return;
    }
  }

  await loadSanctionsReview();
}

// ── Risk Assessment Review (full-diligence only) ────────────────────────
//
// The applicable criteria and their weighting in the overall score come
// from OnboardingWorkflow.SUPPLIER_TYPE_PROFILES (js/portal/supplier-
// onboarding.js) — both full-diligence types currently score all five.

function getScores(criteria) {
  return criteria.map(c => {
    const val = document.getElementById(`score-${c}`)?.value;
    return val ? parseFloat(val) : null;
  });
}

function updateOverallScore() {
  const criteria = OnboardingWorkflow.getRiskCriteria(contact.supplier_type);
  const scores = getScores(criteria);
  criteria.forEach((c, i) => {
    const disp = document.getElementById(`score-display-${c}`);
    if (disp) disp.textContent = scores[i] !== null ? scores[i] : '—';
  });

  const overall = OnboardingWorkflow.computeOverall(scores, criteria);
  const cat = OnboardingWorkflow.riskCategory(overall, scores);
  const baseCat = OnboardingWorkflow.riskCategoryFromScore(overall);

  const scoreVal    = document.getElementById('overall-score-value');
  const scoreBadge  = document.getElementById('overall-risk-badge');
  const badgeEl     = document.getElementById('overall-score-badge');
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
    if (notes) {
      const el = document.getElementById(`notes-${c}`);
      if (el) el.value = notes;
    }
  });
  if (ra.overall_notes) document.getElementById('overall-notes').value = ra.overall_notes;
  if (ra.risk_category_override) {
    const chk = document.getElementById('override-check');
    if (chk) chk.checked = true;
    document.getElementById('override-reason-group').style.display = 'block';
    document.getElementById('override-category-group').style.display = 'block';
    if (ra.risk_category_override_reason) document.getElementById('override-reason').value = ra.risk_category_override_reason;
    const cat = document.getElementById('override-category');
    if (cat && ra.risk_category) cat.value = ra.risk_category;
  }
  updateOverallScore();
}

async function loadRiskReview() {
  const { data } = await supabaseClient
    .from('supplier_risk_assessment').select('*').eq('onboarding_id', onboardingId).maybeSingle();
  riskAssessment = data || null;
  if (riskAssessment) prefillRiskAssessment(riskAssessment);
  updateRiskReviewStatus();
}

function updateRiskReviewStatus() {
  const statusEl = document.getElementById('risk-review-status');
  const btn = document.getElementById('risk-review-btn');
  if (!riskAssessment) {
    statusEl.textContent = 'No preliminary risk assessment found for this onboarding.';
    if (btn) btn.disabled = true;
    return;
  }
  if (riskAssessment.reviewed_at) {
    statusEl.innerHTML = `<span class="badge badge-success">Reviewed</span> Reviewed ${fmtDate(riskAssessment.reviewed_at)}.`;
    if (btn) btn.textContent = 'Update Reviewed Risk Assessment';
  } else {
    statusEl.textContent = 'Preliminary assessment from Stage 1 — not yet reviewed for Stage 2.';
    if (btn) btn.textContent = 'Mark Risk Assessment Reviewed';
  }
}

async function submitRiskReview() {
  if (!riskAssessment) return;

  const criteria = OnboardingWorkflow.getRiskCriteria(contact.supplier_type);
  const scores = getScores(criteria);
  if (scores.some(s => s === null)) {
    alert('Please score all required criteria before marking the assessment reviewed.');
    return;
  }
  const overrideChecked = document.getElementById('override-check')?.checked;
  if (overrideChecked && !document.getElementById('override-reason')?.value.trim()) {
    alert('Please provide an override reason.');
    return;
  }

  const btn = document.getElementById('risk-review-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const user = await getCurrentUser();
  const overall = OnboardingWorkflow.computeOverall(scores, criteria);
  const riskCat = overrideChecked
    ? (document.getElementById('override-category')?.value || OnboardingWorkflow.riskCategory(overall, scores))
    : OnboardingWorkflow.riskCategory(overall, scores);
  const notes = criteria.map(c => document.getElementById(`notes-${c}`)?.value.trim() || null);

  const payload = {
    ...OnboardingWorkflow.buildRiskScorePayload(criteria, scores, notes),
    overall_score:                 overall,
    risk_category:                 riskCat,
    overall_notes:                 document.getElementById('overall-notes')?.value.trim()    || null,
    risk_category_override:        !!overrideChecked,
    risk_category_override_reason: overrideChecked ? (document.getElementById('override-reason')?.value.trim() || null) : null,
    reviewed_at:                   new Date().toISOString(),
    reviewed_by:                   user?.id,
  };

  const { error } = await supabaseClient.from('supplier_risk_assessment').update(payload).eq('id', riskAssessment.id);
  if (error) {
    alert('Failed to save risk assessment: ' + error.message);
    btn.disabled = false;
    updateRiskReviewStatus();
    return;
  }

  await supabaseClient.from('supplier_onboarding')
    .update({ risk_level: riskCat, updated_at: new Date().toISOString() })
    .eq('id', onboardingId);

  await OnboardingWorkflow.logEvent(contact.id, onboardingId, 'risk_assessment_saved',
    `Risk assessment reviewed at Stage 2. Overall score: ${overall?.toFixed(2)} → ${riskCat} risk.${overrideChecked ? ' (Category overridden)' : ''}`,
    { overall_score: overall, risk_category: riskCat, override: !!overrideChecked, reviewed: true }
  );

  riskAssessment = { ...riskAssessment, ...payload };
  onboarding.risk_level = riskCat;
  btn.disabled = false;
  updateRiskReviewStatus();
}

// ── ESG / Environmental ─────────────────────────────────────────────────

function loadEsg() {
  document.getElementById('esg-policy').checked = !!contact.esg_policy_in_place;
  document.getElementById('esg-carbon-reporting').checked = !!contact.carbon_reporting_available;
  if (contact.esg_notes) document.getElementById('esg-notes').value = contact.esg_notes;
  if (contact.environmental_permit_ref) document.getElementById('esg-permit-ref').value = contact.environmental_permit_ref;
  if (contact.environmental_permit_expiry) document.getElementById('esg-permit-expiry').value = contact.environmental_permit_expiry;
}

async function submitEsg() {
  const btn = document.getElementById('esg-save-btn');
  const statusEl = document.getElementById('esg-status');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const payload = {
    esg_policy_in_place:         document.getElementById('esg-policy').checked,
    carbon_reporting_available:  document.getElementById('esg-carbon-reporting').checked,
    esg_notes:                   document.getElementById('esg-notes').value.trim() || null,
    environmental_permit_ref:    document.getElementById('esg-permit-ref').value.trim() || null,
    environmental_permit_expiry: document.getElementById('esg-permit-expiry').value || null,
  };

  const { error } = await supabaseClient.from('contacts').update(payload).eq('id', contact.id);

  if (error) {
    statusEl.style.color = 'var(--color-danger)';
    statusEl.textContent = error.message;
  } else {
    Object.assign(contact, payload);
    statusEl.style.color = 'var(--color-success)';
    statusEl.textContent = 'Saved.';
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
  }

  btn.disabled = false;
  btn.textContent = 'Save ESG Details';
}

// ── Bank Details ─────────────────────────────────────────────────────────

function maskAccountNumber(v) {
  if (!v) return '—';
  const clean = v.replace(/\s+/g, '');
  return clean.length <= 4 ? clean : '**** '.repeat(Math.floor((clean.length - 4) / 4)) + clean.slice(-4);
}

function renderBankSection() {
  const el      = document.getElementById('bank-section');
  const badgeEl = document.getElementById('bank-status-badge');
  const hasBank = contact.bank_account_number || contact.bank_iban;

  if (hasBank && !bankEditMode) {
    badgeEl.innerHTML = contact.bank_account_verified_in_name
      ? '<span class="badge badge-success">On file, verified</span>'
      : '<span class="badge badge-warning">On file, unverified</span>';

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--space-4);font-size:var(--text-sm)">
        <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Account Name</div>${esc(contact.bank_account_name || '—')}</div>
        <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Bank Name</div>${esc(contact.bank_name || '—')}</div>
        <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Account Number</div>
          <span id="bank-acct-display" data-revealed="0">${esc(maskAccountNumber(contact.bank_account_number))}</span>
          ${contact.bank_account_number ? `<button type="button" class="btn btn-ghost btn-sm" id="bank-acct-toggle" style="border:none;padding:0 0 0 4px">Show</button>` : ''}
        </div>
        <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">IBAN</div>
          <span id="bank-iban-display" data-revealed="0">${esc(maskAccountNumber(contact.bank_iban))}</span>
          ${contact.bank_iban ? `<button type="button" class="btn btn-ghost btn-sm" id="bank-iban-toggle" style="border:none;padding:0 0 0 4px">Show</button>` : ''}
        </div>
        <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Sort Code / Routing Number</div>${esc(contact.bank_sort_code || '—')}</div>
        <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">SWIFT / BIC</div>${esc(contact.bank_swift_bic || '—')}</div>
      </div>
      <div style="margin-top:var(--space-4);font-size:var(--text-sm)">
        ${contact.bank_account_verified_in_name
          ? '<span style="color:var(--color-success)">✓ Confirmed held in registered company name</span>'
          : '<span style="color:var(--color-danger)">Not yet confirmed as held in registered company name</span>'}
      </div>
      <div style="margin-top:var(--space-4)">
        <button type="button" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)" id="bank-edit-btn">Edit Bank Details</button>
      </div>`;

    document.getElementById('bank-edit-btn')?.addEventListener('click', () => { bankEditMode = true; renderBankSection(); });
    document.getElementById('bank-acct-toggle')?.addEventListener('click', (e) => {
      const span = document.getElementById('bank-acct-display');
      const revealed = span.dataset.revealed === '1';
      span.textContent = revealed ? maskAccountNumber(contact.bank_account_number) : contact.bank_account_number;
      span.dataset.revealed = revealed ? '0' : '1';
      e.target.textContent = revealed ? 'Show' : 'Hide';
    });
    document.getElementById('bank-iban-toggle')?.addEventListener('click', (e) => {
      const span = document.getElementById('bank-iban-display');
      const revealed = span.dataset.revealed === '1';
      span.textContent = revealed ? maskAccountNumber(contact.bank_iban) : contact.bank_iban;
      span.dataset.revealed = revealed ? '0' : '1';
      e.target.textContent = revealed ? 'Show' : 'Hide';
    });
    return;
  }

  badgeEl.innerHTML = '<span class="badge badge-danger">Required</span>';
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-4)">
      <div class="form-grid">
        <div class="form-group"><label class="form-label" for="bank-account-name">Account Name</label><input type="text" class="form-input" id="bank-account-name" value="${esc(contact.bank_account_name || '')}" /></div>
        <div class="form-group"><label class="form-label" for="bank-name">Bank Name</label><input type="text" class="form-input" id="bank-name" value="${esc(contact.bank_name || '')}" /></div>
        <div class="form-group"><label class="form-label" for="bank-account-number">Account Number</label><input type="text" class="form-input" id="bank-account-number" value="${esc(contact.bank_account_number || '')}" /></div>
        <div class="form-group"><label class="form-label" for="bank-sort-code">Sort Code / Routing Number</label><input type="text" class="form-input" id="bank-sort-code" value="${esc(contact.bank_sort_code || '')}" /></div>
        <div class="form-group"><label class="form-label" for="bank-iban">IBAN</label><input type="text" class="form-input" id="bank-iban" value="${esc(contact.bank_iban || '')}" /></div>
        <div class="form-group"><label class="form-label" for="bank-swift-bic">SWIFT / BIC</label><input type="text" class="form-input" id="bank-swift-bic" value="${esc(contact.bank_swift_bic || '')}" /></div>
      </div>
      <label style="display:flex;gap:var(--space-2);align-items:center;cursor:pointer;font-size:var(--text-sm)">
        <input type="checkbox" id="bank-verified" style="accent-color:var(--color-accent)" ${contact.bank_account_verified_in_name ? 'checked' : ''} />
        I confirm this bank account is held in the exact name of the registered company above.
      </label>
      <div id="bank-status" style="font-size:var(--text-sm)"></div>
      <div style="display:flex;gap:var(--space-3)">
        <button type="button" class="btn btn-primary btn-sm" id="bank-save-btn">Save Bank Details</button>
        ${hasBank ? '<button type="button" class="btn btn-ghost btn-sm" id="bank-cancel-btn">Cancel</button>' : ''}
      </div>
    </div>`;

  document.getElementById('bank-save-btn')?.addEventListener('click', submitBank);
  document.getElementById('bank-cancel-btn')?.addEventListener('click', () => { bankEditMode = false; renderBankSection(); });
}

async function submitBank() {
  const btn = document.getElementById('bank-save-btn');
  const statusEl = document.getElementById('bank-status');

  const payload = {
    bank_account_name:             document.getElementById('bank-account-name').value.trim() || null,
    bank_name:                      document.getElementById('bank-name').value.trim() || null,
    bank_account_number:           document.getElementById('bank-account-number').value.trim() || null,
    bank_sort_code:                 document.getElementById('bank-sort-code').value.trim() || null,
    bank_iban:                      document.getElementById('bank-iban').value.trim() || null,
    bank_swift_bic:                 document.getElementById('bank-swift-bic').value.trim() || null,
    bank_account_verified_in_name:  document.getElementById('bank-verified').checked,
  };

  if (!payload.bank_account_number && !payload.bank_iban) {
    statusEl.style.color = 'var(--color-danger)';
    statusEl.textContent = 'Either an account number or IBAN is required.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving…';

  const { error } = await supabaseClient.from('contacts').update(payload).eq('id', contact.id);
  if (error) {
    statusEl.style.color = 'var(--color-danger)';
    statusEl.textContent = error.message;
    btn.disabled = false;
    btn.textContent = 'Save Bank Details';
    return;
  }

  Object.assign(contact, payload);
  bankEditMode = false;
  renderBankSection();
}

// ── Terms of Business ───────────────────────────────────────────────────

function renderTobSection() {
  const badgeEl = document.getElementById('tob-status-badge');
  const STATUS_CLASS = { not_generated:'badge-neutral', generated:'badge-info', sent:'badge-warning', confirmed:'badge-success' };
  badgeEl.innerHTML = `<span class="badge ${STATUS_CLASS[onboarding.tob_status]||'badge-neutral'}">${esc(onboarding.tob_status?.replace('_',' '))}</span>`;

  document.getElementById('tob-sent-btn').disabled = onboarding.tob_status === 'not_generated';
  document.getElementById('tob-confirmed-btn').disabled = !(onboarding.tob_status === 'sent' || onboarding.tob_status === 'confirmed');

  const parts = [];
  if (onboarding.tob_generated_at) parts.push(`Generated ${fmtDate(onboarding.tob_generated_at)}`);
  if (onboarding.tob_sent_at)      parts.push(`Sent ${fmtDate(onboarding.tob_sent_at)}`);
  if (onboarding.tob_confirmed_at) parts.push(`Confirmed ${fmtDate(onboarding.tob_confirmed_at)}`);
  document.getElementById('tob-timestamps').textContent = parts.join(' · ');
}

async function generateTob() {
  const html = OnboardingWorkflow.buildTobHtml(contact, onboarding);
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();

  if (onboarding.tob_status === 'not_generated') {
    const result = await OnboardingWorkflow.markTobGenerated(onboardingId, contact.id);
    if (result.ok) {
      onboarding.tob_status = 'generated';
      onboarding.tob_generated_at = new Date().toISOString();
      renderTobSection();
    }
  }
}

async function markTobSentHandler() {
  const result = await OnboardingWorkflow.markTobSent(onboardingId, contact.id);
  if (result.ok) {
    onboarding.tob_status = 'sent';
    onboarding.tob_sent_at = new Date().toISOString();
    renderTobSection();
  }
}

async function markTobConfirmedHandler() {
  const result = await OnboardingWorkflow.markTobConfirmed(onboardingId, contact.id);
  if (result.ok) {
    onboarding.tob_status = 'confirmed';
    onboarding.tob_confirmed_at = new Date().toISOString();
    renderTobSection();
  }
}

// ── Recommendation / Decision ────────────────────────────────────────────

function renderRecDecPanels() {
  const roles = PortalRoles.getRoles();
  const isCompliance = roles.includes('director_compliance');
  const isCommercial = roles.includes('director_commercial');

  const recPanel     = document.getElementById('recommendation-panel');
  const decPanel     = document.getElementById('decision-panel');
  const summaryPanel = document.getElementById('rec-dec-summary-panel');

  recPanel.style.display = (isCompliance && !onboarding.recommendation) ? '' : 'none';
  decPanel.style.display = (isCommercial && onboarding.recommendation && !onboarding.decision) ? '' : 'none';

  if (decPanel.style.display !== 'none') {
    document.getElementById('decision-rec-note').innerHTML =
      `<div style="padding:var(--space-3);background:var(--color-surface);border-radius:var(--radius-sm);font-size:var(--text-sm)">Compliance recommendation: <strong>${esc(onboarding.recommendation.replace(/_/g,' '))}</strong></div>`;
  }

  if (onboarding.recommendation || onboarding.decision) {
    summaryPanel.style.display = '';
    document.getElementById('rec-dec-summary').innerHTML = `
      ${onboarding.recommendation ? `<div><div style="color:var(--color-text-muted);font-size:var(--text-xs);margin-bottom:2px;text-transform:uppercase;font-weight:600;letter-spacing:.08em">Compliance Recommendation</div>
        <span class="badge ${onboarding.recommendation === 'reject' ? 'badge-danger' : onboarding.recommendation === 'approve_with_conditions' ? 'badge-warning' : 'badge-success'}">${esc(onboarding.recommendation.replace(/_/g,' '))}</span>
        ${onboarding.recommendation_rationale ? `<p style="margin:var(--space-2) 0 0;font-size:var(--text-sm)">${esc(onboarding.recommendation_rationale)}</p>` : ''}
        ${onboarding.conditions_summary ? `<p style="margin:var(--space-2) 0 0;font-size:var(--text-xs);color:var(--color-text-muted);white-space:pre-line">${esc(onboarding.conditions_summary)}</p>` : ''}
      </div>` : ''}
      ${onboarding.decision ? `<div><div style="color:var(--color-text-muted);font-size:var(--text-xs);margin-bottom:2px;text-transform:uppercase;font-weight:600;letter-spacing:.08em">Final Decision</div>
        <span class="badge ${onboarding.decision === 'rejected' ? 'badge-danger' : onboarding.decision === 'approved_with_conditions' ? 'badge-warning' : 'badge-success'}">${esc(onboarding.decision.replace(/_/g,' '))}</span>
        ${onboarding.decision_justification ? `<p style="margin:var(--space-2) 0 0;font-size:var(--text-sm)">${esc(onboarding.decision_justification)}</p>` : ''}
      </div>` : ''}`;
  } else {
    summaryPanel.style.display = 'none';
  }
}

async function submitRecommendation() {
  const decision   = document.getElementById('rec-decision')?.value;
  const rationale  = document.getElementById('rec-rationale')?.value.trim();
  const conditions = document.getElementById('rec-conditions')?.value.trim();
  const errEl      = document.getElementById('rec-error');
  errEl.style.display = 'none';

  if (!decision || !rationale) {
    errEl.textContent = 'Recommendation and rationale are required.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('rec-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const user = await getCurrentUser();
  const payload = {
    recommendation:              decision,
    recommendation_rationale:    rationale,
    conditions_summary:          conditions || null,
    recommendation_submitted_at: new Date().toISOString(),
    updated_at:                  new Date().toISOString(),
  };

  const { error } = await supabaseClient.from('supplier_onboarding').update(payload).eq('id', onboardingId);
  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Submit Recommendation';
    return;
  }

  await supabaseClient.from('supplier_approvals').insert({
    supplier_id:    contact.id,
    onboarding_id:  onboardingId,
    approval_stage: 'recommendation',
    approver_id:    user?.id,
    approver_role:  'director_compliance',
    decision,
    justification:  rationale,
    conditions:     conditions || null,
  });

  await OnboardingWorkflow.logEvent(contact.id, onboardingId, 'recommendation_submitted',
    `Compliance recommendation submitted: "${decision.replace(/_/g,' ')}". Rationale: ${rationale.slice(0,120)}${rationale.length>120?'…':''}`,
    { recommendation: decision }
  );

  Object.assign(onboarding, payload);
  renderRecDecPanels();
}

async function submitDecision() {
  const decision      = document.getElementById('dec-decision')?.value;
  const justification = document.getElementById('dec-justification')?.value.trim();
  const errEl         = document.getElementById('dec-error');
  errEl.style.display = 'none';

  if (!decision || !justification) {
    errEl.textContent = 'Decision and justification are required.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('dec-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const user = await getCurrentUser();
  const payload = {
    decision,
    decision_justification: justification,
    decision_by:            user?.id,
    decision_at:            new Date().toISOString(),
    updated_at:             new Date().toISOString(),
  };

  const { error } = await supabaseClient.from('supplier_onboarding').update(payload).eq('id', onboardingId);
  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Record Decision';
    return;
  }

  await supabaseClient.from('supplier_approvals').insert({
    supplier_id:    contact.id,
    onboarding_id:  onboardingId,
    approval_stage: 'final_approval',
    approver_id:    user?.id,
    approver_role:  'director_commercial',
    decision,
    justification,
  });

  await OnboardingWorkflow.logEvent(contact.id, onboardingId,
    decision === 'rejected' ? 'rejection_decision' : 'approval_decision',
    `Final decision recorded by Director (Commercial): "${decision.replace(/_/g,' ')}". ${justification.slice(0,120)}${justification.length>120?'…':''}`,
    { decision }
  );

  Object.assign(onboarding, payload);

  if (decision === 'rejected') {
    await OnboardingWorkflow.rejectOnboarding(onboardingId, onboarding.workflow_stage, justification);
    location.href = `detail.html?id=${contact.id}`;
    return;
  }

  renderRecDecPanels();
}

// ── Save Progress & Exit / Complete Stage 2 ──────────────────────────────

async function submitSaveAndExit() {
  const errEl = document.getElementById('pt-error');
  errEl.style.display = 'none';

  const btn = document.getElementById('save-exit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const reason = prompt('Optional: note why Stage 2 is being paused (e.g. awaiting supplier documents). Leave blank to skip.');

  const { error } = await supabaseClient.from('supplier_onboarding')
    .update({ workflow_stage: 'awaiting_supplier_info', updated_at: new Date().toISOString() })
    .eq('id', onboardingId);

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Save Progress & Exit';
    return;
  }

  await OnboardingWorkflow.logEvent(contact.id, onboardingId, 'stage_advanced',
    `Stage 2 paused — awaiting supplier information.${reason ? ' ' + reason : ''}`,
    { to_stage: 'awaiting_supplier_info' }
  );

  location.href = `detail.html?id=${contact.id}`;
}

async function submitCompleteStage2() {
  const errEl = document.getElementById('pt-error');
  errEl.style.display = 'none';

  const btn = document.getElementById('complete-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const result = await OnboardingWorkflow.advanceStage(onboardingId, 'stage2_complete');
  if (!result.ok) {
    errEl.innerHTML = '<strong>Cannot complete Stage 2 yet:</strong>' + OnboardingWorkflow.renderBlockers(result.blockers);
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Complete Stage 2 →';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  location.href = `detail.html?id=${contact.id}`;
}

// ── Init ──────────────────────────────────────────────────────────────────

(async () => {
  if (!supplierId || !onboardingId) {
    document.body.innerHTML = '<p style="padding:2rem;color:var(--color-danger)">Missing supplier_id or onboarding_id in URL.</p>';
    return;
  }

  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';

  const { data: c } = await supabaseClient.from('contacts').select('*').eq('id', supplierId).single();
  if (!c) { document.body.innerHTML = '<p style="padding:2rem;color:var(--color-danger)">Supplier not found.</p>'; return; }
  contact = c;

  const { data: ob } = await supabaseClient.from('supplier_onboarding').select('*').eq('id', onboardingId).single();
  if (!ob) { document.body.innerHTML = '<p style="padding:2rem;color:var(--color-danger)">Onboarding record not found.</p>'; return; }
  onboarding = ob;

  document.getElementById('topbar-title').textContent = `Stage 2 — Pre-Trade Vetting — ${contact.company_name}`;
  document.title = `Stage 2 — ${contact.company_name} — Vertex Metals Portal`;
  document.getElementById('back-link').href = `detail.html?id=${contact.id}`;
  document.getElementById('cancel-link').href = `detail.html?id=${contact.id}`;

  if (onboarding.workflow_stage === 'stage1_complete') {
    const result = await OnboardingWorkflow.advanceStage(onboardingId, 'pending_stage2');
    if (result.ok) onboarding.workflow_stage = 'pending_stage2';
  }

  isFullDiligence = OnboardingWorkflow.requiresFullDiligence(contact.supplier_type);

  const prereqList = document.getElementById('prereq-list');
  if (prereqList) {
    const items = OnboardingWorkflow.buildStage2Prerequisites(contact.supplier_type);
    prereqList.innerHTML = items.map(item => `<li>${esc(item)}</li>`).join('');
  }

  renderHeader();

  if (isFullDiligence) {
    document.getElementById('sanctions-review-panel').style.display = '';
    document.getElementById('risk-review-panel').style.display = '';
    await Promise.all([loadSanctionsReview(), loadRiskReview()]);
  }

  loadEsg();
  renderBankSection();
  renderTobSection();
  renderRecDecPanels();

  document.getElementById('esg-save-btn').addEventListener('click', submitEsg);
  document.getElementById('tob-generate-btn').addEventListener('click', generateTob);
  document.getElementById('tob-sent-btn').addEventListener('click', markTobSentHandler);
  document.getElementById('tob-confirmed-btn').addEventListener('click', markTobConfirmedHandler);
  document.getElementById('risk-review-btn')?.addEventListener('click', submitRiskReview);

  document.getElementById('rec-decision')?.addEventListener('change', function() {
    document.getElementById('rec-conditions-group').style.display =
      this.value === 'approve_with_conditions' ? 'block' : 'none';
  });
  document.getElementById('rec-submit-btn')?.addEventListener('click', submitRecommendation);
  document.getElementById('dec-submit-btn')?.addEventListener('click', submitDecision);

  document.getElementById('save-exit-btn').addEventListener('click', submitSaveAndExit);
  document.getElementById('complete-btn').addEventListener('click', submitCompleteStage2);
})();
