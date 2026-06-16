/**
 * Vertex Metals Portal — Stage 1b (Compliance Review)
 * Handles portal/suppliers/compliance-review.html
 *
 * Runs the sanctions screen and preliminary risk assessment for a supplier
 * submitted for compliance review during Stage 1a (onboard.html). On
 * "Complete Stage 1 — Ready to Quote" the onboarding moves to
 * workflow_stage='stage1_complete'.
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
const supplierId   = params.get('supplier_id');
const onboardingId = params.get('onboarding_id');

// ── State ────────────────────────────────────────────────────────────────

let contact    = null;
let onboarding = null;
let existingSanctionsScreen = null;
let existingRiskAssessment  = null;
let productsReview = [];

const SANCTIONS_LISTS = [
  { name: 'UK Sanctions List', url: 'https://search-uk-sanctions-list.service.gov.uk/' },
  { name: 'UN',                url: 'https://www.un.org/securitycouncil/content/un-sc-consolidated-list' },
  { name: 'EU',                url: 'https://www.sanctionsmap.eu/#/main' },
];

const SUPPLIER_TYPE_LABELS = {
  manufacturing:         'Manufacturing',
  materials_commodities: 'Materials / Commodities',
  logistics:             'Logistics / 3PL',
  packaging:             'Packaging',
  service_provider:      'Service Provider',
};

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.value = value;
}

// ── Supplier summary panel ──────────────────────────────────────────────

function summaryItem(label, value) {
  return `<div><div class="summary-label">${esc(label)}</div><div>${esc(value || '—')}</div></div>`;
}

function renderSupplierSummary() {
  const addressLines = [contact.address_line_1, contact.address_line_2, contact.city, contact.postcode, contact.country]
    .filter(Boolean).join(', ');

  document.getElementById('supplier-type-badge').innerHTML =
    `<span class="badge badge-neutral">${esc(SUPPLIER_TYPE_LABELS[contact.supplier_type] || contact.supplier_type || '—')}</span>`;

  document.getElementById('supplier-summary').innerHTML = [
    summaryItem('Company Name', contact.company_name),
    summaryItem('Supplier Reference', contact.supplier_reference),
    summaryItem('Country', contact.country),
    summaryItem('Registration Number', contact.company_registration_number),
    summaryItem('VAT / GST Number', contact.vat_number),
    summaryItem('Primary Contact', contact.primary_contact_name),
    summaryItem('Email', contact.email),
    summaryItem('Phone', contact.phone),
    summaryItem('Address', addressLines),
  ].join('');
}

// ── Risk assessment scoring ─────────────────────────────────────────────
//
// Which of the five criteria apply, and their relative weight in the
// overall score, are driven by OnboardingWorkflow.SUPPLIER_TYPE_PROFILES
// (see js/portal/supplier-onboarding.js) — keyed off the supplier's type.

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
  const tier = OnboardingWorkflow.requiresFullDiligence(contact.supplier_type) ? 'full' : 'simplified';
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
// supplier's type (OnboardingWorkflow.SUPPLIER_TYPE_PROFILES).
function applyCriteriaVisibility(supplierType) {
  const criteria = OnboardingWorkflow.getRiskCriteria(supplierType);
  OnboardingWorkflow.RISK_CRITERIA.forEach(c => {
    const card = document.getElementById(`criterion-${c}`);
    if (card) card.style.display = criteria.includes(c) ? '' : 'none';
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
  if (badgeEl) badgeEl.innerHTML = cat ? `Score: ${badgeHtml}` : 'Score: —';

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

// ── Products Offered — Review ───────────────────────────────────────────

async function loadProductsForReview() {
  const { data, error } = await supabaseClient
    .from('supplier_quotes')
    .select('id, product, specification, onboarding_review_status, onboarding_review_notes, product_line:product_lines(name, metal_family, sub_type)')
    .eq('supplier_id', supplierId)
    .not('onboarding_review_status', 'is', null);

  if (error) {
    document.getElementById('products-review-body').innerHTML =
      `<tr><td colspan="5" style="text-align:center;color:var(--color-danger);padding:var(--space-6)">${esc(error.message)}</td></tr>`;
    return;
  }

  productsReview = data || [];
  renderProductsReview(productsReview);
}

function renderProductsReview(rows) {
  const tbody = document.getElementById('products-review-body');

  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:var(--space-6)">No products were offered during registration.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const pl = r.product_line || {};
    const family = pl.metal_family ? `${esc(pl.metal_family)}${pl.sub_type ? ` / ${esc(pl.sub_type)}` : ''}` : '—';
    return `
      <tr>
        <td>${family}</td>
        <td style="font-weight:600">${esc(pl.name || r.product)}</td>
        <td>${esc(r.specification || '—')}</td>
        <td>
          <select class="form-select" id="review-status-${esc(r.id)}">
            <option value="pending_review" ${r.onboarding_review_status === 'pending_review' ? 'selected' : ''}>Pending Review</option>
            <option value="approved" ${r.onboarding_review_status === 'approved' ? 'selected' : ''}>Approved</option>
            <option value="rejected" ${r.onboarding_review_status === 'rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </td>
        <td><input type="text" class="form-input" id="review-notes-${esc(r.id)}" value="${esc(r.onboarding_review_notes || '')}" placeholder="Notes…" /></td>
      </tr>`;
  }).join('');
}

// ── Sanctions screening panel ───────────────────────────────────────────

function renderSanctionsListLinks() {
  document.getElementById('sanctions-list-links').innerHTML = SANCTIONS_LISTS.map(l =>
    `<a href="${esc(l.url)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)">${esc(l.name)} →</a>`
  ).join('');
}

async function loadSanctionsSection() {
  const { data } = await supabaseClient
    .from('sanctions_screens')
    .select('id, screened_at, lists_screened, tool_used, result, match_resolution_notes')
    .eq('subject_id', supplierId)
    .order('screened_at', { ascending: false })
    .limit(1);
  existingSanctionsScreen = data?.[0] || null;
  renderSanctionsSection();
}

function renderSanctionsSection() {
  const el = document.getElementById('sanctions-section');
  const badgeEl = document.getElementById('sanctions-status-badge');
  const RESULT_CLASS = { clear: 'badge-success', potential_match: 'badge-warning', confirmed_match: 'badge-danger' };

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
  el.innerHTML = buildNewScreenForm(contact.company_name);
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

// ── Complete Stage 1 — Ready to Quote ───────────────────────────────────

async function submitComplianceReview() {
  const errEl = document.getElementById('cr-error');
  errEl.style.display = 'none';

  const criteria = OnboardingWorkflow.getRiskCriteria(contact.supplier_type);
  const missing = [];

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

    // ── Sanctions screen ───────────────────────────────────────────────
    if (!existingSanctionsScreen) {
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
        result:                 sanctionsResult,
        match_resolution_notes: document.getElementById('s-notes')?.value.trim() || null,
      }).select('id').single();
      if (sErr) throw new Error('Failed to save sanctions screen: ' + sErr.message);

      await supabaseClient.from('contacts').update({
        last_sanctions_screened_at: new Date().toISOString(),
        last_sanctions_result:      sanctionsResult,
      }).eq('id', supplierId);

      await OnboardingWorkflow.logEvent(supplierId, onboardingId, 'sanctions_linked',
        `Sanctions screen recorded: result = ${sanctionsResult}.`, { screen_id: screen.id }
      );
    }

    // ── Preliminary risk assessment ─────────────────────────────────────
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
        supplier_id:                    supplierId,
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

      await OnboardingWorkflow.logEvent(supplierId, onboardingId, 'risk_assessment_saved',
        `Preliminary risk assessment completed. Overall score: ${overall?.toFixed(2)} → ${riskCat} risk.${isOverride ? ' (Category overridden)' : ''}`,
        { overall_score: overall, risk_category: riskCat, override: isOverride }
      );
    }

    // ── Products Offered — Review ────────────────────────────────────────
    for (const r of productsReview) {
      const status = document.getElementById(`review-status-${r.id}`)?.value || r.onboarding_review_status;
      const notes  = document.getElementById(`review-notes-${r.id}`)?.value.trim() || null;
      if (status !== r.onboarding_review_status || notes !== r.onboarding_review_notes) {
        const { error: prErr } = await supabaseClient.from('supplier_quotes')
          .update({ onboarding_review_status: status, onboarding_review_notes: notes })
          .eq('id', r.id);
        if (prErr) throw new Error('Failed to save product review: ' + prErr.message);
      }
    }

    // ── Confirmed sanctions match → reject immediately ───────────────────
    if (sanctionsResult === 'confirmed_match') {
      await OnboardingWorkflow.rejectOnboarding(onboardingId, 'stage1_complete',
        'Confirmed sanctions match identified during Stage 1 screening.');
      location.href = `detail.html?id=${supplierId}`;
      return;
    }

    // ── Advance to stage1_complete ────────────────────────────────────────
    const result = await OnboardingWorkflow.advanceStage(onboardingId, 'stage1_complete');
    if (!result.ok) {
      errEl.innerHTML = '<strong>Saved, but Stage 1 cannot be marked complete yet:</strong>' + OnboardingWorkflow.renderBlockers(result.blockers);
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Complete Stage 1 — Ready to Quote';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    location.href = `detail.html?id=${supplierId}&onboarding_new=1`;

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

  document.getElementById('topbar-title').textContent = `Stage 1b — Compliance Review — ${contact.company_name}`;
  document.title = `Stage 1b — ${contact.company_name} — Vertex Metals Portal`;
  document.getElementById('back-link').href = `detail.html?id=${contact.id}`;
  document.getElementById('cancel-link').href = `detail.html?id=${contact.id}`;
  document.getElementById('not-ready-back').href = `detail.html?id=${contact.id}`;

  if (onboarding.workflow_stage !== 'pending_compliance') {
    document.getElementById('not-ready-text').textContent =
      `This onboarding is not awaiting compliance review — its current status is "${OnboardingWorkflow.stageLabel(onboarding.workflow_stage)}".`;
    document.getElementById('not-ready-notice').style.display = 'block';
    return;
  }

  document.getElementById('review-form').style.display = 'block';

  renderSupplierSummary();
  await loadProductsForReview();
  renderFinancialCriterion();
  applyCriteriaVisibility(contact.supplier_type);
  renderSanctionsListLinks();
  await loadSanctionsSection();

  const { data: ra } = await supabaseClient
    .from('supplier_risk_assessment').select('*').eq('onboarding_id', onboardingId).maybeSingle();
  existingRiskAssessment = ra || null;
  if (existingRiskAssessment) {
    prefillRiskAssessment(existingRiskAssessment);
  } else {
    updateOverallScore();
  }

  document.getElementById('complete-btn').addEventListener('click', submitComplianceReview);
})();
