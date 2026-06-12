/**
 * Vertex Metals Portal — Compliance Review
 * Handles portal/suppliers/compliance-review.html
 * Stage 4 (Compliance Review) of the supplier onboarding workflow.
 *
 * Martyn confirms KYC record and sanctions screening are in place
 * before the onboarding advances to the Recommendation stage.
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

// Track gate status for the advance button
const gateStatus = { kyc: false, sanctions: false };

// ── Icon helpers ──────────────────────────────────────────────────────────

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

// ── KYC section ───────────────────────────────────────────────────────────

async function loadKycSection() {
  const el      = document.getElementById('kyc-section');
  const badgeEl = document.getElementById('kyc-badge');

  const { data: records } = await supabaseClient
    .from('kyc_records')
    .select('*')
    .eq('contact_id', supplierId)
    .order('updated_at', { ascending: false })
    .limit(1);

  const k = records?.[0];

  if (!k) {
    gateStatus.kyc = false;
    badgeEl.innerHTML = '<span class="badge badge-danger">No KYC record</span>';
    el.innerHTML = `
      <div class="check-item">
        ${failIcon()}
        <div>
          <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:var(--space-2)">No KYC record exists for this supplier.</div>
          <p style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-3)">Create a KYC record before completing compliance review. You can create one here or go to the full KYC module.</p>
          <button class="btn btn-primary btn-sm" onclick="showKycCreateForm()">Create KYC Record</button>
          <a href="../kyc/index.html" class="btn btn-ghost btn-sm" style="margin-left:var(--space-2)">Open KYC Module →</a>
        </div>
      </div>
      <div id="kyc-create-form" style="display:none;margin-top:var(--space-4);padding:var(--space-5);border:1px solid var(--color-border);border-radius:var(--radius-sm)">
        ${buildKycForm()}
      </div>`;
    return;
  }

  const STATUS_CLASS = { approved:'badge-success', in_progress:'badge-info', pending:'badge-warning', rejected:'badge-danger', expired:'badge-neutral' };
  const RISK_CLASS   = { low:'badge-success', medium:'badge-warning', high:'badge-danger', unrated:'badge-neutral' };
  const isPending    = k.kyc_status === 'pending';
  const isApproved   = k.kyc_status === 'approved' || k.kyc_status === 'in_progress';

  gateStatus.kyc = isApproved;
  badgeEl.innerHTML = `<span class="badge ${STATUS_CLASS[k.kyc_status]||'badge-neutral'}">${esc(k.kyc_status?.replace('_',' '))}</span>`;

  el.innerHTML = `
    <div class="check-item" style="background:${isApproved ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)'}">
      ${isApproved ? passIcon() : (isPending ? warnIcon() : failIcon())}
      <div style="flex:1">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-3);font-size:var(--text-sm)">
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Status</div>
            <span class="badge ${STATUS_CLASS[k.kyc_status]||'badge-neutral'}">${esc(k.kyc_status?.replace('_',' '))}</span></div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Risk Rating</div>
            <span class="badge ${RISK_CLASS[k.risk_rating]||'badge-neutral'}">${esc(k.risk_rating||'unrated')}</span></div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Last Screened</div>${fmtDate(k.last_screened_date)}</div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Next Review</div>${fmtDate(k.next_review_date)}</div>
        </div>
        ${k.notes ? `<p style="font-size:var(--text-sm);color:var(--color-text-muted);margin:var(--space-2) 0 0">${esc(k.notes)}</p>` : ''}
        ${isPending ? `<p style="font-size:var(--text-sm);color:var(--color-text-muted);margin:var(--space-3) 0 0">KYC status is "Pending". Update it to "In Progress" or "Approved" to satisfy this requirement.</p>
          <a href="../kyc/detail.html?id=${esc(k.id)}" class="btn btn-ghost btn-sm" style="margin-top:var(--space-2);border:1px solid var(--color-border)">Update KYC Record →</a>` : ''}
        ${!isPending && !isApproved ? `<p style="font-size:var(--text-sm);color:var(--color-danger);margin:var(--space-3) 0 0">KYC status "${k.kyc_status}" does not meet the minimum compliance requirement. Please review.</p>` : ''}
      </div>
    </div>`;
}

function buildKycForm() {
  const today = new Date().toISOString().split('T')[0];
  const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1);
  return `
    <div style="display:flex;flex-direction:column;gap:var(--space-4)">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="kyc-status-new">KYC Status <span class="required">*</span></label>
          <select class="form-select" id="kyc-status-new">
            <option value="in_progress">In Progress</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="kyc-risk-new">Risk Rating</label>
          <select class="form-select" id="kyc-risk-new">
            <option value="unrated">Unrated</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="kyc-screened-new">Last Screened Date</label>
          <input type="date" class="form-input" id="kyc-screened-new" value="${today}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="kyc-review-new">Next Review Date</label>
          <input type="date" class="form-input" id="kyc-review-new" value="${nextYear.toISOString().split('T')[0]}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="kyc-notes-new">Notes</label>
        <textarea class="form-textarea" id="kyc-notes-new" rows="3" placeholder="Due diligence findings, PEP screening results, beneficial owner verification…"></textarea>
      </div>
      <div id="kyc-create-error" style="display:none;color:var(--color-danger);font-size:var(--text-sm)"></div>
      <button class="btn btn-primary btn-sm" onclick="submitKycCreate()">Create KYC Record</button>
    </div>`;
}

function showKycCreateForm() {
  document.getElementById('kyc-create-form').style.display = 'block';
  document.querySelector('[onclick="showKycCreateForm()"]').style.display = 'none';
}

async function submitKycCreate() {
  const errEl = document.getElementById('kyc-create-error');
  errEl.style.display = 'none';
  const { error } = await supabaseClient.from('kyc_records').insert({
    contact_id:         supplierId,
    kyc_status:         document.getElementById('kyc-status-new').value,
    risk_rating:        document.getElementById('kyc-risk-new').value,
    last_screened_date: document.getElementById('kyc-screened-new').value || null,
    next_review_date:   document.getElementById('kyc-review-new').value || null,
    notes:              document.getElementById('kyc-notes-new').value.trim() || null,
  });
  if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }

  await OnboardingWorkflow.logEvent(supplierId, onboardingId, 'kyc_linked',
    'KYC record created and linked during compliance review.',
    {}
  );
  await loadKycSection();
  updateSummary();
}

// ── Sanctions section ─────────────────────────────────────────────────────

async function loadSanctionsSection() {
  const el      = document.getElementById('sanctions-section');
  const badgeEl = document.getElementById('sanctions-badge');

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  const { data: screens } = await supabaseClient
    .from('sanctions_screens')
    .select('id, screened_at, lists_screened, tool_used, result, match_resolution_notes')
    .eq('subject_id', supplierId)
    .order('screened_at', { ascending: false })
    .limit(1);

  const latest = screens?.[0];
  const isCurrent = latest && new Date(latest.screened_at) >= cutoff;
  const RESULT_CLASS = { clear:'badge-success', potential_match:'badge-warning', confirmed_match:'badge-danger' };

  gateStatus.sanctions = isCurrent && latest.result !== 'confirmed_match';

  if (!latest) {
    badgeEl.innerHTML = '<span class="badge badge-danger">No screen on file</span>';
    el.innerHTML = `
      <div class="check-item">
        ${failIcon()}
        <div>
          <p style="font-size:var(--text-sm);margin:0">No sanctions screening record exists for this supplier. A screen must be recorded (in the Risk Assessment step or the Sanctions Log) before compliance review can be completed.</p>
          <a href="../sanctions/log.html" class="btn btn-ghost btn-sm" style="margin-top:var(--space-3);border:1px solid var(--color-border)">Go to Sanctions Log →</a>
        </div>
      </div>`;
    return;
  }

  if (!isCurrent) {
    badgeEl.innerHTML = '<span class="badge badge-warning">Screen overdue</span>';
  } else if (latest.result === 'confirmed_match') {
    badgeEl.innerHTML = '<span class="badge badge-danger">Confirmed match</span>';
  } else {
    badgeEl.innerHTML = '<span class="badge badge-success">Current</span>';
  }

  const icon = (!isCurrent || latest.result === 'confirmed_match') ? warnIcon() : passIcon();
  const age  = Math.floor((Date.now() - new Date(latest.screened_at)) / 86400000);

  el.innerHTML = `
    <div class="check-item" style="background:${gateStatus.sanctions ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)'}">
      ${icon}
      <div style="flex:1">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-3);font-size:var(--text-sm)">
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Date</div>${fmtDate(latest.screened_at)} (${age}d ago)</div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Result</div>
            <span class="badge ${RESULT_CLASS[latest.result]||'badge-neutral'}">${esc(latest.result?.replace('_',' '))}</span></div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Lists</div>${(latest.lists_screened||[]).join(', ')||'—'}</div>
          ${latest.tool_used ? `<div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Tool</div>${esc(latest.tool_used)}</div>` : ''}
        </div>
        ${latest.match_resolution_notes ? `<p style="font-size:var(--text-sm);color:var(--color-text-muted);margin:var(--space-2) 0 0">${esc(latest.match_resolution_notes)}</p>` : ''}
        ${!isCurrent ? `<p style="font-size:var(--text-sm);color:#d97706;margin:var(--space-3) 0 0">This screen is more than 12 months old. A new screen is required before proceeding.</p>
          <a href="../sanctions/log.html" class="btn btn-ghost btn-sm" style="margin-top:var(--space-2);border:1px solid var(--color-border)">Record New Screen →</a>` : ''}
        ${latest.result === 'confirmed_match' ? `<p style="font-size:var(--text-sm);color:var(--color-danger);margin:var(--space-3) 0 0">A confirmed sanctions match was recorded. This onboarding cannot proceed without Director review and documented resolution.</p>` : ''}
      </div>
    </div>`;
}

// ── Beneficial owner section ──────────────────────────────────────────────

async function loadBoSection() {
  const el      = document.getElementById('bo-section');
  const badgeEl = document.getElementById('bo-badge');

  const { data: contact } = await supabaseClient
    .from('contacts')
    .select('beneficial_owner, company_name')
    .eq('id', supplierId)
    .single();

  const bo = contact?.beneficial_owner?.trim();

  if (!bo) {
    badgeEl.innerHTML = '<span class="badge badge-warning">Not recorded</span>';
    el.innerHTML = `
      <div class="check-item">
        ${warnIcon()}
        <div style="flex:1">
          <p style="font-size:var(--text-sm);margin:0 0 var(--space-3)">No beneficial owner recorded on the supplier record. Record the beneficial owner(s) before proceeding — this is required for AML compliance.</p>
          <div style="display:flex;gap:var(--space-3);align-items:flex-end">
            <div class="form-group" style="flex:1;margin:0">
              <label class="form-label" for="bo-input">Beneficial Owner(s)</label>
              <input type="text" class="form-input" id="bo-input" placeholder="Full name(s) of beneficial owner(s)" />
            </div>
            <button class="btn btn-primary btn-sm" onclick="saveBoField()">Save</button>
          </div>
          <div id="bo-save-msg" style="display:none;margin-top:var(--space-2);font-size:var(--text-sm)"></div>
        </div>
      </div>`;
    return;
  }

  badgeEl.innerHTML = '<span class="badge badge-success">Recorded</span>';
  el.innerHTML = `
    <div class="check-item" style="background:rgba(22,163,74,0.04)">
      ${passIcon()}
      <div style="flex:1">
        <div style="font-size:var(--text-sm);font-weight:600">${esc(bo)}</div>
        <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin:4px 0 0">Beneficial owner recorded on supplier record. Confirm this has been verified against government-issued ID as part of your KYC due diligence.</p>
        <label style="display:flex;gap:var(--space-3);align-items:center;margin-top:var(--space-3);cursor:pointer;font-size:var(--text-sm)">
          <input type="checkbox" id="bo-confirmed" style="accent-color:var(--color-accent)" onchange="updateSummary()" />
          I confirm beneficial owner identity has been verified.
        </label>
      </div>
    </div>`;
}

async function saveBoField() {
  const bo    = document.getElementById('bo-input')?.value.trim();
  const msgEl = document.getElementById('bo-save-msg');
  if (!bo) { msgEl.textContent = 'Please enter the beneficial owner name.'; msgEl.style.display = 'block'; return; }

  const { error } = await supabaseClient.from('contacts').update({ beneficial_owner: bo }).eq('id', supplierId);
  if (error) { msgEl.style.color = 'var(--color-danger)'; msgEl.textContent = error.message; msgEl.style.display = 'block'; return; }

  await loadBoSection();
  updateSummary();
}

// ── Summary and completion ────────────────────────────────────────────────

function updateSummary() {
  const boConfirmed = document.getElementById('bo-confirmed')?.checked ?? true;
  const allPassed   = gateStatus.kyc && gateStatus.sanctions;

  const summaryEl = document.getElementById('summary-section');
  const items = [
    { label: 'KYC record on file (status not "Pending")',         pass: gateStatus.kyc },
    { label: 'Sanctions screen on file and dated within 12 months', pass: gateStatus.sanctions },
    { label: 'Beneficial owner identity confirmed',               pass: boConfirmed },
  ];

  const ICON = pass => pass
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;

  summaryEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-3)">
      ${items.map(i => `
        <div style="display:flex;gap:var(--space-3);align-items:center;font-size:var(--text-sm)">
          ${ICON(i.pass)}
          <span style="color:${i.pass ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}">${i.label}</span>
        </div>`).join('')}
    </div>
    ${allPassed && boConfirmed
      ? `<div style="margin-top:var(--space-4);padding:var(--space-3) var(--space-4);background:rgba(22,163,74,0.06);border:1px solid rgba(22,163,74,0.2);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--color-success)">
          All compliance checks passed. You may advance to the Recommendation stage.
        </div>`
      : `<div style="margin-top:var(--space-4);padding:var(--space-3) var(--space-4);background:rgba(220,38,38,0.04);border:1px solid rgba(220,38,38,0.15);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--color-text-muted)">
          Complete all items above before advancing.
        </div>`}`;

  document.getElementById('advance-btn').disabled = !(allPassed && boConfirmed);
}

async function advanceToRecommendation() {
  const errEl = document.getElementById('form-error');
  errEl.style.display = 'none';

  const result = await OnboardingWorkflow.advanceStage(onboardingId, 'recommendation');
  if (!result.ok) {
    errEl.innerHTML = '<strong>Cannot advance yet:</strong><br>' + result.blockers.join('<br>');
    errEl.style.display = 'block';
    return;
  }

  await OnboardingWorkflow.logEvent(supplierId, onboardingId, 'kyc_linked',
    'Compliance review completed. KYC and sanctions confirmed. Advanced to Recommendation stage.',
    { from_stage: 'compliance', to_stage: 'recommendation' }
  );

  location.href = `detail.html?id=${supplierId}`;
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
    document.getElementById('topbar-title').textContent = `Compliance Review — ${supplier.company_name}`;
    document.title = `Compliance Review — ${supplier.company_name}`;
  }

  const detailUrl = `detail.html?id=${supplierId}`;
  document.getElementById('back-link').href  = detailUrl;
  document.getElementById('cancel-link').href = detailUrl;

  await Promise.all([loadKycSection(), loadSanctionsSection(), loadBoSection()]);
  updateSummary();
})();
