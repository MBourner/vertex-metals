/**
 * Vertex Metals Portal — Supplier Detail
 * Handles portal/suppliers/detail.html
 */

function esc(s) { if (s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n,dp=2) { if (n==null||isNaN(n)) return '—'; return Number(n).toLocaleString('en-GB',{minimumFractionDigits:dp,maximumFractionDigits:dp}); }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }

const supplierId = new URLSearchParams(location.search).get('id');
const _tabLoaded = {};

function switchTab(name) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  if (!_tabLoaded[name]) { _tabLoaded[name] = true; loadTabData(name); }
}

async function loadTabData(name) {
  if (name === 'onboarding')  loadOnboarding();
  if (name === 'audits')      loadAudits();
  if (name === 'orders')      loadOrders();
  if (name === 'concessions') loadConcessions();
  if (name === 'disputes')    loadDisputes();
  if (name === 'sanctions')   loadSanctions();
  if (name === 'kyc')         loadKyc();
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

// ── Onboarding tab ────────────────────────────────────────────────────────

async function loadOnboarding() {
  const el = document.getElementById('tab-onboarding');

  // Load the most recent onboarding record (active or last completed)
  const { data: obs, error: obErr } = await supabaseClient
    .from('supplier_onboarding')
    .select('*')
    .eq('contact_id', supplierId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (obErr) { el.innerHTML = `<div class="alert alert-error">${esc(obErr.message)}</div>`; return; }

  const isCommercial  = PortalRoles.getRoles().includes('director_commercial');
  const isCompliance  = PortalRoles.getRoles().includes('director_compliance');

  if (!obs || obs.length === 0) {
    el.innerHTML = `
      <div style="padding:var(--space-6);text-align:center">
        <p style="color:var(--color-text-muted);margin-bottom:var(--space-4)">No onboarding process has been started for this supplier.</p>
        ${isCommercial ? `<a href="onboard.html?supplier_id=${esc(supplierId)}" class="btn btn-primary btn-sm">Start Onboarding</a>` : ''}
      </div>`;
    return;
  }

  const ob = obs[0]; // most recent
  const stageBadge  = OnboardingWorkflow.stageBadgeClass(ob.workflow_stage);
  const stageText   = OnboardingWorkflow.stageLabel(ob.workflow_stage);
  const isRejected  = ob.workflow_stage === 'rejected';
  const isActivated = ob.workflow_stage === 'activated';
  const isActive    = !isRejected && !isActivated;

  // Stage-aware action buttons
  let advanceHtml = '';
  if (isActive) {
    const rejectBtn = `<button class="btn btn-ghost btn-sm" style="color:var(--color-danger);border-color:var(--color-danger)"
      onclick="openRejectModal('${esc(ob.id)}','${esc(ob.workflow_stage)}')">Reject</button>`;

    if (ob.workflow_stage === 'intake' && isCommercial) {
      // Direct advance — intake is just the form, no separate page needed
      advanceHtml = `<div style="display:flex;gap:var(--space-3);margin-top:var(--space-4)">
        <button class="btn btn-primary btn-sm" onclick="advanceOnboardingStage('${esc(ob.id)}','screening')">
          Confirm Intake &amp; Assign for Vetting →
        </button>${rejectBtn}</div>`;

    } else if (ob.workflow_stage === 'screening' && isCompliance) {
      advanceHtml = `<div style="display:flex;gap:var(--space-3);margin-top:var(--space-4)">
        <a href="risk-assessment.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}" class="btn btn-primary btn-sm">
          Complete Risk Assessment &amp; Sanctions →
        </a>${rejectBtn}</div>`;

    } else if (ob.workflow_stage === 'documents' && isCompliance) {
      advanceHtml = `<div style="display:flex;gap:var(--space-3);margin-top:var(--space-4)">
        <a href="documents.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}" class="btn btn-primary btn-sm">
          Manage Document Checklist →
        </a>${rejectBtn}</div>`;

    } else if (ob.workflow_stage === 'compliance' && isCompliance) {
      advanceHtml = `<div style="display:flex;gap:var(--space-3);margin-top:var(--space-4)">
        <a href="compliance-review.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(ob.id)}" class="btn btn-primary btn-sm">
          Complete Compliance Review →
        </a>${rejectBtn}</div>`;
    }
    // recommendation and pending_approval stages are handled inline below (forms already rendered)
  }

  // Recommendation panel (shown to Martyn at 'recommendation' stage)
  const showRecommendationForm = isCompliance && ob.workflow_stage === 'recommendation' && !ob.recommendation;
  const showDecisionForm = isCommercial && ob.workflow_stage === 'pending_approval' && !ob.decision;

  // Audit trail for this onboarding
  const { data: trail } = await supabaseClient
    .from('supplier_audit_trail')
    .select('occurred_at, event_type, description, actor_role')
    .eq('onboarding_id', ob.id)
    .order('occurred_at', { ascending: false })
    .limit(20);

  const trailHtml = (trail && trail.length > 0)
    ? `<div style="margin-top:var(--space-6)">
        <div style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-3)">Onboarding Timeline</div>
        <div style="display:flex;flex-direction:column;gap:var(--space-2)">
          ${trail.map(t => `
            <div style="display:flex;gap:var(--space-3);align-items:baseline;font-size:var(--text-sm)">
              <span style="white-space:nowrap;color:var(--color-text-muted);font-size:var(--text-xs);min-width:110px">${fmtDate(t.occurred_at)}</span>
              <span style="color:var(--color-text-muted);font-size:var(--text-xs);min-width:80px">${esc(t.actor_role?.replace('_',' ') || '—')}</span>
              <span>${esc(t.description)}</span>
            </div>`).join('')}
        </div>
      </div>`
    : '';

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

        ${showRecommendationForm ? buildRecommendationForm(ob.id) : ''}
        ${showDecisionForm ? buildDecisionForm(ob.id, ob.recommendation) : ''}

        ${isRejected && isCommercial ? `
          <div style="margin-top:var(--space-4);padding:var(--space-3);background:rgba(220,38,38,0.06);border-radius:var(--radius-sm)">
            <p style="font-size:var(--text-sm);margin:0 0 var(--space-2)">This onboarding was rejected. You can start a new onboarding process for this supplier if circumstances have changed.</p>
            <a href="onboard.html?supplier_id=${esc(supplierId)}" class="btn btn-sm btn-ghost" style="border:1px solid var(--color-border)">Start New Onboarding</a>
          </div>` : ''}

        ${trailHtml}
        ${prevHtml}
      </div>
    </div>`;
}

function buildRecommendationForm(onboardingId) {
  return `
    <div style="margin-top:var(--space-5);padding:var(--space-5);border:1px solid var(--color-border);border-radius:var(--radius-sm)">
      <div style="font-family:var(--font-display);font-size:var(--text-sm);font-weight:600;margin-bottom:var(--space-4)">Submit Vetting Recommendation</div>
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div class="form-group">
          <label class="form-label" for="rec-decision">Recommendation <span class="required">*</span></label>
          <select class="form-select" id="rec-decision">
            <option value="">Select recommendation…</option>
            <option value="approve">Approve</option>
            <option value="approve_with_conditions">Approve with Conditions</option>
            <option value="reject">Reject</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="rec-rationale">Rationale <span class="required">*</span></label>
          <textarea class="form-textarea" id="rec-rationale" rows="4" placeholder="Summarise the vetting findings and the basis for your recommendation. This is recorded in the ISO 9001 audit trail and reviewed by Jackson."></textarea>
        </div>
        <div class="form-group" id="rec-conditions-group" style="display:none">
          <label class="form-label" for="rec-conditions">Conditions (one per line)</label>
          <textarea class="form-textarea" id="rec-conditions" rows="3" placeholder="List any conditions that must be satisfied…"></textarea>
        </div>
        <div id="rec-error" style="display:none;color:var(--color-danger);font-size:var(--text-sm)"></div>
        <div>
          <button class="btn btn-primary btn-sm" onclick="submitRecommendation('${esc(onboardingId)}')">Submit Recommendation</button>
        </div>
      </div>
    </div>
    <script>
      document.getElementById('rec-decision').addEventListener('change', function() {
        document.getElementById('rec-conditions-group').style.display =
          this.value === 'approve_with_conditions' ? 'block' : 'none';
      });
    <\/script>`;
}

function buildDecisionForm(onboardingId, complianceRec) {
  const recNote = complianceRec
    ? `<div style="margin-bottom:var(--space-4);padding:var(--space-3);background:var(--color-surface);border-radius:var(--radius-sm);font-size:var(--text-sm)">Compliance recommendation: <strong>${complianceRec.replace(/_/g,' ')}</strong></div>`
    : '';
  return `
    <div style="margin-top:var(--space-5);padding:var(--space-5);border:1px solid var(--color-accent);border-radius:var(--radius-sm)">
      <div style="font-family:var(--font-display);font-size:var(--text-sm);font-weight:600;margin-bottom:var(--space-4)">Final Approval Decision</div>
      ${recNote}
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div class="form-group">
          <label class="form-label" for="dec-decision">Decision <span class="required">*</span></label>
          <select class="form-select" id="dec-decision">
            <option value="">Select decision…</option>
            <option value="approved">Approved</option>
            <option value="approved_with_conditions">Approved with Conditions</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="dec-justification">Justification <span class="required">*</span></label>
          <textarea class="form-textarea" id="dec-justification" rows="4" placeholder="Your independent assessment and the basis for your decision. This is your own rationale — not a restatement of Martyn's recommendation."></textarea>
        </div>
        <div id="dec-error" style="display:none;color:var(--color-danger);font-size:var(--text-sm)"></div>
        <div>
          <button class="btn btn-primary btn-sm" onclick="submitDecision('${esc(onboardingId)}')">Record Decision</button>
        </div>
      </div>
    </div>`;
}

async function advanceOnboardingStage(onboardingId, targetStage) {
  const result = await OnboardingWorkflow.advanceStage(onboardingId, targetStage);
  if (!result.ok) {
    const el = document.getElementById('tab-onboarding');
    const blockerHtml = OnboardingWorkflow.renderBlockers(result.blockers);
    // Show blockers at top of tab
    const existing = el.querySelector('.blocker-notice');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'blocker-notice';
    div.innerHTML = blockerHtml;
    el.prepend(div);
    return;
  }
  _tabLoaded.onboarding = false;
  loadOnboarding();
}

async function openRejectModal(onboardingId, currentStage) {
  const reason = prompt(`Rejecting at stage "${OnboardingWorkflow.stageLabel(currentStage)}".\n\nEnter rejection reason (required):`);
  if (!reason || !reason.trim()) return;
  const result = await OnboardingWorkflow.rejectOnboarding(onboardingId, currentStage, reason.trim());
  if (!result.ok) { alert('Error: ' + result.error); return; }
  _tabLoaded.onboarding = false;
  loadOnboarding();
}

async function submitRecommendation(onboardingId) {
  const decision   = document.getElementById('rec-decision')?.value;
  const rationale  = document.getElementById('rec-rationale')?.value.trim();
  const conditions = document.getElementById('rec-conditions')?.value.trim();
  const errEl      = document.getElementById('rec-error');

  if (!decision || !rationale) {
    errEl.textContent = 'Recommendation and rationale are required.';
    errEl.style.display = 'block';
    return;
  }

  const user = await getCurrentUser();
  const { error } = await supabaseClient.from('supplier_onboarding').update({
    recommendation:               decision,
    recommendation_rationale:     rationale,
    conditions_summary:           conditions || null,
    recommendation_submitted_at:  new Date().toISOString(),
    workflow_stage:               'pending_approval',
    updated_at:                   new Date().toISOString(),
  }).eq('id', onboardingId);

  if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }

  // Write approval record
  await supabaseClient.from('supplier_approvals').insert({
    supplier_id:    supplierId,
    onboarding_id:  onboardingId,
    approval_stage: 'recommendation',
    approver_id:    user?.id,
    approver_role:  'director_compliance',
    decision:       decision,
    justification:  rationale,
    conditions:     conditions || null,
  });

  await OnboardingWorkflow.logEvent(supplierId, onboardingId, 'recommendation_submitted',
    `Compliance recommendation submitted: "${decision.replace(/_/g,' ')}". Rationale: ${rationale.slice(0, 120)}${rationale.length > 120 ? '…' : ''}`,
    { recommendation: decision }
  );

  _tabLoaded.onboarding = false;
  loadOnboarding();
}

async function submitDecision(onboardingId) {
  const decision      = document.getElementById('dec-decision')?.value;
  const justification = document.getElementById('dec-justification')?.value.trim();
  const errEl         = document.getElementById('dec-error');

  if (!decision || !justification) {
    errEl.textContent = 'Decision and justification are required.';
    errEl.style.display = 'block';
    return;
  }

  const user = await getCurrentUser();
  const targetStage = decision === 'rejected' ? 'rejected' : 'activated';
  const activatedAt = targetStage === 'activated' ? new Date().toISOString() : null;

  const { error } = await supabaseClient.from('supplier_onboarding').update({
    decision,
    decision_justification: justification,
    decision_by:            user?.id,
    decision_at:            new Date().toISOString(),
    workflow_stage:         targetStage,
    activated_at:           activatedAt,
    updated_at:             new Date().toISOString(),
  }).eq('id', onboardingId);

  if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }

  // Write approval record
  await supabaseClient.from('supplier_approvals').insert({
    supplier_id:    supplierId,
    onboarding_id:  onboardingId,
    approval_stage: 'final_approval',
    approver_id:    user?.id,
    approver_role:  'director_commercial',
    decision,
    justification,
  });

  // Sync contacts.approval_status
  const newStatus = decision === 'rejected' ? 'rejected'
                  : decision === 'approved_with_conditions' ? 'conditionally_approved'
                  : 'approved';
  await supabaseClient.from('contacts').update({
    approval_status: newStatus,
    approved_at:     targetStage === 'activated' ? new Date().toISOString() : null,
    approved_by:     targetStage === 'activated' ? user?.id : null,
  }).eq('id', supplierId);

  await OnboardingWorkflow.logEvent(supplierId, onboardingId,
    targetStage === 'activated' ? 'approval_decision' : 'rejection_decision',
    `Final decision recorded by Director (Commercial): "${decision.replace(/_/g,' ')}". ${justification.slice(0, 120)}${justification.length > 120 ? '…' : ''}`,
    { decision }
  );

  _tabLoaded.onboarding = false;
  location.reload(); // reload to reflect new approval_status in header
}

// ─────────────────────────────────────────────────────────────────────────────

async function loadAudits() {
  const el = document.getElementById('tab-audits');
  const { data, error } = await supabaseClient.from('supplier_audits').select('*').eq('supplier_id', supplierId).order('audit_date', { ascending: false });
  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!data || data.length === 0) {
    el.innerHTML = `<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No audit records.</p><a href="audit.html?supplier_id=${esc(supplierId)}" class="btn btn-primary btn-sm" style="margin-top:var(--space-3)">Record First Audit</a>`;
    return;
  }
  const outcomeClass = { approved:'badge-success', approved_with_conditions:'badge-warning', not_approved:'badge-danger' };
  el.innerHTML = `<div style="margin-bottom:var(--space-4);text-align:right"><a href="audit.html?supplier_id=${esc(supplierId)}" class="btn btn-primary btn-sm">+ Record Audit</a></div>
  <div class="table-wrapper"><table><thead><tr><th>Date</th><th>Type</th><th>Auditor</th><th>Outcome</th><th>Next Due</th><th>Conditions</th></tr></thead><tbody>
  ${data.map(a => `<tr>
    <td style="font-size:var(--text-sm)">${fmtDate(a.audit_date)}</td>
    <td style="font-size:var(--text-sm)">${esc(a.audit_type?.replace('_',' '))}</td>
    <td style="font-size:var(--text-sm)">${esc(a.auditor_name)}</td>
    <td><span class="badge ${outcomeClass[a.outcome]||'badge-neutral'}">${esc(a.outcome?.replace(/_/g,' '))}</span></td>
    <td style="font-size:var(--text-sm)">${fmtDate(a.next_audit_due_date)}</td>
    <td style="font-size:var(--text-sm);max-width:200px">${esc(a.conditions || '—')}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

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
  const { data, error } = await supabaseClient.from('concessions').select('*, trade:trades(reference, product)').eq('trades.supplier_id', supplierId);
  // Filter client-side since Supabase doesn't support nested eq filter this way
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

async function loadSanctions() {
  const el = document.getElementById('tab-sanctions');
  const { data, error } = await supabaseClient.from('sanctions_screens').select('*').eq('subject_id', supplierId).order('screened_at', { ascending: false });
  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!data || data.length === 0) { el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No sanctions screens recorded.</p>'; return; }
  const resultClass = { clear:'badge-success', potential_match:'badge-warning', confirmed_match:'badge-danger' };
  el.innerHTML = `<div class="table-wrapper"><table><thead><tr><th>Date</th><th>Lists Screened</th><th>Tool</th><th>Result</th><th>Notes</th></tr></thead><tbody>
  ${data.map(s => `<tr>
    <td style="font-size:var(--text-sm)">${fmtDate(s.screened_at)}</td>
    <td style="font-size:var(--text-sm)">${(s.lists_screened||[]).join(', ')||'—'}</td>
    <td style="font-size:var(--text-sm)">${esc(s.tool_used||'—')}</td>
    <td><span class="badge ${resultClass[s.result]||'badge-neutral'}">${esc(s.result?.replace('_',' '))}</span></td>
    <td style="font-size:var(--text-sm)">${esc(s.match_resolution_notes||'—')}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

async function loadKyc() {
  const el = document.getElementById('tab-kyc');
  const { data, error } = await supabaseClient.from('kyc_records').select('*').eq('contact_id', supplierId).limit(1);
  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!data || data.length === 0) {
    el.innerHTML = `<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No KYC record. <a href="../kyc/index.html">Add one in KYC Records →</a></p>`;
    return;
  }
  const k = data[0];
  const statusClass = { approved:'badge-success', in_progress:'badge-info', pending:'badge-warning', rejected:'badge-danger', expired:'badge-danger' };
  const riskClass = { low:'badge-success', medium:'badge-warning', high:'badge-danger', unrated:'badge-neutral' };
  el.innerHTML = `<div class="panel"><div class="panel-body"><table style="width:100%"><tbody>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0;width:35%">Status</td><td><span class="badge ${statusClass[k.kyc_status]||'badge-neutral'}">${esc(k.kyc_status)}</span></td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Risk Rating</td><td><span class="badge ${riskClass[k.risk_rating]||'badge-neutral'}">${esc(k.risk_rating)}</span></td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Last Screened</td><td>${fmtDate(k.last_screened_date)}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Next Review</td><td>${fmtDate(k.next_review_date)}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Notes</td><td style="font-size:var(--text-sm)">${esc(k.notes||'—')}</td></tr>
  </tbody></table>
  <div style="margin-top:var(--space-4)"><a href="../kyc/detail.html?id=${esc(k.id)}" class="btn btn-ghost btn-sm">Open KYC Record →</a></div>
  </div></div>`;
}

(async () => {
  if (!supplierId) { document.body.innerHTML = '<p style="padding:2rem">No supplier ID specified.</p>'; return; }
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  await StateMachine.loadReference();

  const { data: supplier, error } = await supabaseClient.from('contacts').select('*').eq('id', supplierId).single();
  if (error || !supplier) { document.body.innerHTML = `<p style="padding:2rem;color:var(--color-danger)">Supplier not found.</p>`; return; }

  document.getElementById('topbar-title').textContent = supplier.company_name;
  document.title = `${supplier.company_name} — Vertex Metals Portal`;

  const approvalCls = APPROVAL_CLASS[supplier.approval_status] || 'badge-neutral';
  document.getElementById('supplier-header').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:var(--space-4)">
      <div>
        <h1 style="margin:0 0 var(--space-2)">${esc(supplier.company_name)}</h1>
        <div style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap">
          <span class="badge ${approvalCls}">${esc((supplier.approval_status || 'prospect').replace(/_/g, ' '))}</span>
          ${supplier.country ? `<span style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(supplier.country)}</span>` : ''}
          ${supplier.email ? `<a href="mailto:${esc(supplier.email)}" style="font-size:var(--text-sm);color:var(--color-accent)">${esc(supplier.email)}</a>` : ''}
        </div>
      </div>
      <a href="audit.html?supplier_id=${esc(supplierId)}" class="btn btn-primary btn-sm">Record Audit</a>
    </div>
    <div style="margin-top:var(--space-4);display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-4);font-size:var(--text-sm)">
      <div><div style="color:var(--color-text-muted);margin-bottom:2px">Phone</div>${esc(supplier.phone||'—')}</div>
      <div><div style="color:var(--color-text-muted);margin-bottom:2px">Website</div>${supplier.website?`<a href="${esc(supplier.website)}" target="_blank" style="color:var(--color-accent)">${esc(supplier.website)}</a>`:'—'}</div>
      <div><div style="color:var(--color-text-muted);margin-bottom:2px">Last Sanctions Screen</div>${fmtDate(supplier.last_sanctions_screened_at)} <span style="color:var(--color-text-muted)">(${supplier.last_sanctions_result||'—'})</span></div>
      <div><div style="color:var(--color-text-muted);margin-bottom:2px">Next Audit Due</div>${fmtDate(supplier.next_audit_due_date)}</div>
    </div>
    ${supplier.notes ? `<div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--color-surface);border-radius:var(--radius-sm);font-size:var(--text-sm)">${esc(supplier.notes)}</div>` : ''}
  `;

  // Show a flash banner if arriving from a fresh onboarding creation
  if (new URLSearchParams(location.search).get('onboarding_new') === '1') {
    const banner = document.createElement('div');
    banner.style.cssText = 'margin-bottom:var(--space-4);padding:var(--space-3) var(--space-4);background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.2);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--color-success)';
    banner.textContent = 'Onboarding created. Assigned to compliance director for vetting.';
    document.querySelector('.portal-content').prepend(banner);
    setTimeout(() => banner.remove(), 6000);
  }

  _tabLoaded.onboarding = true;
  loadOnboarding();
})();
