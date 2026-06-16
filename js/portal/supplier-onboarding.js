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
  //
  // 3-phase model: Stage 1 (Quoting Only) → Stage 2 (Pre-Trade) → Stage 3
  // (Trade Ready). 'rejected' is a terminal state reachable from any
  // non-terminal stage.

  const STAGE_SEQUENCE = [
    'draft', 'pending_compliance', 'stage1_complete', 'pending_stage2',
    'awaiting_supplier_info', 'stage2_complete', 'trade_ready'
  ];

  const STAGE_LABELS = {
    draft:                  'Draft',
    pending_compliance:     'Pending Compliance Review',
    stage1_complete:        'Stage 1 Complete (Ready to Quote)',
    pending_stage2:         'Pending Stage 2',
    awaiting_supplier_info: 'Awaiting Supplier Info',
    stage2_complete:        'Stage 2 Complete',
    trade_ready:            'Trade Ready',
    rejected:               'Rejected'
  };

  // Pipeline column labels — same as STAGE_LABELS except the pipeline's
  // "not yet started" column is labelled from the team's perspective.
  const PIPELINE_COLUMN_LABELS = { ...STAGE_LABELS, draft: 'Pending Stage 1' };

  const STAGE_BADGE = {
    draft:                  'badge-neutral',
    pending_compliance:     'badge-warning',
    stage1_complete:        'badge-info',
    pending_stage2:         'badge-warning',
    awaiting_supplier_info: 'badge-warning',
    stage2_complete:        'badge-success',
    trade_ready:            'badge-success',
    rejected:               'badge-danger'
  };

  // Stages shown in the progress bar (trade_ready is the finish line)
  const PROGRESS_STAGES = [
    'draft', 'pending_compliance', 'stage1_complete', 'pending_stage2', 'stage2_complete', 'trade_ready'
  ];

  // ── Supplier-type profiles ──────────────────────────────────────────────
  //
  // Single declarative config per supplier type. Consolidates what was
  // previously a set of separate type-based conditionals scattered across
  // onboard.js, pre-trade.js and documents.js: diligence tier (full AML/CFT
  // programme vs simplified track), Stage 1 QMS/export-licence field
  // visibility, required onboarding documents, and which risk-assessment
  // criteria apply. Add new supplier types here only — consuming pages read
  // from this config rather than branching on supplier_type themselves.

  // All possible risk-assessment criteria. A given supplier type scores a
  // subset of these (see SUPPLIER_TYPE_PROFILES[type].riskCriteria below).
  const RISK_CRITERIA = ['financial', 'quality', 'regulatory', 'geographic', 'continuity'];

  const RISK_CRITERIA_LABELS = {
    financial:  'Financial Viability',
    quality:    'Quality Certification',
    regulatory: 'Regulatory Compliance',
    geographic: 'Geographic Risk',
    continuity: 'Supply Continuity',
  };

  const RISK_CRITERIA_COLUMN = {
    financial:  'financial_viability',
    quality:    'quality_certification',
    regulatory: 'regulatory_compliance',
    geographic: 'geographic_risk',
    continuity: 'supply_continuity',
  };

  // Relative importance (out of 100) of each criterion in the weighted
  // overall score. For a given supplier type only the weights of its
  // applicable riskCriteria are used, re-normalised over that subset — so
  // dropping a criterion redistributes its weight proportionally rather
  // than leaving it unscored. Defaults reflect Vertex's AML/CFT priorities
  // (financial-integrity and regulatory/sanctions risk weighted highest);
  // adjust here if a different balance is wanted — see DEVELOPMENT.md.
  const RISK_CRITERIA_WEIGHTS = {
    financial:  25,
    quality:    15,
    regulatory: 25,
    geographic: 15,
    continuity: 20,
  };

  const SUPPLIER_TYPE_PROFILES = {
    manufacturing: {
      diligenceTier:     'full',
      showQms:           true,
      showExportLicence: true,
      riskCriteria:      ['financial', 'quality', 'regulatory', 'geographic', 'continuity'],
      requiredDocs:      ['business_registration', 'beneficial_owner_declaration', 'tax_certificate', 'quality_cert', 'audit_report', 'dpa'],
    },
    materials_commodities: {
      diligenceTier:     'full',
      showQms:           true,
      showExportLicence: true,
      riskCriteria:      ['financial', 'quality', 'regulatory', 'geographic', 'continuity'],
      requiredDocs:      ['business_registration', 'beneficial_owner_declaration', 'tax_certificate', 'quality_cert', 'dpa'],
    },
    // Supply continuity (capacity / single-source / logistics infrastructure)
    // describes Vertex's exposure to a materials supplier's production — not
    // a meaningful criterion for a logistics provider's own risk profile.
    logistics: {
      diligenceTier:     'simplified',
      showQms:           true,
      showExportLicence: false,
      riskCriteria:      ['financial', 'quality', 'regulatory', 'geographic'],
      requiredDocs:      ['business_registration', 'beneficial_owner_declaration', 'tax_certificate', 'dpa'],
    },
    // Packaging suppliers aren't assessed on quality-management certification
    // (the Stage 1 QMS field is hidden for this type) or supply continuity.
    packaging: {
      diligenceTier:     'simplified',
      showQms:           false,
      showExportLicence: false,
      riskCriteria:      ['financial', 'regulatory', 'geographic'],
      requiredDocs:      ['business_registration', 'beneficial_owner_declaration', 'tax_certificate', 'dpa'],
    },
    service_provider: {
      diligenceTier:     'simplified',
      showQms:           true,
      showExportLicence: false,
      riskCriteria:      ['financial', 'quality', 'regulatory', 'geographic'],
      requiredDocs:      ['business_registration', 'beneficial_owner_declaration', 'tax_certificate', 'dpa'],
    },
  };

  // ── Products Offered review (Stage 1a → Stage 1b) ───────────────────────
  //
  // supplier_quotes rows added during Stage 1a registration carry an
  // onboarding_review_status ('pending_review' | 'approved' | 'rejected'),
  // set/updated by compliance during Stage 1b. NULL means the link wasn't
  // created via the onboarding flow (e.g. added later from the supplier
  // detail page's Products tab) and isn't part of this review.

  const PRODUCT_REVIEW_LABELS = {
    pending_review: 'Pending Review',
    approved:        'Approved',
    rejected:        'Rejected',
  };

  const PRODUCT_REVIEW_BADGE = {
    pending_review: 'badge-warning',
    approved:        'badge-success',
    rejected:        'badge-danger',
  };

  // ── Additive compliance risk scoring (Phase A: factor model) ─────────────
  //
  // Replaces the 1–5 weighted supplier_risk_assessment model. Each factor is
  // selected by the compliance director and contributes an additive score.
  // Factor groups apply per supplier type (see COMPLIANCE_FACTOR_GROUPS_BY_TYPE).
  // 'controls' credits are applied only once verified in Stage 2 (§3.5).
  //
  // Score → rating band: 0–20 Low Risk · 21–40 Medium Risk · 41–60 High Risk ·
  // 61+ Very High Risk · Sanctions hit → Prohibited (hard reject, non-overridable).

  const COMPLIANCE_FACTORS = {
    corporate_risk: [
      { key: 'trading_gt10y',             label: '>10 years trading',                          score:  -5 },
      { key: 'trading_3_10y',             label: '3–10 years trading',                         score:   0 },
      { key: 'trading_lt3y',              label: '<3 years trading',                            score: +10 },
      { key: 'trading_lt1y',              label: '<1 year trading',                             score: +20 },
      { key: 'simple_ownership',          label: 'Simple ownership structure',                  score:   0 },
      { key: 'multiple_holding',          label: 'Multiple holding companies',                  score: +10 },
      { key: 'offshore_complex',          label: 'Complex offshore structure',                  score: +20 },
      { key: 'ubo_verified',              label: 'Beneficial owners verified',                  score:   0 },
      { key: 'ubo_incomplete',            label: 'UBO verification incomplete',                 score: +15 },
      { key: 'ubo_cannot_identify',       label: 'Cannot identify UBO',                        score: +50 },
    ],
    jurisdiction_risk: [
      { key: 'jurisdiction_low',          label: 'Low-risk jurisdiction',                       score:   0 },
      { key: 'jurisdiction_medium',       label: 'Medium-risk jurisdiction',                    score: +10 },
      { key: 'jurisdiction_high',         label: 'High-risk jurisdiction',                      score: +25 },
    ],
    product_risk: [
      { key: 'standard_metals',           label: 'Standard industrial metals',                  score:   0 },
      { key: 'metal_concentrates',        label: 'Metal concentrates',                          score: +10 },
      { key: 'precious_metals',           label: 'Precious metals',                             score: +20 },
      { key: 'conflict_minerals',         label: 'Conflict-sensitive minerals',                 score: +25 },
      { key: 'dual_use',                  label: 'Dual-use materials',                          score: +25 },
    ],
    screening_results: [
      { key: 'screening_clear',           label: 'Clean screening',                             score:   0 },
      { key: 'minor_adverse_media',       label: 'Minor adverse media',                         score: +10 },
      { key: 'significant_adverse_media', label: 'Significant adverse media',                  score: +30 },
      { key: 'sanctions_match',           label: 'Sanctions match', score: null, autoReject: true },
    ],
    controls: [
      { key: 'iso_9001_verified',         label: 'ISO 9001 (verified)',                         score:  -5 },
      { key: 'publicly_listed',           label: 'Publicly listed company',                     score: -10 },
      { key: 'major_intl_customers',      label: 'Existing major international customers',      score:  -5 },
      { key: 'audited_financials',        label: 'Audited financial statements',                score:  -5 },
    ],
  };

  // Factor groups that apply per supplier type. product_risk is only meaningful
  // for goods suppliers (manufacturing / materials_commodities). controls credits
  // apply to all except packaging (no quality system to verify).
  const COMPLIANCE_FACTOR_GROUPS_BY_TYPE = {
    manufacturing:         ['corporate_risk', 'jurisdiction_risk', 'product_risk', 'screening_results', 'controls'],
    materials_commodities: ['corporate_risk', 'jurisdiction_risk', 'product_risk', 'screening_results', 'controls'],
    logistics:             ['corporate_risk', 'jurisdiction_risk', 'screening_results', 'controls'],
    packaging:             ['corporate_risk', 'jurisdiction_risk', 'screening_results'],
    service_provider:      ['corporate_risk', 'jurisdiction_risk', 'screening_results', 'controls'],
  };

  const COMPLIANCE_BANDS = [
    { max: 20,       band: 'Low Risk'       },
    { max: 40,       band: 'Medium Risk'    },
    { max: 60,       band: 'High Risk'      },
    { max: Infinity, band: 'Very High Risk' },
  ];

  // ── Commercial suitability scoring (additive) ─────────────────────────────
  //
  // Independent second axis: "how valuable is this supplier to Vertex?"
  // Six factor groups, one selection each (radio). Score → band:
  // 0–30 Poor Fit · 31–60 Moderate Fit · 61–80 Strong Fit · 81+ Strategic.

  const COMMERCIAL_FACTORS = {
    product_fit: [
      { key: 'fit_core',          label: 'Core strategic',            score: 25 },
      { key: 'fit_adjacent',      label: 'Adjacent',                  score: 15 },
      { key: 'fit_opportunistic', label: 'Opportunistic',             score:  5 },
    ],
    buyer_demand: [
      { key: 'demand_existing',   label: 'Existing buyer demand',     score: 25 },
      { key: 'demand_strong',     label: 'Strong expected demand',    score: 15 },
      { key: 'demand_unknown',    label: 'Unknown',                   score:  5 },
    ],
    volume_capability: [
      { key: 'vol_large',         label: 'Large',                     score: 20 },
      { key: 'vol_medium',        label: 'Medium',                    score: 10 },
      { key: 'vol_small',         label: 'Small',                     score:  5 },
    ],
    export_capability: [
      { key: 'exp_experienced',   label: 'Experienced exporter',      score: 15 },
      { key: 'exp_some',          label: 'Some export history',       score: 10 },
      { key: 'exp_domestic',      label: 'Domestic only',             score:  0 },
    ],
    quality_certs: [
      { key: 'qual_iso9001',      label: 'ISO 9001',                  score: 10 },
      { key: 'qual_qms',          label: 'Documented QMS',            score:  5 },
      { key: 'qual_none',         label: 'None',                      score:  0 },
    ],
    responsiveness: [
      { key: 'resp_good',         label: 'Responsive & professional', score: 10 },
      { key: 'resp_avg',          label: 'Average',                   score:  5 },
      { key: 'resp_poor',         label: 'Poor',                      score:  0 },
    ],
  };

  const COMMERCIAL_BANDS = [
    { max: 30,       band: 'Poor Fit'           },
    { max: 60,       band: 'Moderate Fit'       },
    { max: 80,       band: 'Strong Fit'         },
    { max: Infinity, band: 'Strategic Supplier' },
  ];

  // ── Decision matrix ───────────────────────────────────────────────────────
  //
  // Compliance band × Commercial band → recommendation string.
  // Very High Risk and Prohibited are off-matrix — handled separately.
  // Commercial columns: High = Strong Fit + Strategic Supplier (61+) ·
  // Medium = Moderate Fit (31–60) · Low = Poor Fit (0–30).

  const DECISION_MATRIX = {
    'Low Risk':    { high_commercial: 'Excellent Target',          medium_commercial: 'Good Target',    low_commercial: 'Optional'    },
    'Medium Risk': { high_commercial: 'Proceed with Controls',     medium_commercial: 'Case-by-Case',   low_commercial: 'Usually No'  },
    'High Risk':   { high_commercial: 'Exceptional Approval Only', medium_commercial: 'Usually No',     low_commercial: 'Reject'      },
  };

  function _commercialColumn(band) {
    if (band === 'Strategic Supplier' || band === 'Strong Fit') return 'high_commercial';
    if (band === 'Moderate Fit') return 'medium_commercial';
    return 'low_commercial';
  }

  function computeComplianceScore(factorKeys, supplierType) {
    const groups = COMPLIANCE_FACTOR_GROUPS_BY_TYPE[supplierType] || Object.keys(COMPLIANCE_FACTORS);
    let total = 0, prohibited = false;
    const components = [];
    for (const group of groups) {
      for (const factor of (COMPLIANCE_FACTORS[group] || [])) {
        if (!factorKeys.includes(factor.key)) continue;
        if (factor.autoReject) { prohibited = true; continue; }
        total += factor.score;
        components.push({ group, factor_key: factor.key, label: factor.label, score: factor.score });
      }
    }
    if (prohibited) return { total: null, band: 'Prohibited', components, prohibited: true };
    const band = COMPLIANCE_BANDS.find(b => total <= b.max)?.band || 'Very High Risk';
    return { total, band, components, prohibited: false };
  }

  function computeCommercialScore(factorKeys) {
    let total = 0;
    const components = [];
    for (const [group, factors] of Object.entries(COMMERCIAL_FACTORS)) {
      for (const factor of factors) {
        if (!factorKeys.includes(factor.key)) continue;
        total += factor.score;
        components.push({ group, factor_key: factor.key, label: factor.label, score: factor.score });
      }
    }
    const band = COMMERCIAL_BANDS.find(b => total <= b.max)?.band || 'Strategic Supplier';
    return { total, band, components };
  }

  function matrixRecommendation(complianceBand, commercialBand) {
    if (complianceBand === 'Prohibited')
      return 'Prohibited — Hard Reject';
    if (complianceBand === 'Very High Risk')
      return 'Very High Risk — Default Reject (joint exceptional approval required)';
    return DECISION_MATRIX[complianceBand]?.[_commercialColumn(commercialBand)] || 'Unknown';
  }

  function getSupplierProfile(supplierType) {
    return SUPPLIER_TYPE_PROFILES[supplierType] || SUPPLIER_TYPE_PROFILES.service_provider;
  }

  function requiresFullDiligence(supplierType) {
    return getSupplierProfile(supplierType).diligenceTier === 'full';
  }

  function getRiskCriteria(supplierType) {
    return getSupplierProfile(supplierType).riskCriteria;
  }

  function getRequiredDocs(supplierType) {
    return getSupplierProfile(supplierType).requiredDocs;
  }

  // "Before you begin" checklists shown on onboard.html / pre-trade.html so
  // staff can gather what's needed before starting Stage 1 / Stage 2 — kept
  // in sync with checkGates() by deriving from the same supplier-type profile
  // rather than maintaining a separate static list.
  function buildStage1aPrerequisites(supplierType) {
    const profile = getSupplierProfile(supplierType);
    const items = [
      'Legal company name, registration/incorporation number, country, and VAT/GST number',
      "Primary contact name, email and phone, plus the company's main phone number",
    ];
    if (profile.showQms) {
      items.push('Quality management system status (e.g. ISO 9001), plus certificate reference and expiry if held');
    }
    if (profile.showExportLicence) {
      items.push("Export licence number, if applicable in the supplier's jurisdiction");
    }
    items.push("Not needed yet — sanctions screening, preliminary risk assessment, bank details, ESG information and Terms of Business are covered later in the onboarding process");
    return items;
  }

  function buildStage2Prerequisites(supplierType) {
    const profile = getSupplierProfile(supplierType);
    const items = [
      "Bank account details — account name, account number/IBAN, sort code or SWIFT/BIC, and bank name — plus confirmation the account is held in the registered company's name",
      'ESG/environmental information — whether an ESG policy is in place, carbon reporting availability, and environmental permit details if applicable',
    ];
    if (profile.diligenceTier === 'full') {
      items.push('A current sanctions screen (re-screen if the Stage 1 screen is more than 12 months old)');
      items.push("Review of the Stage 1 preliminary risk assessment");
    }
    items.push('Information to support the vetting recommendation and final decision sign-off');
    return items;
  }

  // Maps a (criteria, scores, notes) triple — aligned arrays for the
  // criteria applicable to one supplier type — onto the full
  // supplier_risk_assessment column set. Criteria not applicable to the
  // supplier's type are stored as null rather than scored.
  function buildRiskScorePayload(criteria, scores, notes) {
    const payload = {};
    RISK_CRITERIA.forEach(c => {
      const idx = criteria.indexOf(c);
      payload[`${RISK_CRITERIA_COLUMN[c]}_score`] = idx >= 0 ? scores[idx] : null;
      payload[`${RISK_CRITERIA_COLUMN[c]}_notes`]  = idx >= 0 ? (notes[idx] || null) : null;
    });
    return payload;
  }

  // Weighted average of `scores` (aligned with `criteria`) using
  // RISK_CRITERIA_WEIGHTS, normalised over whichever of those criteria have
  // a score. Returns null if none are scored.
  function computeOverall(scores, criteria) {
    let weightedSum = 0, weightTotal = 0;
    scores.forEach((score, i) => {
      if (score == null) return;
      const w = RISK_CRITERIA_WEIGHTS[criteria[i]] || 0;
      weightedSum += score * w;
      weightTotal += w;
    });
    return weightTotal ? weightedSum / weightTotal : null;
  }

  const RISK_CATEGORY_ORDER = { low: 0, medium: 1, high: 2 };

  function riskCategoryFromScore(score) {
    if (score === null || score === undefined) return null;
    if (score <= 2.3) return 'low';
    if (score <= 3.6) return 'medium';
    return 'high';
  }

  // Category from the weighted overall score, escalated to a floor of
  // 'medium' if any single criterion scores 4/5, or 'high' if any scores
  // 5/5 (e.g. a sanctions-listed/FATF-blacklisted jurisdiction for geographic
  // risk). A single severe red flag should not be diluted away by that
  // criterion's weighting in the overall average. Pass `scores` (the raw
  // 1-5 array) to apply the floor; omit it to get the unescalated category.
  function riskCategory(overall, scores) {
    let category = riskCategoryFromScore(overall);
    if (category === null) return null;
    if (scores && scores.length) {
      const maxScore = Math.max(...scores.filter(s => s != null), 0);
      const floor = maxScore >= 5 ? 'high' : maxScore >= 4 ? 'medium' : null;
      if (floor && RISK_CATEGORY_ORDER[floor] > RISK_CATEGORY_ORDER[category]) category = floor;
    }
    return category;
  }

  // ── Reference numbers ─────────────────────────────────────────────────────

  function generateSupplierReference() {
    const year = new Date().getFullYear();
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 5; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
    return `VS-${year}-${suffix}`;
  }

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

    if (targetStage === 'pending_compliance') {
      if (!contact.company_name?.trim())
        blockers.push('Company name is required');
      if (!contact.company_registration_number?.trim())
        blockers.push('Company registration / incorporation number is required');
      if (!contact.country?.trim())
        blockers.push('Country of registration is required');
      if (!contact.supplier_type)
        blockers.push('Supplier type must be set');
      if (!contact.primary_contact_name?.trim())
        blockers.push('Primary contact name is required');
      if (!contact.email?.trim())
        blockers.push('Contact email address is required');
      if (!contact.supplier_reference?.trim())
        blockers.push('Supplier reference must be generated');
      if (!contact.qms_certification && getSupplierProfile(contact.supplier_type).showQms)
        blockers.push('Quality management system status must be recorded');
    }

    if (targetStage === 'stage1_complete') {
      if (onboarding.workflow_stage !== 'pending_compliance')
        blockers.push('Basic company information must be submitted for compliance review before Stage 1 can be completed');

      const { count: ssCount } = await supabaseClient
        .from('sanctions_screens')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', onboarding.contact_id);
      if (!ssCount)
        blockers.push('A sanctions screening result must be recorded');

      // Accept either the legacy 1–5 RA row (pre-Phase B) or the new
      // additive compliance score row (Phase B+). Both satisfy the gate.
      const [{ count: raCount }, { count: csCount }] = await Promise.all([
        supabaseClient
          .from('supplier_risk_assessment')
          .select('id', { count: 'exact', head: true })
          .eq('onboarding_id', onboarding.id),
        supabaseClient
          .from('supplier_compliance_scores')
          .select('id', { count: 'exact', head: true })
          .eq('onboarding_id', onboarding.id)
          .eq('gate', 1),
      ]);
      if (!raCount && !csCount)
        blockers.push('A compliance risk assessment must be completed');

      const { count: pendingProductsCount } = await supabaseClient
        .from('supplier_quotes')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', onboarding.contact_id)
        .eq('onboarding_review_status', 'pending_review');
      if (pendingProductsCount)
        blockers.push('All products offered must be reviewed (approved or rejected) before Stage 1 can be completed');

      // Gate 1 dual-director approval. Only enforced once the new flow is in
      // use (i.e. at least one Gate 1 approval row exists). In-flight onboardings
      // from before this model was introduced are not blocked.
      const { data: gate1Rows } = await supabaseClient
        .from('supplier_approvals')
        .select('approval_stage, decision')
        .eq('onboarding_id', onboarding.id)
        .in('approval_stage', ['gate1_compliance', 'gate1_commercial']);
      if (gate1Rows && gate1Rows.length > 0) {
        const g1Compliance = gate1Rows.find(r => r.approval_stage === 'gate1_compliance');
        const g1Commercial = gate1Rows.find(r => r.approval_stage === 'gate1_commercial');
        if (!g1Compliance)
          blockers.push('Compliance director (Gate 1) approval is required');
        else if (g1Compliance.decision === 'reject')
          blockers.push('Compliance director has rejected this supplier at Gate 1');
        if (!g1Commercial)
          blockers.push('Commercial director (Gate 1) approval is required');
        else if (g1Commercial.decision === 'reject')
          blockers.push('Commercial director has rejected this supplier at Gate 1');
      }
    }

    if (targetStage === 'pending_stage2') {
      if (!['stage1_complete', 'awaiting_supplier_info'].includes(onboarding.workflow_stage))
        blockers.push('Stage 1 must be complete before starting Stage 2');
    }

    // 'awaiting_supplier_info' is a voluntary pause from pending_stage2 — no hard gates.

    if (targetStage === 'stage2_complete') {
      if (onboarding.tob_status !== 'confirmed')
        blockers.push('Terms of Business must be generated, sent, and confirmed');

      // Gate 2 dual-director approval (replaces the old single recommendation/decision pair).
      const { data: gate2Rows } = await supabaseClient
        .from('supplier_approvals')
        .select('approval_stage, decision')
        .eq('onboarding_id', onboarding.id)
        .in('approval_stage', ['gate2_compliance', 'gate2_commercial']);
      const g2Compliance = gate2Rows?.find(r => r.approval_stage === 'gate2_compliance');
      const g2Commercial = gate2Rows?.find(r => r.approval_stage === 'gate2_commercial');
      if (!g2Compliance)
        blockers.push('Compliance director (Gate 2) approval is required');
      else if (g2Compliance.decision === 'reject')
        blockers.push('Compliance director has rejected this supplier at Gate 2');
      if (!g2Commercial)
        blockers.push('Commercial director (Gate 2) approval is required');
      else if (g2Commercial.decision === 'reject')
        blockers.push('Commercial director has rejected this supplier at Gate 2');

      if (requiresFullDiligence(contact.supplier_type)) {
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
    }

    if (targetStage === 'trade_ready') {
      if (onboarding.workflow_stage !== 'stage2_complete')
        blockers.push('Stage 2 must be complete before final sign-off');
      if (!contact.accepted_currencies?.length)
        blockers.push('At least one accepted currency must be selected');
      if (!contact.default_currency)
        blockers.push('A default currency must be selected');
      if (!contact.payment_terms_initial?.trim())
        blockers.push('Initial payment terms are required');
      if (!contact.payment_terms_subsequent?.trim())
        blockers.push('Subsequent payment terms are required');
      if (!contact.standard_incoterm)
        blockers.push('A standard incoterm must be selected');

      const { count: dpaCount } = await supabaseClient
        .from('supplier_documents')
        .select('id', { count: 'exact', head: true })
        .eq('onboarding_id', onboarding.id)
        .eq('document_type', 'dpa')
        .eq('is_current', true);
      if (!dpaCount)
        blockers.push('A current Data Processing Agreement (DPA) must be on file');

      // Bank details moved from Stage 2 gate to here (Stage 3 / Payment Setup).
      if (!contact.bank_account_number?.trim() && !contact.bank_iban?.trim())
        blockers.push('Bank account number or IBAN is required before final sign-off');
      if (contact.bank_account_verified_in_name !== true)
        blockers.push('Bank account must be confirmed as held in the registered company name');
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
    if (targetStage === 'stage2_complete') updateData.activated_at = new Date().toISOString();

    const { error: upErr } = await supabaseClient
      .from('supplier_onboarding').update(updateData).eq('id', onboardingId);
    if (upErr) return { ok: false, blockers: [upErr.message] };

    // Keep contacts.approval_status in sync
    const approvalStatus = targetStage === 'stage2_complete'
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

  async function resumeFromAwaitingInfo(onboardingId) {
    const { data: ob, error: obErr } = await supabaseClient
      .from('supplier_onboarding').select('contact_id, workflow_stage').eq('id', onboardingId).single();
    if (obErr || !ob) return { ok: false, blockers: ['Onboarding record not found'] };

    const { error } = await supabaseClient.from('supplier_onboarding').update({
      workflow_stage: 'pending_stage2', updated_at: new Date().toISOString()
    }).eq('id', onboardingId);
    if (error) return { ok: false, blockers: [error.message] };

    await logEvent(ob.contact_id, onboardingId, 'stage_advanced',
      `Stage advanced from '${ob.workflow_stage}' to 'pending_stage2'`,
      { from_stage: ob.workflow_stage, to_stage: 'pending_stage2' }
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

  // ── Terms of Business (TOB) ───────────────────────────────────────────────
  //
  // buildTobHtml() returns placeholder/boilerplate text. The gating logic
  // (tob_status === 'confirmed') is independent of the template content, so
  // the real TOB document can be swapped in later without code changes.

  function buildTobHtml(contact, onboarding) {
    const addressLines = [contact.address_line_1, contact.address_line_2, contact.city, contact.postcode, contact.country]
      .filter(Boolean).join(', ');

    const placeholderBanner = `<div style="background:#fffbe6;border:2px solid #e0c200;padding:12px 16px;
      font-family:sans-serif;font-size:13px;font-weight:bold;text-align:center;margin-bottom:16px">
      PLACEHOLDER — pending final Terms of Business document
    </div>`;

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Terms of Business — ${esc(contact.company_name || '')}</title>
<style>
  body { font-family: 'DM Sans', Arial, sans-serif; color: #0a1728; margin: 40px; line-height: 1.5; }
  h1 { font-family: Georgia, serif; font-size: 22px; border-bottom: 2px solid #7ab8d4; padding-bottom: 8px; }
  h2 { font-size: 15px; margin-top: 24px; }
  .meta { color: #555; font-size: 13px; margin-bottom: 24px; }
  .print-btn { margin: 16px 0; padding: 8px 16px; cursor: pointer; }
  @media print { .print-btn, .banner { display: none; } }
</style></head>
<body>
  <div class="banner">${placeholderBanner}</div>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  <h1>Vertex Metals Ltd — Terms of Business</h1>
  <div class="meta">
    Supplier: <strong>${esc(contact.company_name || '')}</strong> (${esc(contact.supplier_reference || '')})<br>
    Registration No: ${esc(contact.company_registration_number || '—')}<br>
    Registered Address: ${esc(addressLines || '—')}<br>
    Supplier Type: ${esc(contact.supplier_type || '—')}
  </div>

  <h2>1. Parties</h2>
  <p>This agreement is made between Vertex Metals Ltd, Apartment 3, Falcon Cliff Apartments, 9–10 Palace Road,
  Douglas, Isle of Man, IM2 4LD ("Vertex Metals") and ${esc(contact.company_name || 'the Supplier')}
  ("the Supplier").</p>

  <h2>2. Payment Terms</h2>
  <p>Initial orders: ${esc(contact.payment_terms_initial || '[to be agreed]')}.
  Subsequent orders: ${esc(contact.payment_terms_subsequent || '[to be agreed]')}.
  Standard Incoterm: ${esc(contact.standard_incoterm || '[to be agreed]')}.</p>

  <h2>3. Confidentiality</h2>
  <p>Each party agrees to keep confidential all commercial, technical, and pricing information disclosed
  by the other party in connection with this agreement, and not to disclose such information to any
  third party without prior written consent.</p>

  <h2>4. Quality &amp; Compliance</h2>
  <p>The Supplier warrants that all goods supplied will conform to the agreed specification and
  certifications, and that it will maintain all licences, permits, and quality certifications required
  to lawfully supply the goods.</p>

  <h2>5. Disputes</h2>
  <p>Any dispute arising out of or in connection with this agreement shall first be referred to
  good-faith negotiation between the parties' authorised representatives before either party pursues
  formal proceedings.</p>

  <h2>6. Governing Law</h2>
  <p>This agreement shall be governed by, and construed in accordance with, the laws of the Isle of Man.</p>

  <div class="banner" style="margin-top:32px">${placeholderBanner}</div>
</body></html>`;
  }

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  async function markTobGenerated(onboardingId, supplierId) {
    const { error } = await supabaseClient.from('supplier_onboarding').update({
      tob_status: 'generated', tob_generated_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', onboardingId);
    if (error) return { ok: false, error: error.message };
    await logEvent(supplierId, onboardingId, 'tob_generated', 'Terms of Business document generated');
    return { ok: true };
  }

  async function markTobSent(onboardingId, supplierId) {
    const { error } = await supabaseClient.from('supplier_onboarding').update({
      tob_status: 'sent', tob_sent_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', onboardingId);
    if (error) return { ok: false, error: error.message };
    await logEvent(supplierId, onboardingId, 'tob_sent', 'Terms of Business sent to supplier');
    return { ok: true };
  }

  async function markTobConfirmed(onboardingId, supplierId) {
    const { error } = await supabaseClient.from('supplier_onboarding').update({
      tob_status: 'confirmed', tob_confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', onboardingId);
    if (error) return { ok: false, error: error.message };
    await logEvent(supplierId, onboardingId, 'tob_confirmed', 'Terms of Business agreement confirmed by supplier');
    return { ok: true };
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  function stageLabel(stage)      { return STAGE_LABELS[stage]  || stage; }
  function stageBadgeClass(stage) { return STAGE_BADGE[stage]   || 'badge-neutral'; }
  function stageIndex(stage)      { return STAGE_SEQUENCE.indexOf(stage); }
  function pipelineColumnLabel(stage) { return PIPELINE_COLUMN_LABELS[stage] || stage; }

  // ── Permissions / readiness (derived, read-only — Phase 1) ───────────────
  //
  // Lightweight switchboard computed on the fly from existing onboarding and
  // contact state — no new tables. A manual-override UI with reason logging
  // (EvidenceEvents-style) is a Phase 2 schema item — see DEVELOPMENT.md.

  // Header lifecycle badge — broader than workflow_stage alone, since
  // approval_status carries post-onboarding states (suspended/delisted)
  // that workflow_stage doesn't model.
  function lifecycleStatus(contact, onboarding) {
    if (contact?.approval_status === 'suspended') return { label: 'Suspended', badgeClass: 'badge-danger' };
    if (contact?.approval_status === 'delisted')  return { label: 'Delisted',  badgeClass: 'badge-danger' };

    const stage = onboarding?.workflow_stage;
    if (!stage)                      return { label: 'Prospect',         badgeClass: 'badge-neutral' };
    if (stage === 'rejected')        return { label: 'Rejected',         badgeClass: 'badge-danger' };
    if (stage === 'trade_ready')     return { label: 'Trade Ready',      badgeClass: 'badge-success' };
    if (stage === 'stage2_complete') return { label: 'Stage 2 Complete', badgeClass: 'badge-success' };
    if (stage === 'pending_stage2' || stage === 'awaiting_supplier_info')
                                      return { label: 'Pre-Trade Vetting', badgeClass: 'badge-warning' };
    if (stage === 'stage1_complete') return { label: 'Quote-Eligible',    badgeClass: 'badge-info' };
    if (stage === 'pending_compliance')
                                      return { label: 'Pending Compliance Review', badgeClass: 'badge-warning' };
    return                                   { label: 'Prospect',         badgeClass: 'badge-neutral' };
  }

  // Two progress percentages for the readiness cards — how far through the
  // onboarding sequence the supplier is towards "quote-eligible" (Stage 1
  // complete) and "trade-ready" (Stage 3 complete). Discrete, stage-based —
  // not a count of individual outstanding fields.
  function readinessPercentages(onboarding) {
    const stage = onboarding?.workflow_stage;
    if (!stage || stage === 'rejected') return { quotePct: 0, tradePct: 0 };

    const displayStage = stage === 'awaiting_supplier_info' ? 'pending_stage2' : stage;
    const idx = STAGE_SEQUENCE.indexOf(displayStage);
    const stage1Idx = STAGE_SEQUENCE.indexOf('stage1_complete');
    const tradeReadyIdx = STAGE_SEQUENCE.indexOf('trade_ready');

    return {
      quotePct: Math.min(100, Math.round((idx / stage1Idx) * 100)),
      tradePct: Math.min(100, Math.round((idx / tradeReadyIdx) * 100)),
    };
  }

  // Permissions switchboard — each row's `state` ('on'/'off') and `reason`
  // are derived from current state, mirroring supplier-page-spec.md §5's
  // example rules against the existing stage model (stage1_complete ≈
  // quote-eligible, trade_ready ≈ trade-approved).
  function computePermissions(contact, onboarding) {
    const stage = onboarding?.workflow_stage;
    const stage1Idx = STAGE_SEQUENCE.indexOf('stage1_complete');
    const idx = stage ? STAGE_SEQUENCE.indexOf(stage === 'awaiting_supplier_info' ? 'pending_stage2' : stage) : -1;
    const quoteEligible = !!stage && stage !== 'rejected' && idx >= stage1Idx;
    const tradeReady = stage === 'trade_ready';
    const bankVerified = !!contact?.bank_account_verified_in_name;
    const suspended = contact?.approval_status === 'suspended' || contact?.approval_status === 'delisted';

    return [
      {
        key: 'appear_in_quotes',
        label: 'Appear in customer quotes / receive RFQs',
        state: quoteEligible && !suspended ? 'on' : 'off',
        reason: suspended ? `Supplier is ${contact.approval_status}`
              : quoteEligible ? 'Stage 1 complete — sanctions-screened and risk-assessed'
              : 'Requires Stage 1 completion (sanctions screen + risk assessment)'
      },
      {
        key: 'receive_supplier_po',
        label: 'Receive supplier purchase orders',
        state: tradeReady && !suspended ? 'on' : 'off',
        reason: suspended ? `Supplier is ${contact.approval_status}`
              : tradeReady ? 'Trade Ready (Stage 3 sign-off complete)'
              : 'Requires Stage 3 — Trade Ready sign-off'
      },
      {
        key: 'outbound_payments',
        label: 'Outbound payments',
        state: tradeReady && bankVerified && !suspended ? 'on' : 'off',
        reason: suspended ? `Supplier is ${contact.approval_status}`
              : !tradeReady ? 'Requires Trade Ready status'
              : !bankVerified ? 'Bank account not yet verified'
              : 'Trade Ready and bank account verified'
      },
    ];
  }

  // Short header capability summary, e.g. "Quoting: On · Ordering: Off · Payments: Off"
  function capabilitySummary(permissions) {
    const SHORT_LABELS = { appear_in_quotes: 'Quoting', receive_supplier_po: 'Ordering', outbound_payments: 'Payments' };
    return permissions.map(p => `${SHORT_LABELS[p.key] || p.label}: ${p.state === 'on' ? 'On' : 'Off'}`).join(' · ');
  }

  // Returns an HTML string — progress bar across the 5 active stages.
  // 'awaiting_supplier_info' displays at the pending_stage2 step (the
  // caller is expected to render a separate "Paused" badge).
  function renderProgressSteps(currentStage) {
    const rejected = currentStage === 'rejected';
    const complete = currentStage === 'trade_ready';
    const displayStage = currentStage === 'awaiting_supplier_info' ? 'pending_stage2' : currentStage;
    const currentIdx = PROGRESS_STAGES.indexOf(displayStage);

    return `<div style="display:flex;gap:0;align-items:flex-start;margin:var(--space-4) 0">
      ${PROGRESS_STAGES.map((stage, i) => {
        let state = 'pending';
        if (complete || (currentIdx > i))        state = 'done';
        else if (!rejected && currentIdx === i)  state = 'active';

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
    resumeFromAwaitingInfo,
    rejectOnboarding,
    checkGates,
    requiresFullDiligence,
    getSupplierProfile,
    getRiskCriteria,
    getRequiredDocs,
    buildStage1aPrerequisites,
    buildStage2Prerequisites,
    buildRiskScorePayload,
    computeOverall,
    riskCategory,
    riskCategoryFromScore,
    generateSupplierReference,
    buildTobHtml,
    markTobGenerated,
    markTobSent,
    markTobConfirmed,
    stageLabel,
    stageBadgeClass,
    stageIndex,
    pipelineColumnLabel,
    renderProgressSteps,
    renderBlockers,
    lifecycleStatus,
    readinessPercentages,
    computePermissions,
    capabilitySummary,
    STAGE_SEQUENCE,
    STAGE_LABELS,
    PIPELINE_COLUMN_LABELS,
    RISK_CRITERIA,
    RISK_CRITERIA_LABELS,
    RISK_CRITERIA_COLUMN,
    RISK_CRITERIA_WEIGHTS,
    SUPPLIER_TYPE_PROFILES,
    PRODUCT_REVIEW_LABELS,
    PRODUCT_REVIEW_BADGE,
    COMPLIANCE_FACTORS,
    COMPLIANCE_FACTOR_GROUPS_BY_TYPE,
    COMPLIANCE_BANDS,
    COMMERCIAL_FACTORS,
    COMMERCIAL_BANDS,
    DECISION_MATRIX,
    computeComplianceScore,
    computeCommercialScore,
    matrixRecommendation,
  };

})();
