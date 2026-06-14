/**
 * Vertex Metals Portal — Onboarding Pipeline
 * Handles portal/suppliers/onboarding-pipeline.html
 *
 * ISO 9001 Clause 9.1 — monitoring, measurement, and KPI reporting
 * for the supplier onboarding process.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}
function daysSince(d) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d)) / 86400000);
}

const ACTIVE_STAGES    = ['draft', 'stage1_complete', 'pending_stage2', 'awaiting_supplier_info', 'stage2_complete'];
const COMPLETED_STAGES = ['trade_ready', 'rejected'];

let activeRows    = [];
let completedRows = [];

// ── Load data ─────────────────────────────────────────────────────────────

async function loadAll() {
  const cutoff90 = new Date(Date.now() - 90 * 86400000).toISOString();

  const [activeRes, completedRes] = await Promise.all([
    supabaseClient
      .from('supplier_onboarding')
      .select('*, supplier:contacts(id, company_name, country)')
      .in('workflow_stage', ACTIVE_STAGES)
      .order('updated_at', { ascending: false }),

    supabaseClient
      .from('supplier_onboarding')
      .select('*, supplier:contacts(id, company_name, country)')
      .in('workflow_stage', COMPLETED_STAGES)
      .gte('updated_at', cutoff90)
      .order('updated_at', { ascending: false }),
  ]);

  activeRows    = activeRes.data  || [];
  completedRows = completedRes.data || [];

  updateKpis();
  renderStageBreakdown();
  renderPipeline();
  renderCompleted();
}

// ── KPIs ──────────────────────────────────────────────────────────────────

function updateKpis() {
  const active = activeRows.length;
  const awaitingInfo = activeRows.filter(r => r.workflow_stage === 'awaiting_supplier_info').length;

  // Avg days in vetting = avg of daysSince(created_at) for active rows
  const avgDays = active > 0
    ? Math.round(activeRows.reduce((s, r) => s + (daysSince(r.created_at) || 0), 0) / active)
    : null;

  const approved = completedRows.filter(r => r.workflow_stage === 'trade_ready').length;
  const rejected = completedRows.filter(r => r.workflow_stage === 'rejected').length;

  document.getElementById('kpi-active').textContent   = active;
  document.getElementById('kpi-pending').textContent  = awaitingInfo;
  document.getElementById('kpi-avg-days').textContent = avgDays !== null ? avgDays + 'd' : '—';
  document.getElementById('kpi-approved').textContent = approved;
  document.getElementById('kpi-rejected').textContent = rejected;

  if (awaitingInfo > 0) {
    document.getElementById('card-pending').style.borderTop = '3px solid var(--color-accent)';
    document.getElementById('kpi-pending').style.color = 'var(--color-accent)';
  }
}

// ── Stage breakdown bars ──────────────────────────────────────────────────

function renderStageBreakdown() {
  const counts = {};
  ACTIVE_STAGES.forEach(s => counts[s] = 0);
  activeRows.forEach(r => { if (counts[r.workflow_stage] !== undefined) counts[r.workflow_stage]++; });

  const total = activeRows.length || 1;
  const el = document.getElementById('stage-breakdown');

  el.innerHTML = ACTIVE_STAGES.map(stage => {
    const n = counts[stage];
    const pct = Math.round((n / total) * 100);
    return `<div style="text-align:center;min-width:90px">
      <div style="font-size:var(--text-2xl);font-weight:700;font-family:var(--font-display)">${n}</div>
      <div style="height:4px;background:${n > 0 ? 'var(--color-accent)' : 'var(--color-border)'};border-radius:2px;margin:4px 0;width:${Math.max(pct,4)}%"></div>
      <div style="font-size:10px;font-family:var(--font-display);font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-muted)">${esc(OnboardingWorkflow.pipelineColumnLabel(stage))}</div>
    </div>`;
  }).join('');
}

// ── Filters ───────────────────────────────────────────────────────────────

function populateStageFilter() {
  const sel = document.getElementById('filter-stage');
  sel.innerHTML = '<option value="">All active stages</option>' +
    ACTIVE_STAGES.map(s => `<option value="${s}">${esc(OnboardingWorkflow.pipelineColumnLabel(s))}</option>`).join('');
}

// ── Active pipeline table ─────────────────────────────────────────────────

function renderPipeline() {
  const stageFilter  = document.getElementById('filter-stage')?.value  || '';
  const riskFilter   = document.getElementById('filter-risk')?.value   || '';
  const searchFilter = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();

  let rows = activeRows;
  if (stageFilter)  rows = rows.filter(r => r.workflow_stage === stageFilter);
  if (riskFilter)   rows = rows.filter(r => r.risk_level === riskFilter);
  if (searchFilter) rows = rows.filter(r => (r.supplier?.company_name || '').toLowerCase().includes(searchFilter));

  const tbody = document.getElementById('pipeline-body');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No active onboardings match the filters.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const stageBadge = OnboardingWorkflow.stageBadgeClass(r.workflow_stage);
    const stageLabel = OnboardingWorkflow.stageLabel(r.workflow_stage);
    const daysAtStage = daysSince(r.updated_at);
    const totalDays   = daysSince(r.created_at);

    const riskCls = r.risk_level === 'high' ? 'badge-danger'
                  : r.risk_level === 'medium' ? 'badge-warning'
                  : r.risk_level === 'low' ? 'badge-success' : 'badge-neutral';

    // Flag if very long at a stage (>14 days)
    const stageWarning = daysAtStage > 14
      ? `<span style="color:var(--color-danger);font-size:10px;display:block">⚠ ${daysAtStage}d at this stage</span>`
      : '';

    const isAwaitingSupplierInfo = r.workflow_stage === 'awaiting_supplier_info';

    return `<tr ${isAwaitingSupplierInfo ? 'style="background:rgba(122,184,212,0.04)"' : ''}>
      <td>
        <strong style="font-size:var(--text-sm)">${esc(r.supplier?.company_name || '—')}</strong>
        ${r.supplier?.country ? `<div style="font-size:var(--text-xs);color:var(--color-text-muted)">${esc(r.supplier.country)}</div>` : ''}
      </td>
      <td>${r.risk_level ? `<span class="badge ${riskCls}">${esc(r.risk_level)}</span>` : '<span class="badge badge-neutral">—</span>'}</td>
      <td>
        <span class="badge ${stageBadge}">${esc(stageLabel)}</span>
        ${isAwaitingSupplierInfo ? '<div style="font-size:10px;color:var(--color-accent);font-weight:600;margin-top:2px">Awaiting supplier</div>' : ''}
      </td>
      <td style="font-size:var(--text-sm)">
        ${daysAtStage !== null ? daysAtStage + 'd' : '—'}
        ${stageWarning}
      </td>
      <td style="font-size:var(--text-sm);color:var(--color-text-muted)">${fmtDate(r.created_at)}${totalDays !== null ? ` <span style="color:var(--color-text-muted);font-size:10px">(${totalDays}d total)</span>` : ''}</td>
      <td>
        <a href="detail.html?id=${esc(r.contact_id)}" class="btn btn-sm btn-ghost" style="border:1px solid var(--color-border);font-size:var(--text-xs);white-space:nowrap">Open →</a>
      </td>
    </tr>`;
  }).join('');
}

// ── Completed table ───────────────────────────────────────────────────────

function renderCompleted() {
  const tbody = document.getElementById('completed-body');
  if (completedRows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No completed onboardings in the last 90 days.</td></tr>';
    return;
  }

  tbody.innerHTML = completedRows.map(r => {
    const isApproved = r.workflow_stage === 'trade_ready';
    const totalDays  = Math.floor((new Date(r.updated_at) - new Date(r.created_at)) / 86400000);

    const riskCls = r.risk_level === 'high' ? 'badge-danger'
                  : r.risk_level === 'medium' ? 'badge-warning'
                  : r.risk_level === 'low' ? 'badge-success' : 'badge-neutral';

    return `<tr>
      <td><strong style="font-size:var(--text-sm)">${esc(r.supplier?.company_name || '—')}</strong></td>
      <td>
        <span class="badge ${isApproved ? 'badge-success' : 'badge-danger'}">${isApproved ? 'Trade Ready' : 'Rejected'}</span>
        ${r.decision === 'approved_with_conditions' ? '<div style="font-size:10px;color:#d97706;margin-top:2px">with conditions</div>' : ''}
      </td>
      <td>${r.risk_level ? `<span class="badge ${riskCls}">${esc(r.risk_level)}</span>` : '—'}</td>
      <td style="font-size:var(--text-sm)">${fmtDate(r.updated_at)}</td>
      <td style="font-size:var(--text-sm)">${totalDays} days</td>
      <td>
        <a href="detail.html?id=${esc(r.contact_id)}" class="btn btn-sm btn-ghost" style="border:1px solid var(--color-border);font-size:var(--text-xs)">Open →</a>
        <a href="audit-trail.html?supplier_id=${esc(r.contact_id)}&onboarding_id=${esc(r.id)}" class="btn btn-sm btn-ghost" style="border:1px solid var(--color-border);font-size:var(--text-xs);margin-left:var(--space-1)">Audit →</a>
      </td>
    </tr>`;
  }).join('');
}

// ── Init ──────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  populateStageFilter();
  await loadAll();
})();
