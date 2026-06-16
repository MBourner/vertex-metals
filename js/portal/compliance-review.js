/**
 * Vertex Metals Portal — Stage 1b (Compliance Review)
 * Phase B: additive compliance/commercial scoring + Gate 1 dual sign-off.
 *
 * Handles portal/suppliers/compliance-review.html. Runs the sanctions
 * screen, compliance risk score, commercial suitability score, and Gate 1
 * dual-director sign-off for a supplier submitted via Stage 1a. On
 * "Complete Stage 1 — Ready to Quote" the onboarding moves to
 * workflow_stage='stage1_complete' once both Gate 1 approvals exist.
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

// ── State ─────────────────────────────────────────────────────────────────

let contact             = null;
let onboarding          = null;
let existingSanctionsScreen = null;
let existingComplianceScore = null;
let existingCommercialScore = null;
let gate1Approvals      = {};   // keyed by approval_stage
let productsReview      = [];

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

// ── Supplier summary ──────────────────────────────────────────────────────

function summaryItem(label, value) {
  return `<div><div class="summary-label">${esc(label)}</div><div>${esc(value || '—')}</div></div>`;
}

function renderSupplierSummary() {
  const addressLines = [contact.address_line_1, contact.address_line_2, contact.city, contact.postcode, contact.country]
    .filter(Boolean).join(', ');
  document.getElementById('supplier-type-badge').innerHTML =
    `<span class="badge badge-neutral">${esc(SUPPLIER_TYPE_LABELS[contact.supplier_type] || contact.supplier_type || '—')}</span>`;
  document.getElementById('supplier-summary').innerHTML = [
    summaryItem('Company Name',       contact.company_name),
    summaryItem('Supplier Reference', contact.supplier_reference),
    summaryItem('Country',            contact.country),
    summaryItem('Registration Number', contact.company_registration_number),
    summaryItem('VAT / GST Number',   contact.vat_number),
    summaryItem('Primary Contact',    contact.primary_contact_name),
    summaryItem('Email',              contact.email),
    summaryItem('Phone',              contact.phone),
    summaryItem('Address',            addressLines),
  ].join('');
}

// ── Products Offered — Review ─────────────────────────────────────────────

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
            <option value="approved"       ${r.onboarding_review_status === 'approved'       ? 'selected' : ''}>Approved</option>
            <option value="rejected"       ${r.onboarding_review_status === 'rejected'       ? 'selected' : ''}>Rejected</option>
          </select>
        </td>
        <td><input type="text" class="form-input" id="review-notes-${esc(r.id)}" value="${esc(r.onboarding_review_notes || '')}" placeholder="Notes…" /></td>
      </tr>`;
  }).join('');
}

// ── Sanctions screening ───────────────────────────────────────────────────

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
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Result</div><span class="badge ${RESULT_CLASS[s.result]||'badge-neutral'}">${esc(s.result?.replace(/_/g,' '))}</span></div>
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

// ── Compliance Risk Score ─────────────────────────────────────────────────

const COMPLIANCE_GROUP_LABELS = {
  corporate_risk:    'Corporate Risk',
  jurisdiction_risk: 'Jurisdiction Risk',
  product_risk:      'Product Risk',
  screening_results: 'Screening Results',
  controls:          'Mitigating Controls (reduce total)',
};

const COMMERCIAL_GROUP_LABELS = {
  product_fit:       'Product Fit',
  buyer_demand:      'Buyer Demand',
  volume_capability: 'Volume Capability',
  export_capability: 'Export Capability',
  quality_certs:     'Quality Certification',
  responsiveness:    'Responsiveness',
};

function renderComplianceFactors() {
  const groups = OnboardingWorkflow.COMPLIANCE_FACTOR_GROUPS_BY_TYPE[contact.supplier_type]
    || Object.keys(OnboardingWorkflow.COMPLIANCE_FACTORS);
  const checkedKeys = (existingComplianceScore?.components || []).map(c => c.factor_key);
  if (existingComplianceScore?.rating_band === 'Prohibited') checkedKeys.push('sanctions_match');

  document.getElementById('compliance-factors-container').innerHTML = groups.map(group => {
    const factors = OnboardingWorkflow.COMPLIANCE_FACTORS[group] || [];
    return `
      <div style="border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-4);margin-bottom:var(--space-3)">
        <div style="font-family:var(--font-display);font-weight:600;font-size:var(--text-sm);margin-bottom:var(--space-3)">${esc(COMPLIANCE_GROUP_LABELS[group] || group)}</div>
        ${factors.map(f => {
          const pillClass = f.autoReject ? 'score-pill-danger'
            : f.score < 0  ? 'score-pill-positive'
            : f.score === 0 ? 'score-pill-neutral' : 'score-pill-risk';
          const pillLabel = f.autoReject ? 'Prohibited' : (f.score > 0 ? '+' : '') + f.score;
          return `
          <label style="display:flex;gap:var(--space-3);align-items:center;padding:var(--space-2) 0;cursor:pointer;font-size:var(--text-sm)">
            <input type="checkbox" class="compliance-factor-check"
              data-key="${esc(f.key)}" data-group="${esc(group)}"
              data-score="${f.autoReject ? 'auto_reject' : f.score}"
              ${checkedKeys.includes(f.key) ? 'checked' : ''}
              onchange="updateComplianceLiveScore()"
              style="accent-color:var(--color-accent);flex-shrink:0" />
            <span style="flex:1">${esc(f.label)}</span>
            <span class="score-pill ${pillClass}">${pillLabel}</span>
          </label>`;
        }).join('')}
      </div>`;
  }).join('');

  updateComplianceLiveScore();
}

function updateComplianceLiveScore() {
  const checks = Array.from(document.querySelectorAll('.compliance-factor-check:checked'));
  const keys   = checks.map(ch => ch.dataset.key);
  const result = OnboardingWorkflow.computeComplianceScore(keys, contact.supplier_type);

  const totalEl = document.getElementById('compliance-total');
  const bandEl  = document.getElementById('compliance-band-badge');
  const liveEl  = document.getElementById('compliance-live-badge');

  if (result.prohibited) {
    if (totalEl) totalEl.textContent = '—';
    const html = '<span class="badge badge-danger">Prohibited — Hard Reject</span>';
    if (bandEl) bandEl.innerHTML = html;
    if (liveEl) liveEl.innerHTML = html;
  } else {
    if (totalEl) totalEl.textContent = result.total ?? 0;
    const bandClass = result.band === 'Low Risk' ? 'badge-success'
      : result.band === 'Medium Risk' ? 'badge-warning' : 'badge-danger';
    const html = `<span class="badge ${bandClass}">${esc(result.band)}</span>`;
    if (bandEl) bandEl.innerHTML = html;
    if (liveEl) liveEl.innerHTML = html;
  }
  updateMatrixRecommendation();
}

// ── Commercial Suitability Score ──────────────────────────────────────────

function renderCommercialFactors() {
  const checkedKeys = (existingCommercialScore?.components || []).map(c => c.factor_key);

  document.getElementById('commercial-factors-container').innerHTML =
    Object.entries(OnboardingWorkflow.COMMERCIAL_FACTORS).map(([group, factors]) => `
      <div style="border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-4);margin-bottom:var(--space-3)">
        <div style="font-family:var(--font-display);font-weight:600;font-size:var(--text-sm);margin-bottom:var(--space-3)">${esc(COMMERCIAL_GROUP_LABELS[group] || group)}</div>
        ${factors.map(f => {
          const pillClass = f.score >= 20 ? 'score-pill-positive' : f.score >= 10 ? 'score-pill-neutral' : 'score-pill-risk';
          return `
          <label style="display:flex;gap:var(--space-3);align-items:center;padding:var(--space-2) 0;cursor:pointer;font-size:var(--text-sm)">
            <input type="radio" name="commercial-${esc(group)}" class="commercial-factor-radio"
              value="${esc(f.key)}" data-score="${f.score}"
              ${checkedKeys.includes(f.key) ? 'checked' : ''}
              onchange="updateCommercialLiveScore()"
              style="accent-color:var(--color-accent);flex-shrink:0" />
            <span style="flex:1">${esc(f.label)}</span>
            <span class="score-pill ${pillClass}">+${f.score}</span>
          </label>`;
        }).join('')}
      </div>`).join('');

  updateCommercialLiveScore();
}

function updateCommercialLiveScore() {
  const radios = Array.from(document.querySelectorAll('.commercial-factor-radio:checked'));
  const keys   = radios.map(r => r.value);
  const result = OnboardingWorkflow.computeCommercialScore(keys);

  const totalEl = document.getElementById('commercial-total');
  const bandEl  = document.getElementById('commercial-band-badge');
  const liveEl  = document.getElementById('commercial-live-badge');

  if (totalEl) totalEl.textContent = result.total;
  const bandClass = result.band === 'Strategic Supplier' || result.band === 'Strong Fit' ? 'badge-success'
    : result.band === 'Moderate Fit' ? 'badge-warning' : 'badge-neutral';
  const html = `<span class="badge ${bandClass}">${esc(result.band)}</span>`;
  if (bandEl) bandEl.innerHTML = html;
  if (liveEl) liveEl.innerHTML = html;
  updateMatrixRecommendation();
}

function updateMatrixRecommendation() {
  const compKeys = Array.from(document.querySelectorAll('.compliance-factor-check:checked')).map(c => c.dataset.key);
  const commKeys = Array.from(document.querySelectorAll('.commercial-factor-radio:checked')).map(r => r.value);
  const el = document.getElementById('matrix-recommendation-text');
  if (!el || (!compKeys.length && !commKeys.length)) return;

  const compResult = OnboardingWorkflow.computeComplianceScore(compKeys, contact.supplier_type);
  const commResult = OnboardingWorkflow.computeCommercialScore(commKeys);
  const rec = OnboardingWorkflow.matrixRecommendation(compResult.band, commResult.band);

  const recClass = rec.includes('Reject') || rec.includes('Prohibited') ? 'badge-danger'
    : rec.includes('Excellent') || rec.includes('Good') ? 'badge-success' : 'badge-warning';
  el.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:center;font-size:var(--text-sm)">
      <span>Compliance: <strong>${esc(compResult.band)}</strong></span>
      <span style="color:var(--color-text-muted)">×</span>
      <span>Commercial: <strong>${esc(commResult.band)}</strong></span>
      <span style="color:var(--color-text-muted)">→</span>
      <span class="badge ${recClass}">${esc(rec)}</span>
    </div>`;
}

// ── Gate 1 sign-off ───────────────────────────────────────────────────────

function renderGate1SignoffPanel() {
  const compApproval = gate1Approvals['gate1_compliance'];
  const commApproval = gate1Approvals['gate1_commercial'];

  document.getElementById('gate1-compliance-section').innerHTML = compApproval
    ? buildApprovalReadOnly('Compliance Director (Martyn)', compApproval)
    : buildApprovalForm('compliance', 'Compliance Director (Martyn)', [
        { value: 'approve',                 label: 'Approve'                 },
        { value: 'approve_with_conditions', label: 'Approve with Conditions' },
        { value: 'reject',                  label: 'Reject'                  },
      ]);

  document.getElementById('gate1-commercial-section').innerHTML = commApproval
    ? buildApprovalReadOnly('Commercial Director (Jackson)', commApproval)
    : buildApprovalForm('commercial', 'Commercial Director (Jackson)', [
        { value: 'approve', label: 'Approve' },
        { value: 'reject',  label: 'Reject'  },
      ]);
}

function buildApprovalReadOnly(label, row) {
  const decClass = row.decision === 'reject' ? 'badge-danger'
    : row.decision === 'approve_with_conditions' ? 'badge-warning' : 'badge-success';
  return `
    <div style="padding:var(--space-4);background:rgba(22,163,74,0.04);border:1px solid rgba(22,163,74,0.2);border-radius:var(--radius-sm)">
      <div style="font-weight:600;font-size:var(--text-sm);margin-bottom:var(--space-2)">${esc(label)}</div>
      <div style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap;font-size:var(--text-sm)">
        <span class="badge ${decClass}">${esc((row.decision || '').replace(/_/g,' '))}</span>
        <span style="color:var(--color-text-muted)">on ${fmtDate(row.decided_at)}</span>
      </div>
      ${row.justification ? `<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin:var(--space-2) 0 0">${esc(row.justification)}</p>` : ''}
      ${row.conditions    ? `<p style="font-size:var(--text-xs);margin:var(--space-1) 0 0"><strong>Conditions:</strong> ${esc(row.conditions)}</p>` : ''}
    </div>`;
}

function buildApprovalForm(role, label, options) {
  return `
    <div style="padding:var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-sm);margin-top:var(--space-3)">
      <div style="font-weight:600;font-size:var(--text-sm);margin-bottom:var(--space-3)">${esc(label)} — Gate 1 Sign-off</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="gate1-${role}-decision">Decision</label>
          <select class="form-select" id="gate1-${role}-decision" onchange="toggleConditionsField('${esc(role)}')">
            <option value="">— not yet submitted —</option>
            ${options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="gate1-${role}-justification">Justification</label>
          <textarea class="form-textarea" id="gate1-${role}-justification" rows="2" placeholder="Basis for this decision…"></textarea>
        </div>
      </div>
      <div class="form-group" id="gate1-${role}-conditions-group" style="display:none">
        <label class="form-label" for="gate1-${role}-conditions">Conditions <span class="required">*</span></label>
        <textarea class="form-textarea" id="gate1-${role}-conditions" rows="2" placeholder="Conditions that must be met before proceeding…"></textarea>
      </div>
    </div>`;
}

function toggleConditionsField(role) {
  const decision = document.getElementById(`gate1-${role}-decision`)?.value;
  const grp = document.getElementById(`gate1-${role}-conditions-group`);
  if (grp) grp.style.display = decision === 'approve_with_conditions' ? 'block' : 'none';
}

// ── Complete Stage 1 — Ready to Quote ─────────────────────────────────────

async function submitComplianceReview() {
  const errEl = document.getElementById('cr-error');
  errEl.style.display = 'none';
  const missing = [];

  // Sanctions
  let sanctionsResult = existingSanctionsScreen?.result || null;
  if (!existingSanctionsScreen) {
    sanctionsResult = document.getElementById('s-result')?.value || null;
    if (!sanctionsResult) missing.push('Sanctions Screening Result');
  }

  // Compliance score — require at least one factor if no existing score
  const compKeys = Array.from(document.querySelectorAll('.compliance-factor-check:checked')).map(ch => ch.dataset.key);
  if (!existingComplianceScore && compKeys.length === 0) {
    missing.push('Compliance Risk Score (select at least one factor)');
  }

  // Gate 1 sign-off validation: if a decision is entered, justification is mandatory
  for (const role of ['compliance', 'commercial']) {
    if (gate1Approvals[`gate1_${role}`]) continue;
    const dec  = document.getElementById(`gate1-${role}-decision`)?.value;
    const just = (document.getElementById(`gate1-${role}-justification`)?.value || '').trim();
    if (dec && !just) {
      const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
      missing.push(`${roleLabel} director sign-off justification`);
    }
    if (dec === 'approve_with_conditions') {
      const cond = (document.getElementById(`gate1-${role}-conditions`)?.value || '').trim();
      if (!cond) {
        const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
        missing.push(`${roleLabel} director conditions`);
      }
    }
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

    // ── Sanctions screen ─────────────────────────────────────────────────
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

    // ── Compliance Risk Score ────────────────────────────────────────────
    if (compKeys.length > 0) {
      const compResult = OnboardingWorkflow.computeComplianceScore(compKeys, contact.supplier_type);

      if (compResult.prohibited) {
        await supabaseClient.from('supplier_compliance_scores').insert({
          supplier_id: supplierId, onboarding_id: onboardingId, gate: 1,
          total_score: 0, rating_band: 'Prohibited',
          components: compResult.components, computed_by: user?.id || null,
        });
        await OnboardingWorkflow.rejectOnboarding(onboardingId, 'stage1_complete',
          'Prohibited compliance risk factor selected (sanctions match confirmed).');
        location.href = `detail.html?id=${supplierId}`;
        return;
      }

      const { error: csErr } = await supabaseClient.from('supplier_compliance_scores').insert({
        supplier_id: supplierId, onboarding_id: onboardingId, gate: 1,
        total_score: compResult.total, rating_band: compResult.band,
        components: compResult.components, computed_by: user?.id || null,
      });
      if (csErr) throw new Error('Failed to save compliance score: ' + csErr.message);

      // Keep risk_level on supplier_onboarding in sync (used for pipeline display)
      const legacyLevel = compResult.band === 'Low Risk' ? 'low'
        : compResult.band === 'Medium Risk' ? 'medium' : 'high';
      await supabaseClient.from('supplier_onboarding')
        .update({ risk_level: legacyLevel, updated_at: new Date().toISOString() })
        .eq('id', onboardingId);

      await OnboardingWorkflow.logEvent(supplierId, onboardingId, 'risk_assessment_saved',
        `Gate 1 compliance risk score: ${compResult.total} → ${compResult.band}.`,
        { total: compResult.total, band: compResult.band, gate: 1 }
      );
    }

    // ── Commercial Suitability Score ─────────────────────────────────────
    const commKeys = Array.from(document.querySelectorAll('.commercial-factor-radio:checked')).map(r => r.value);
    if (commKeys.length > 0) {
      const commResult = OnboardingWorkflow.computeCommercialScore(commKeys);
      const { error: cmsErr } = await supabaseClient.from('supplier_commercial_scores').insert({
        supplier_id: supplierId, onboarding_id: onboardingId, gate: 1,
        total_score: commResult.total, rating_band: commResult.band,
        components: commResult.components, computed_by: user?.id || null,
      });
      if (cmsErr) throw new Error('Failed to save commercial score: ' + cmsErr.message);
    }

    // ── Gate 1 approvals ─────────────────────────────────────────────────
    for (const role of ['compliance', 'commercial']) {
      if (gate1Approvals[`gate1_${role}`]) continue;
      const decision = document.getElementById(`gate1-${role}-decision`)?.value;
      if (!decision) continue;
      const justification = (document.getElementById(`gate1-${role}-justification`)?.value || '').trim();
      const conditions    = (document.getElementById(`gate1-${role}-conditions`)?.value    || '').trim() || null;
      const { error: apErr } = await supabaseClient.from('supplier_approvals').insert({
        supplier_id:    supplierId,
        onboarding_id:  onboardingId,
        approval_stage: `gate1_${role}`,
        approver_id:    user?.id,
        approver_role:  role === 'compliance' ? 'director_compliance' : 'director_commercial',
        decision,
        justification,
        conditions: decision === 'approve_with_conditions' ? conditions : null,
        decided_at: new Date().toISOString(),
      });
      if (apErr) throw new Error(`Failed to save Gate 1 ${role} sign-off: ${apErr.message}`);
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

    // ── Confirmed sanctions match → reject immediately ────────────────────
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
  document.getElementById('back-link').href    = `detail.html?id=${contact.id}`;
  document.getElementById('cancel-link').href  = `detail.html?id=${contact.id}`;
  document.getElementById('not-ready-back').href = `detail.html?id=${contact.id}`;

  if (onboarding.workflow_stage !== 'pending_compliance') {
    document.getElementById('not-ready-text').textContent =
      `This onboarding is not awaiting compliance review — its current status is "${OnboardingWorkflow.stageLabel(onboarding.workflow_stage)}".`;
    document.getElementById('not-ready-notice').style.display = 'block';
    return;
  }

  document.getElementById('review-form').style.display = 'block';

  // Load existing scores and gate1 approvals in parallel
  const [compScoreRes, commScoreRes, gate1Res] = await Promise.all([
    supabaseClient
      .from('supplier_compliance_scores')
      .select('*').eq('onboarding_id', onboardingId).eq('gate', 1)
      .order('computed_at', { ascending: false }).limit(1),
    supabaseClient
      .from('supplier_commercial_scores')
      .select('*').eq('onboarding_id', onboardingId).eq('gate', 1)
      .order('computed_at', { ascending: false }).limit(1),
    supabaseClient
      .from('supplier_approvals')
      .select('*').eq('onboarding_id', onboardingId)
      .in('approval_stage', ['gate1_compliance', 'gate1_commercial']),
  ]);

  existingComplianceScore = compScoreRes.data?.[0] || null;
  existingCommercialScore = commScoreRes.data?.[0] || null;
  (gate1Res.data || []).forEach(row => { gate1Approvals[row.approval_stage] = row; });

  renderSupplierSummary();
  await loadProductsForReview();
  renderSanctionsListLinks();
  await loadSanctionsSection();
  renderComplianceFactors();
  renderCommercialFactors();
  renderGate1SignoffPanel();
  updateMatrixRecommendation();

  document.getElementById('complete-btn').addEventListener('click', submitComplianceReview);
})();
