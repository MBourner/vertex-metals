/**
 * Vertex Metals Portal — Risk Assessment & Sanctions Screening
 * Handles portal/suppliers/risk-assessment.html
 * Stage 2 (Screening) of the supplier onboarding workflow.
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

// Track whether a new sanctions screen was entered on this page
let sanctionsScreenId = null; // set if user enters a new screen here
let existingScreenConfirmed = false;

// ── Live score calculation ────────────────────────────────────────────────

const CRITERIA = ['financial', 'quality', 'regulatory', 'geographic', 'continuity'];

function getScores() {
  return CRITERIA.map(c => {
    const val = document.getElementById(`score-${c}`)?.value;
    return val ? parseFloat(val) : null;
  });
}

function computeOverall(scores) {
  const valid = scores.filter(s => s !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function riskCategory(score) {
  if (score === null) return null;
  if (score <= 2.3) return 'low';
  if (score <= 3.6) return 'medium';
  return 'high';
}

function updateOverallScore() {
  const scores = getScores();
  CRITERIA.forEach((c, i) => {
    const disp = document.getElementById(`score-display-${c}`);
    if (disp) disp.textContent = scores[i] !== null ? scores[i] : '—';
  });

  const overall = computeOverall(scores);
  const cat = riskCategory(overall);

  const scoreVal = document.getElementById('overall-score-value');
  const scoreBadge = document.getElementById('overall-risk-badge');
  const badgeEl = document.getElementById('overall-score-badge');
  const overrideSec = document.getElementById('override-section');

  if (scoreVal) scoreVal.textContent = overall !== null ? overall.toFixed(2) : '—';
  if (overrideSec) overrideSec.style.display = overall !== null ? 'block' : 'none';

  const badgeClass = cat === 'high' ? 'badge-danger' : cat === 'medium' ? 'badge-warning' : 'badge-success';
  const badgeHtml = cat ? `<span class="badge ${badgeClass}">${cat} risk</span>` : '';
  if (scoreBadge) scoreBadge.innerHTML = badgeHtml;
  if (badgeEl) badgeEl.innerHTML = badgeHtml;

  // Show override category select only when override is checked
  const overrideCheck = document.getElementById('override-check');
  const overrideCatGroup = document.getElementById('override-category-group');
  if (overrideCatGroup && overrideCheck?.checked) {
    overrideCatGroup.style.display = 'block';
  }
}

// ── Load existing sanctions screens ──────────────────────────────────────

async function loadSanctionsSection(supplierName) {
  const el = document.getElementById('sanctions-section');
  const badgeEl = document.getElementById('sanctions-status-badge');

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  const { data: screens } = await supabaseClient
    .from('sanctions_screens')
    .select('id, screened_at, lists_screened, tool_used, result, match_resolution_notes')
    .eq('subject_id', supplierId)
    .order('screened_at', { ascending: false })
    .limit(3);

  const recent = screens?.find(s => new Date(s.screened_at) >= cutoff);
  const RESULT_CLASS = { clear: 'badge-success', potential_match: 'badge-warning', confirmed_match: 'badge-danger' };

  if (recent) {
    existingScreenConfirmed = true;
    badgeEl.innerHTML = `<span class="badge badge-success">Screen on file</span>`;
    el.innerHTML = `
      <div style="padding:var(--space-4);background:rgba(22,163,74,0.06);border:1px solid rgba(22,163,74,0.2);border-radius:var(--radius-sm);margin-bottom:var(--space-4)">
        <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:var(--space-2)">Current sanctions screen on file (within 12 months)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-3);font-size:var(--text-sm)">
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Date</div>${fmtDate(recent.screened_at)}</div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Lists</div>${(recent.lists_screened||[]).join(', ')||'—'}</div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Result</div><span class="badge ${RESULT_CLASS[recent.result]||'badge-neutral'}">${esc(recent.result?.replace('_',' '))}</span></div>
          ${recent.tool_used ? `<div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Tool</div>${esc(recent.tool_used)}</div>` : ''}
        </div>
        ${recent.match_resolution_notes ? `<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin:var(--space-2) 0 0">${esc(recent.match_resolution_notes)}</p>` : ''}
      </div>
      <p style="font-size:var(--text-sm);color:var(--color-text-muted)">A current screen is on file. You may record a new screen if circumstances have changed.</p>
      ${buildNewScreenForm(supplierName, true)}`;
  } else {
    badgeEl.innerHTML = `<span class="badge badge-danger">Screen required</span>`;
    el.innerHTML = `
      <div style="padding:var(--space-3) var(--space-4);background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.2);border-radius:var(--radius-sm);margin-bottom:var(--space-4);font-size:var(--text-sm)">
        No sanctions screen dated within the last 12 months. You must record a screen before this stage can be completed.
      </div>
      ${buildNewScreenForm(supplierName, false)}`;
  }
}

function buildNewScreenForm(supplierName, optional) {
  const today = new Date().toISOString().split('T')[0];
  return `
    <div id="new-screen-form" style="${optional ? 'display:none' : ''}">
      <div style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-4)">${optional ? 'Record New Screen (Optional)' : 'Record Sanctions Screen'}</div>
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="s-name">Subject Name Screened</label>
            <input type="text" class="form-input" id="s-name" value="${esc(supplierName)}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="s-date">Screening Date</label>
            <input type="date" class="form-input" id="s-date" value="${today}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Lists Screened</label>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-4)">
            ${['OFAC','HM Treasury (UK)','EU Consolidated','UN Security Council','World Bank'].map(l =>
              `<label style="display:flex;gap:var(--space-2);align-items:center;font-size:var(--text-sm);cursor:pointer">
                <input type="checkbox" class="list-check" value="${l}" style="accent-color:var(--color-accent)" checked /> ${l}
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
      </div>
    </div>
    ${optional ? `<button class="btn btn-ghost btn-sm" style="margin-top:var(--space-2)" onclick="document.getElementById('new-screen-form').style.display='block';this.style.display='none'">+ Record a new screen</button>` : ''}`;
}

// ── Submission ────────────────────────────────────────────────────────────

async function submitRiskAssessment() {
  const errEl = document.getElementById('form-error');
  errEl.style.display = 'none';

  // Validate scores — all 5 required
  const scores = getScores();
  if (scores.some(s => s === null)) {
    errEl.textContent = 'All five risk criteria must be scored before saving.';
    errEl.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // Validate sanctions screen
  const newScreenVisible = document.getElementById('new-screen-form')?.style.display !== 'none';
  if (newScreenVisible) {
    const result = document.getElementById('s-result')?.value;
    if (!result) {
      errEl.textContent = 'Please select a sanctions screening result.';
      errEl.style.display = 'block';
      return;
    }
    if (result === 'confirmed_match') {
      if (!confirm('A confirmed sanctions match will result in this onboarding being rejected. Proceed?')) return;
    }
  } else if (!existingScreenConfirmed) {
    errEl.textContent = 'A sanctions screen must be recorded before completing this stage.';
    errEl.style.display = 'block';
    return;
  }

  // Validate override reason
  const overrideChecked = document.getElementById('override-check')?.checked;
  if (overrideChecked && !document.getElementById('override-reason')?.value.trim()) {
    errEl.textContent = 'Override reason is required when overriding the computed risk category.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const user = await getCurrentUser();
    const overall = computeOverall(scores);
    const isOverride = overrideChecked || false;
    const cat = isOverride
      ? (document.getElementById('override-category')?.value || riskCategory(overall))
      : riskCategory(overall);

    // 1. Save new sanctions screen if entered
    if (newScreenVisible) {
      const lists = Array.from(document.querySelectorAll('.list-check:checked')).map(el => el.value);
      const { data: screen, error: sErr } = await supabaseClient.from('sanctions_screens').insert({
        subject_type:           'contact',
        subject_id:             supplierId,
        subject_name_snapshot:  document.getElementById('s-name')?.value.trim(),
        screened_at:            document.getElementById('s-date')?.value
                                  ? new Date(document.getElementById('s-date').value).toISOString()
                                  : new Date().toISOString(),
        screened_by:            user?.id,
        lists_screened:         lists,
        tool_used:              document.getElementById('s-tool')?.value.trim() || null,
        result:                 document.getElementById('s-result')?.value,
        match_resolution_notes: document.getElementById('s-notes')?.value.trim() || null,
      }).select('id').single();

      if (sErr) throw new Error('Failed to save sanctions screen: ' + sErr.message);
      sanctionsScreenId = screen.id;

      // Update contacts.last_sanctions_screened_at
      await supabaseClient.from('contacts').update({
        last_sanctions_screened_at: new Date().toISOString(),
        last_sanctions_result:      document.getElementById('s-result')?.value,
      }).eq('id', supplierId);
    }

    // 2. Save risk assessment
    const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1);
    const { error: raErr } = await supabaseClient.from('supplier_risk_assessment').insert({
      supplier_id:                    supplierId,
      onboarding_id:                  onboardingId,
      financial_viability_score:      scores[0],
      quality_certification_score:    scores[1],
      regulatory_compliance_score:    scores[2],
      geographic_risk_score:          scores[3],
      supply_continuity_score:        scores[4],
      overall_score:                  overall,
      risk_category:                  cat,
      financial_viability_notes:      document.getElementById('notes-financial')?.value.trim()   || null,
      quality_certification_notes:    document.getElementById('notes-quality')?.value.trim()     || null,
      regulatory_compliance_notes:    document.getElementById('notes-regulatory')?.value.trim()  || null,
      geographic_risk_notes:          document.getElementById('notes-geographic')?.value.trim()  || null,
      supply_continuity_notes:        document.getElementById('notes-continuity')?.value.trim()  || null,
      overall_notes:                  document.getElementById('overall-notes')?.value.trim()     || null,
      risk_category_override:         isOverride,
      risk_category_override_reason:  isOverride ? document.getElementById('override-reason')?.value.trim() : null,
      assessed_by:                    user?.id,
      assessment_date:                new Date().toISOString(),
      next_assessment_due:            nextYear.toISOString().split('T')[0],
    });
    if (raErr) throw new Error('Failed to save risk assessment: ' + raErr.message);

    // 3. Update onboarding risk_level to the assessed category
    await supabaseClient.from('supplier_onboarding').update({
      risk_level:   cat,
      updated_at:   new Date().toISOString(),
    }).eq('id', onboardingId);

    // 4. Write audit events
    await OnboardingWorkflow.logEvent(supplierId, onboardingId, 'risk_assessment_saved',
      `Risk assessment completed. Overall score: ${overall?.toFixed(2)} → ${cat} risk.${isOverride ? ' (Category overridden)' : ''}`,
      { overall_score: overall, risk_category: cat, override: isOverride }
    );
    if (sanctionsScreenId) {
      await OnboardingWorkflow.logEvent(supplierId, onboardingId, 'sanctions_linked',
        `Sanctions screen recorded: result = ${document.getElementById('s-result')?.value}.`,
        { screen_id: sanctionsScreenId }
      );
    }

    // 5. Advance stage to 'documents'
    const result = await OnboardingWorkflow.advanceStage(onboardingId, 'documents');
    if (!result.ok) {
      // Unlikely given we just saved the assessment, but surface it if it happens
      throw new Error('Stage advancement failed: ' + result.blockers.join('; '));
    }

    location.href = `detail.html?id=${supplierId}`;

  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Save & Advance to Documents →';
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

  const { data: supplier } = await supabaseClient.from('contacts').select('company_name').eq('id', supplierId).single();
  if (supplier) {
    document.getElementById('topbar-title').textContent = `Risk Assessment — ${supplier.company_name}`;
    document.title = `Risk Assessment — ${supplier.company_name}`;
  }

  const detailUrl = `detail.html?id=${supplierId}`;
  document.getElementById('back-link').href = detailUrl;
  document.getElementById('cancel-link').href = detailUrl;

  await loadSanctionsSection(supplier?.company_name || '');
})();
