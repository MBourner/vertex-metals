/**
 * Vertex Metals Portal — Supplier Onboarding Workflow
 *
 * Shared module loaded on every portal page that participates in the
 * supplier onboarding lifecycle.
 *
 * Exposes a single global: OnboardingWorkflow
 *
 * Load order on each consuming page:
 *   supabase-client.js → auth.js → auth-roles.js → sidebar.js
 *   → portal-guard.js → supplier-onboarding.js → [page script]
 */

const OnboardingWorkflow = (() => {

  // ── Stage definitions ─────────────────────────────────────────────────────

  const STAGE_SEQUENCE = [
    'intake', 'screening', 'documents', 'compliance',
    'recommendation', 'pending_approval', 'activated'
  ];

  const STAGE_LABELS = {
    intake:           'Intake',
    screening:        'Screening & Risk',
    documents:        'Documents',
    compliance:       'Compliance Review',
    recommendation:   'Recommendation',
    pending_approval: 'Pending Approval',
    activated:        'Activated',
    rejected:         'Rejected'
  };

  const STAGE_BADGE = {
    intake:           'badge-neutral',
    screening:        'badge-info',
    documents:        'badge-info',
    compliance:       'badge-warning',
    recommendation:   'badge-warning',
    pending_approval: 'badge-warning',
    activated:        'badge-success',
    rejected:         'badge-danger'
  };

  // Stages shown in the 5-step progress bar (activation is the implicit finish)
  const PROGRESS_STAGES = [
    'intake', 'screening', 'documents', 'compliance', 'recommendation', 'pending_approval'
  ];

  // ── Audit trail helper ────────────────────────────────────────────────────

  async function logEvent(supplierId, onboardingId, eventType, description, meta = {}) {
    const user = await getCurrentUser();
    const roles = PortalRoles.getRoles();
    const actorRole = roles.includes('director_commercial') ? 'director_commercial'
                    : roles.includes('director_compliance')  ? 'director_compliance'
                    : 'director';
    const { error } = await supabaseClient.from('supplier_audit_trail').insert({
      supplier_id:   supplierId,
      onboarding_id: onboardingId || null,
      event_type:    eventType,
      actor_id:      user?.id || null,
      actor_role:    actorRole,
      description,
      metadata:      Object.keys(meta).length ? meta : null
    });
    if (error) console.warn('[OnboardingWorkflow] audit log failed:', error.message);
  }

  // ── Stage gate validation ─────────────────────────────────────────────────

  async function checkGates(onboarding, contact, targetStage) {
    const blockers = [];

    if (targetStage === 'screening') {
      if (!contact.company_registration_number?.trim())
        blockers.push('Company registration / incorporation number is required');
      if (!contact.supplier_type)
        blockers.push('Supplier type must be set');
      if (!contact.primary_contact_name?.trim())
        blockers.push('Primary contact name is required');
      if (!contact.email?.trim())
        blockers.push('Contact email address is required');
      if (!onboarding.risk_level)
        blockers.push('Initial risk category must be assigned');
    }

    if (targetStage === 'documents') {
      const { count: raCount } = await supabaseClient
        .from('supplier_risk_assessment')
        .select('id', { count: 'exact', head: true })
        .eq('onboarding_id', onboarding.id);
      if (!raCount)
        blockers.push('Risk assessment must be completed before collecting documents');

      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      const { count: ssCount } = await supabaseClient
        .from('sanctions_screens')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', onboarding.contact_id)
        .gte('screened_at', cutoff.toISOString());
      if (!ssCount)
        blockers.push('A sanctions screen dated within the last 12 months is required');
    }

    if (targetStage === 'compliance') {
      const { count: docCount } = await supabaseClient
        .from('supplier_documents')
        .select('id', { count: 'exact', head: true })
        .eq('onboarding_id', onboarding.id)
        .eq('is_current', true)
        .eq('not_applicable', false);
      if (!docCount)
        blockers.push('At least one document must be uploaded before proceeding to compliance review');
    }

    if (targetStage === 'recommendation') {
      const { count: kycCount } = await supabaseClient
        .from('kyc_records')
        .select('id', { count: 'exact', head: true })
        .eq('contact_id', onboarding.contact_id)
        .neq('kyc_status', 'pending');
      if (!kycCount)
        blockers.push('A completed KYC record must be on file before submitting a recommendation');

      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      const { count: ssCount } = await supabaseClient
        .from('sanctions_screens')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', onboarding.contact_id)
        .gte('screened_at', cutoff.toISOString());
      if (!ssCount)
        blockers.push('A current sanctions screen (within 12 months) must be on file');
    }

    if (targetStage === 'pending_approval') {
      if (!onboarding.recommendation)
        blockers.push('A recommendation must be submitted before requesting approval');
      if (!onboarding.recommendation_rationale)
        blockers.push('Recommendation rationale is required');
    }

    if (targetStage === 'activated') {
      if (!onboarding.decision)
        blockers.push('A final approval decision must be recorded');
      if (!onboarding.decision_justification)
        blockers.push('Decision justification is required');
    }

    return { passed: blockers.length === 0, blockers };
  }

  // ── Stage transition ──────────────────────────────────────────────────────

  async function advanceStage(onboardingId, targetStage) {
    const { data: ob, error: obErr } = await supabaseClient
      .from('supplier_onboarding').select('*').eq('id', onboardingId).single();
    if (obErr || !ob) return { ok: false, blockers: ['Onboarding record not found'] };

    const { data: contact, error: cErr } = await supabaseClient
      .from('contacts').select('*').eq('id', ob.contact_id).single();
    if (cErr || !contact) return { ok: false, blockers: ['Supplier contact record not found'] };

    const gates = await checkGates(ob, contact, targetStage);
    if (!gates.passed) return { ok: false, blockers: gates.blockers };

    const updateData = { workflow_stage: targetStage, updated_at: new Date().toISOString() };
    if (targetStage === 'activated') updateData.activated_at = new Date().toISOString();

    const { error: upErr } = await supabaseClient
      .from('supplier_onboarding').update(updateData).eq('id', onboardingId);
    if (upErr) return { ok: false, blockers: [upErr.message] };

    // Keep contacts.approval_status in sync
    const approvalStatus = targetStage === 'activated'
      ? (ob.decision === 'approved_with_conditions' ? 'conditionally_approved' : 'approved')
      : targetStage === 'rejected' ? 'rejected'
      : 'under_review';
    await supabaseClient.from('contacts').update({ approval_status: approvalStatus }).eq('id', ob.contact_id);

    await logEvent(ob.contact_id, onboardingId, 'stage_advanced',
      `Stage advanced from '${ob.workflow_stage}' to '${targetStage}'`,
      { from_stage: ob.workflow_stage, to_stage: targetStage }
    );

    return { ok: true };
  }

  async function rejectOnboarding(onboardingId, atStage, reason) {
    const { data: ob } = await supabaseClient
      .from('supplier_onboarding').select('contact_id').eq('id', onboardingId).single();
    if (!ob) return { ok: false, error: 'Onboarding record not found' };

    const { error } = await supabaseClient.from('supplier_onboarding').update({
      workflow_stage: 'rejected', updated_at: new Date().toISOString()
    }).eq('id', onboardingId);
    if (error) return { ok: false, error: error.message };

    await supabaseClient.from('contacts').update({ approval_status: 'rejected' }).eq('id', ob.contact_id);

    await logEvent(ob.contact_id, onboardingId, 'rejection_decision',
      `Onboarding rejected at stage '${atStage}': ${reason}`,
      { stage: atStage, reason }
    );
    return { ok: true };
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  function stageLabel(stage)      { return STAGE_LABELS[stage]  || stage; }
  function stageBadgeClass(stage) { return STAGE_BADGE[stage]   || 'badge-neutral'; }
  function stageIndex(stage)      { return STAGE_SEQUENCE.indexOf(stage); }

  // Returns an HTML string — progress bar across all 6 active stages
  function renderProgressSteps(currentStage) {
    const rejected  = currentStage === 'rejected';
    const activated = currentStage === 'activated';
    const currentIdx = PROGRESS_STAGES.indexOf(currentStage);

    return `<div style="display:flex;gap:0;align-items:flex-start;margin:var(--space-4) 0">
      ${PROGRESS_STAGES.map((stage, i) => {
        let state = 'pending';
        if (activated || (currentIdx > i))       state = 'done';
        else if (!rejected && currentIdx === i)   state = 'active';

        const bg    = state === 'done'   ? 'var(--color-success)'
                    : state === 'active' ? 'var(--color-accent)'
                    : 'var(--color-border)';
        const color = state === 'done'   ? 'var(--color-success)'
                    : state === 'active' ? 'var(--color-accent)'
                    : 'var(--color-text-muted)';
        return `<div style="flex:1;text-align:center;min-width:0">
          <div style="height:3px;background:${bg};margin-bottom:var(--space-2)"></div>
          <div style="font-family:var(--font-display);font-size:10px;font-weight:600;
            letter-spacing:0.04em;text-transform:uppercase;color:${color};
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            padding:0 2px">${STAGE_LABELS[stage]}</div>
        </div>`;
      }).join('')}
    </div>`;
  }

  // Inline blockers list — used to show what's preventing advancement
  function renderBlockers(blockers) {
    if (!blockers || !blockers.length) return '';
    return `<div style="margin-top:var(--space-3);padding:var(--space-3) var(--space-4);
      background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.2);
      border-radius:var(--radius-sm)">
      <div style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;
        text-transform:uppercase;letter-spacing:0.08em;color:var(--color-danger);
        margin-bottom:var(--space-2)">Before advancing:</div>
      <ul style="margin:0;padding-left:var(--space-4);font-size:var(--text-sm);color:var(--color-danger)">
        ${blockers.map(b => `<li>${b}</li>`).join('')}
      </ul>
    </div>`;
  }

  return {
    logEvent,
    advanceStage,
    rejectOnboarding,
    checkGates,
    stageLabel,
    stageBadgeClass,
    stageIndex,
    renderProgressSteps,
    renderBlockers,
    STAGE_SEQUENCE,
    STAGE_LABELS
  };

})();
