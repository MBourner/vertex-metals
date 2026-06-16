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
let bankEditMode = false;
let gate1ComplianceScore = null;
let gate1CommercialScore = null;
let gate2Approvals = {};

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

// ── Compliance & Commercial Scores Review ────────────────────────────────

const COMPLIANCE_GROUP_LABELS = {
  corporate_risk:    'Corporate Risk',
  jurisdiction_risk: 'Jurisdiction Risk',
  product_risk:      'Product Risk',
  screening_results: 'Screening Results',
  controls:          'Controls & Mitigants',
};
const COMMERCIAL_GROUP_LABELS = {
  product_fit:       'Product Fit',
  buyer_demand:      'Buyer Demand',
  volume_capability: 'Volume Capability',
  export_capability: 'Export Capability',
  quality_certs:     'Quality Certifications',
  responsiveness:    'Responsiveness',
};

async function loadScoresPanel() {
  const [compRes, commRes] = await Promise.all([
    supabaseClient.from('supplier_compliance_scores').select('*')
      .eq('onboarding_id', onboardingId).eq('gate', 1)
      .order('computed_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseClient.from('supplier_commercial_scores').select('*')
      .eq('onboarding_id', onboardingId).eq('gate', 1)
      .order('computed_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  gate1ComplianceScore = compRes.data || null;
  gate1CommercialScore = commRes.data || null;

  renderScoresSummary();

  if (gate1ComplianceScore || gate1CommercialScore) {
    document.getElementById('scores-update-toggle').style.display = 'block';
    document.getElementById('toggle-score-update-btn').addEventListener('click', () => {
      const form = document.getElementById('scores-update-form');
      const opening = form.style.display === 'none' || form.style.display === '';
      form.style.display = opening ? 'block' : 'none';
      document.getElementById('toggle-score-update-btn').textContent =
        opening ? 'Hide Score Update Form' : 'Update Scores for Gate 2';
      if (opening) {
        renderComplianceUpdateForm();
        renderCommercialUpdateForm();
        updateComplianceLiveScore();
        updateCommercialLiveScore();
      }
    });
  }

  const { data: gate2Rows } = await supabaseClient.from('supplier_approvals')
    .select('*').eq('onboarding_id', onboardingId)
    .in('approval_stage', ['gate2_compliance', 'gate2_commercial']);
  gate2Approvals = {};
  for (const row of (gate2Rows || [])) gate2Approvals[row.approval_stage] = row;

  renderGate2SignoffPanel();
  updateGate2MatrixRec();
}

function renderScoresSummary() {
  const el = document.getElementById('scores-summary-cards');
  const cs = gate1ComplianceScore;
  const cm = gate1CommercialScore;

  if (!cs && !cm) {
    el.innerHTML = '<p style="font-size:var(--text-sm);color:var(--color-text-muted)">No additive scores recorded at Gate 1. This supplier may have been onboarded before the Phase B scoring model was introduced.</p>';
    return;
  }

  const compBandClass = !cs ? 'badge-neutral'
    : cs.rating_band === 'Low Risk' ? 'badge-success'
    : cs.rating_band === 'Medium Risk' ? 'badge-warning'
    : 'badge-danger';

  const commBandClass = !cm ? 'badge-neutral'
    : (cm.rating_band === 'Strategic Supplier' || cm.rating_band === 'Strong Fit') ? 'badge-success'
    : cm.rating_band === 'Moderate Fit' ? 'badge-warning'
    : 'badge-neutral';

  function compPills(components) {
    if (!components?.length) return '';
    return components.map(c => {
      const cls = c.score < 0 ? 'score-pill score-pill-positive'
        : c.score > 0 ? 'score-pill score-pill-risk'
        : 'score-pill score-pill-neutral';
      const sign = c.score > 0 ? '+' : '';
      return `<span class="${cls}">${esc(c.label)} ${sign}${c.score}</span>`;
    }).join(' ');
  }

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-bottom:var(--space-2)">
      <div style="padding:var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-sm)">
        <div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-2)">Compliance Risk (Gate 1)</div>
        ${cs ? `
          <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)">
            <span class="badge ${compBandClass}">${esc(cs.rating_band)}</span>
            <span style="font-size:var(--text-sm);color:var(--color-text-muted)">Score: ${cs.total_score !== null ? cs.total_score : '—'}</span>
          </div>
          <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-2)">${fmtDate(cs.computed_at)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">${compPills(cs.components)}</div>`
          : '<span class="badge badge-neutral">Not scored</span>'}
      </div>
      <div style="padding:var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-sm)">
        <div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-2)">Commercial Suitability (Gate 1)</div>
        ${cm ? `
          <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)">
            <span class="badge ${commBandClass}">${esc(cm.rating_band)}</span>
            <span style="font-size:var(--text-sm);color:var(--color-text-muted)">Score: ${cm.total_score}</span>
          </div>
          <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-2)">${fmtDate(cm.computed_at)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">${compPills(cm.components)}</div>`
          : '<span class="badge badge-neutral">Not scored</span>'}
      </div>
    </div>`;
}

function updateGate2MatrixRec() {
  const el = document.getElementById('gate2-matrix-rec');
  if (!el) return;
  const cs = gate1ComplianceScore;
  const cm = gate1CommercialScore;
  if (!cs || !cm) {
    el.textContent = 'Gate 1 scores required to derive a matrix recommendation.';
    return;
  }
  const rec = OnboardingWorkflow.matrixRecommendation(cs.rating_band, cm.rating_band);
  const recClass = rec.includes('Reject') || rec.includes('Prohibited') ? 'badge-danger'
    : (rec.includes('Excellent') || rec.includes('Good')) ? 'badge-success' : 'badge-warning';
  el.innerHTML = `Gate 1 matrix recommendation: <span class="badge ${recClass}">${esc(rec)}</span>`;
}

function renderComplianceUpdateForm() {
  const groups  = OnboardingWorkflow.COMPLIANCE_FACTOR_GROUPS_BY_TYPE[contact.supplier_type]
    || Object.keys(OnboardingWorkflow.COMPLIANCE_FACTORS);
  const factors = OnboardingWorkflow.COMPLIANCE_FACTORS;
  const existingKeys = new Set((gate1ComplianceScore?.components || []).map(c => c.factor_key));
  if (gate1ComplianceScore?.rating_band === 'Prohibited') existingKeys.add('sanctions_match');

  let html = '';
  for (const group of groups) {
    html += `<div style="margin-bottom:var(--space-4)">
      <div style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-muted);margin-bottom:var(--space-2)">${esc(COMPLIANCE_GROUP_LABELS[group] || group)}</div>
      <div style="display:flex;flex-direction:column;gap:var(--space-2)">`;
    for (const factor of (factors[group] || [])) {
      const isChecked = existingKeys.has(factor.key);
      const pill = factor.autoReject
        ? `<span class="score-pill score-pill-danger">Hard reject</span>`
        : (() => {
            const cls = factor.score < 0 ? 'score-pill score-pill-positive'
              : factor.score > 0 ? 'score-pill score-pill-risk' : 'score-pill score-pill-neutral';
            return `<span class="${cls}">${factor.score > 0 ? '+' : ''}${factor.score}</span>`;
          })();
      html += `<label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer;font-size:var(--text-sm)">
        <input type="checkbox" class="compliance-factor-check" data-key="${esc(factor.key)}"
          style="accent-color:var(--color-accent)" ${isChecked ? 'checked' : ''}
          onchange="updateComplianceLiveScore()" />
        <span style="flex:1">${esc(factor.label)}</span>${pill}
      </label>`;
    }
    html += `</div></div>`;
  }
  document.getElementById('compliance-factors-container').innerHTML = html;
}

function updateComplianceLiveScore() {
  const keys   = Array.from(document.querySelectorAll('.compliance-factor-check:checked')).map(c => c.dataset.key);
  const result = OnboardingWorkflow.computeComplianceScore(keys, contact.supplier_type);
  const totalEl = document.getElementById('compliance-total');
  const bandEl  = document.getElementById('compliance-band-badge');
  if (totalEl) totalEl.textContent = result.prohibited ? '—' : (result.total ?? 0);
  if (bandEl) {
    const cls = result.band === 'Low Risk' ? 'badge-success'
      : result.band === 'Medium Risk' ? 'badge-warning' : 'badge-danger';
    bandEl.innerHTML = `<span class="badge ${cls}">${esc(result.band)}</span>`;
  }
}

function renderCommercialUpdateForm() {
  const factors     = OnboardingWorkflow.COMMERCIAL_FACTORS;
  const existingKeys = new Set((gate1CommercialScore?.components || []).map(c => c.factor_key));

  let html = '';
  for (const [group, flist] of Object.entries(factors)) {
    html += `<div style="margin-bottom:var(--space-4)">
      <div style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-muted);margin-bottom:var(--space-2)">${esc(COMMERCIAL_GROUP_LABELS[group] || group)}</div>
      <div style="display:flex;flex-direction:column;gap:var(--space-2)">`;
    for (const factor of flist) {
      const isChecked = existingKeys.has(factor.key);
      html += `<label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer;font-size:var(--text-sm)">
        <input type="radio" class="commercial-factor-radio" name="commercial-${esc(group)}" value="${esc(factor.key)}"
          style="accent-color:var(--color-accent)" ${isChecked ? 'checked' : ''}
          onchange="updateCommercialLiveScore()" />
        <span style="flex:1">${esc(factor.label)}</span>
        <span class="score-pill score-pill-positive">+${factor.score}</span>
      </label>`;
    }
    html += `</div></div>`;
  }
  document.getElementById('commercial-factors-container').innerHTML = html;
}

function updateCommercialLiveScore() {
  const keys   = Array.from(document.querySelectorAll('.commercial-factor-radio:checked')).map(r => r.value);
  const result = OnboardingWorkflow.computeCommercialScore(keys);
  const totalEl = document.getElementById('commercial-total');
  const bandEl  = document.getElementById('commercial-band-badge');
  if (totalEl) totalEl.textContent = result.total ?? 0;
  if (bandEl) {
    const cls = (result.band === 'Strategic Supplier' || result.band === 'Strong Fit') ? 'badge-success'
      : result.band === 'Moderate Fit' ? 'badge-warning' : 'badge-neutral';
    bandEl.innerHTML = `<span class="badge ${cls}">${esc(result.band)}</span>`;
  }
}

// ── Gate 2 — Director Sign-off ────────────────────────────────────────────

function buildGate2ApprovalReadOnly(row, label) {
  const decClass = row.decision === 'reject' ? 'badge-danger'
    : row.decision === 'approve_with_conditions' ? 'badge-warning' : 'badge-success';
  return `
    <div style="padding:var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-sm)">
      <div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-2)">${esc(label)}</div>
      <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-bottom:${row.justification ? 'var(--space-2)' : '0'}">
        <span class="badge ${decClass}">${esc(row.decision.replace(/_/g, ' '))}</span>
        <span style="font-size:var(--text-xs);color:var(--color-text-muted)">${fmtDate(row.decided_at)}</span>
      </div>
      ${row.justification ? `<p style="font-size:var(--text-sm);margin:0">${esc(row.justification)}</p>` : ''}
      ${row.conditions ? `<p style="font-size:var(--text-xs);color:var(--color-text-muted);white-space:pre-line;margin:var(--space-1) 0 0">${esc(row.conditions)}</p>` : ''}
    </div>`;
}

function buildGate2ApprovalForm(role, label, options) {
  return `
    <div style="padding:var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-sm)">
      <div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-3)">${esc(label)}</div>
      <div class="form-group">
        <label class="form-label" for="gate2-${esc(role)}-decision">Decision <span class="required">*</span></label>
        <select class="form-select" id="gate2-${esc(role)}-decision" onchange="toggleGate2ConditionsField('${esc(role)}')">
          <option value="">Select…</option>
          ${options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="gate2-${esc(role)}-justification">Justification <span class="required">*</span></label>
        <textarea class="form-textarea" id="gate2-${esc(role)}-justification" rows="3" placeholder="Summarise your assessment and the basis for your decision…"></textarea>
      </div>
      <div class="form-group" id="gate2-${esc(role)}-conditions-group" style="display:none">
        <label class="form-label" for="gate2-${esc(role)}-conditions">Conditions (one per line) <span class="required">*</span></label>
        <textarea class="form-textarea" id="gate2-${esc(role)}-conditions" rows="3" placeholder="List any conditions that must be satisfied before trading begins…"></textarea>
      </div>
    </div>`;
}

function toggleGate2ConditionsField(role) {
  const dec = document.getElementById(`gate2-${role}-decision`)?.value;
  const grp = document.getElementById(`gate2-${role}-conditions-group`);
  if (grp) grp.style.display = dec === 'approve_with_conditions' ? 'block' : 'none';
}

function renderGate2SignoffPanel() {
  const compRow = gate2Approvals['gate2_compliance'];
  const commRow = gate2Approvals['gate2_commercial'];

  document.getElementById('gate2-compliance-section').innerHTML = compRow
    ? buildGate2ApprovalReadOnly(compRow, 'Compliance Director (Martyn)')
    : buildGate2ApprovalForm('compliance', 'Compliance Director (Martyn)', [
        { value: 'approve',                 label: 'Approve' },
        { value: 'approve_with_conditions', label: 'Approve with Conditions' },
        { value: 'reject',                  label: 'Reject' },
      ]);

  document.getElementById('gate2-commercial-section').innerHTML = commRow
    ? buildGate2ApprovalReadOnly(commRow, 'Commercial Director (Jackson)')
    : buildGate2ApprovalForm('commercial', 'Commercial Director (Jackson)', [
        { value: 'approve', label: 'Approve' },
        { value: 'reject',  label: 'Reject'  },
      ]);
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

  // Validate justification / conditions for any filled-but-unsaved sign-off sections
  const missing = [];
  for (const role of ['compliance', 'commercial']) {
    if (gate2Approvals[`gate2_${role}`]) continue;
    const dec  = document.getElementById(`gate2-${role}-decision`)?.value;
    const just = (document.getElementById(`gate2-${role}-justification`)?.value || '').trim();
    if (dec && !just) missing.push(`${role} director Gate 2 justification`);
    if (dec === 'approve_with_conditions') {
      const cond = (document.getElementById(`gate2-${role}-conditions`)?.value || '').trim();
      if (!cond) missing.push(`${role} director Gate 2 conditions`);
    }
  }
  if (missing.length) {
    errEl.textContent = `Please complete: ${missing.join('; ')}.`;
    errEl.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const btn = document.getElementById('complete-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const user = await getCurrentUser();

    // Save Gate 2 scores if the update form is open and has selections
    const scoresFormEl = document.getElementById('scores-update-form');
    if (scoresFormEl && scoresFormEl.style.display !== 'none') {
      const compKeys = Array.from(document.querySelectorAll('.compliance-factor-check:checked')).map(c => c.dataset.key);
      if (compKeys.length > 0) {
        const compResult = OnboardingWorkflow.computeComplianceScore(compKeys, contact.supplier_type);
        await supabaseClient.from('supplier_compliance_scores').insert({
          supplier_id:   contact.id,
          onboarding_id: onboardingId,
          gate:          2,
          total_score:   compResult.prohibited ? 0 : compResult.total,
          rating_band:   compResult.band,
          components:    compResult.components,
          computed_by:   user?.id || null,
        });
        if (!compResult.prohibited) {
          const legacyLevel = compResult.band === 'Low Risk' ? 'low'
            : compResult.band === 'Medium Risk' ? 'medium' : 'high';
          await supabaseClient.from('supplier_onboarding')
            .update({ risk_level: legacyLevel, updated_at: new Date().toISOString() })
            .eq('id', onboardingId);
        }
      }

      const commKeys = Array.from(document.querySelectorAll('.commercial-factor-radio:checked')).map(r => r.value);
      if (commKeys.length > 0) {
        const commResult = OnboardingWorkflow.computeCommercialScore(commKeys);
        await supabaseClient.from('supplier_commercial_scores').insert({
          supplier_id:   contact.id,
          onboarding_id: onboardingId,
          gate:          2,
          total_score:   commResult.total,
          rating_band:   commResult.band,
          components:    commResult.components,
          computed_by:   user?.id || null,
        });
      }
    }

    // Save Gate 2 approvals for each director section that has been filled in
    for (const role of ['compliance', 'commercial']) {
      if (gate2Approvals[`gate2_${role}`]) continue;
      const decision = document.getElementById(`gate2-${role}-decision`)?.value;
      if (!decision) continue;
      const justification = (document.getElementById(`gate2-${role}-justification`)?.value || '').trim();
      const conditions    = (document.getElementById(`gate2-${role}-conditions`)?.value    || '').trim() || null;
      await supabaseClient.from('supplier_approvals').insert({
        supplier_id:    contact.id,
        onboarding_id:  onboardingId,
        approval_stage: `gate2_${role}`,
        approver_id:    user?.id,
        approver_role:  role === 'compliance' ? 'director_compliance' : 'director_commercial',
        decision,
        justification,
        conditions:     decision === 'approve_with_conditions' ? conditions : null,
        decided_at:     new Date().toISOString(),
      });
      // Update local state so re-clicks don't re-save
      gate2Approvals[`gate2_${role}`] = { decision, justification, decided_at: new Date().toISOString() };
    }

    const result = await OnboardingWorkflow.advanceStage(onboardingId, 'stage2_complete');
    if (!result.ok) {
      errEl.innerHTML = '<strong>Cannot complete Stage 2 yet:</strong>' + OnboardingWorkflow.renderBlockers(result.blockers);
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Complete Stage 2 →';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Refresh panel so the newly-saved approval renders read-only
      renderGate2SignoffPanel();
      return;
    }

    location.href = `detail.html?id=${contact.id}`;

  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Complete Stage 2 →';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
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
    await loadSanctionsReview();
  }

  await loadScoresPanel();

  loadEsg();
  renderBankSection();
  renderTobSection();

  document.getElementById('esg-save-btn').addEventListener('click', submitEsg);
  document.getElementById('tob-generate-btn').addEventListener('click', generateTob);
  document.getElementById('tob-sent-btn').addEventListener('click', markTobSentHandler);
  document.getElementById('tob-confirmed-btn').addEventListener('click', markTobConfirmedHandler);

  document.getElementById('save-exit-btn').addEventListener('click', submitSaveAndExit);
  document.getElementById('complete-btn').addEventListener('click', submitCompleteStage2);
})();
