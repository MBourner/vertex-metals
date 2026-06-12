/**
 * Vertex Metals Portal — Supplier Audit Trail
 * Handles portal/suppliers/audit-trail.html
 *
 * ISO 9001 Clause 9.2 — provides a complete, exportable record of every
 * action taken in the supplier onboarding lifecycle. The underlying table
 * (supplier_audit_trail) is append-only via RLS; this view is read-only.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit'
  });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

const params       = new URLSearchParams(location.search);
const supplierId   = params.get('supplier_id');
const onboardingId = params.get('onboarding_id'); // optional — scopes to one onboarding

// ── Event type display definitions ───────────────────────────────────────

const EVENT_LABELS = {
  enquiry_created:           'Enquiry Created',
  enquiry_reviewed:          'Enquiry Reviewed',
  enquiry_converted:         'Enquiry Converted',
  enquiry_declined:          'Enquiry Declined',
  onboarding_created:        'Onboarding Started',
  stage_advanced:            'Stage Advanced',
  stage_gate_blocked:        'Stage Blocked',
  document_uploaded:         'Document Uploaded',
  document_superseded:       'Document Replaced',
  document_marked_na:        'Document — N/A',
  document_expiry_alert:     'Expiry Alert',
  risk_assessment_saved:     'Risk Assessment',
  kyc_linked:                'KYC Updated',
  sanctions_linked:          'Sanctions Screen',
  recommendation_submitted:  'Recommendation',
  approval_decision:         'Approval Decision',
  rejection_decision:        'Rejection',
  supplier_activated:        'Activated',
  supplier_suspended:        'Suspended',
  supplier_reinstated:       'Reinstated',
  supplier_delisted:         'Delisted',
  condition_added:           'Condition Added',
  condition_met:             'Condition Met',
  nonconformity_raised:      'Nonconformity',
  corrective_action_created: 'Corrective Action',
  corrective_action_closed:  'Corrective Action Closed',
  annual_audit_event:        'Annual Audit',
  contact_field_changed:     'Record Updated',
};

const EVENT_COLOR = {
  onboarding_created:       { bg:'rgba(122,184,212,0.15)', color:'var(--color-accent)' },
  stage_advanced:           { bg:'rgba(122,184,212,0.15)', color:'var(--color-accent)' },
  approval_decision:        { bg:'rgba(22,163,74,0.1)',    color:'var(--color-success)' },
  supplier_activated:       { bg:'rgba(22,163,74,0.1)',    color:'var(--color-success)' },
  rejection_decision:       { bg:'rgba(220,38,38,0.1)',    color:'var(--color-danger)' },
  supplier_suspended:       { bg:'rgba(220,38,38,0.1)',    color:'var(--color-danger)' },
  supplier_delisted:        { bg:'rgba(220,38,38,0.1)',    color:'var(--color-danger)' },
  recommendation_submitted: { bg:'rgba(217,119,6,0.1)',    color:'#d97706' },
  nonconformity_raised:     { bg:'rgba(220,38,38,0.1)',    color:'var(--color-danger)' },
  annual_audit_event:       { bg:'rgba(122,184,212,0.15)', color:'var(--color-accent)' },
};

const ROLE_LABELS = {
  director_commercial: 'Commercial Director',
  director_compliance: 'Compliance Director',
  director:            'Director',
};

// ── Data ─────────────────────────────────────────────────────────────────

let allEvents       = [];
let allOnboardings  = [];

async function loadData() {
  let query = supabaseClient
    .from('supplier_audit_trail')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('occurred_at', { ascending: true });

  if (onboardingId) query = query.eq('onboarding_id', onboardingId);

  const { data, error } = await query;
  if (error) {
    document.getElementById('trail-body').innerHTML =
      `<tr><td colspan="4" style="color:var(--color-danger);padding:var(--space-4)">${esc(error.message)}</td></tr>`;
    return;
  }

  allEvents = data || [];

  // Load all onboarding records for the filter dropdown
  const { data: obs } = await supabaseClient
    .from('supplier_onboarding')
    .select('id, created_at, workflow_stage, risk_level')
    .eq('contact_id', supplierId)
    .order('created_at', { ascending: false });
  allOnboardings = obs || [];

  populateFilters();
  renderTrail();
}

function populateFilters() {
  // Event type filter
  const typeSelect = document.getElementById('filter-event-type');
  const usedTypes = [...new Set(allEvents.map(e => e.event_type))].sort();
  usedTypes.forEach(t => {
    const o = document.createElement('option');
    o.value = t;
    o.textContent = EVENT_LABELS[t] || t;
    typeSelect.appendChild(o);
  });

  // Onboarding filter
  const obSelect = document.getElementById('filter-onboarding');
  allOnboardings.forEach(ob => {
    const o = document.createElement('option');
    o.value = ob.id;
    o.textContent = `Onboarding ${fmtDate(ob.created_at)} — ${OnboardingWorkflow.stageLabel(ob.workflow_stage)}`;
    obSelect.appendChild(o);
  });
  if (onboardingId) obSelect.value = onboardingId;
}

function clearFilters() {
  document.getElementById('filter-event-type').value  = '';
  document.getElementById('filter-onboarding').value  = '';
  document.getElementById('filter-date-from').value   = '';
  document.getElementById('filter-date-to').value     = '';
  renderTrail();
}

// ── Render ────────────────────────────────────────────────────────────────

function renderTrail() {
  const typeFilter = document.getElementById('filter-event-type')?.value  || '';
  const obFilter   = document.getElementById('filter-onboarding')?.value  || '';
  const dateFrom   = document.getElementById('filter-date-from')?.value   || '';
  const dateTo     = document.getElementById('filter-date-to')?.value     || '';

  let rows = allEvents;
  if (typeFilter) rows = rows.filter(e => e.event_type === typeFilter);
  if (obFilter)   rows = rows.filter(e => e.onboarding_id === obFilter);
  if (dateFrom)   rows = rows.filter(e => e.occurred_at >= dateFrom);
  if (dateTo)     rows = rows.filter(e => e.occurred_at <= dateTo + 'T23:59:59');

  const countEl = document.getElementById('event-count');
  if (countEl) countEl.textContent = `${rows.length} event${rows.length !== 1 ? 's' : ''} shown${rows.length < allEvents.length ? ` (${allEvents.length} total)` : ''}`;

  const tbody = document.getElementById('trail-body');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No events match the current filters.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(e => {
    const label  = EVENT_LABELS[e.event_type] || e.event_type;
    const colors = EVENT_COLOR[e.event_type]  || { bg:'var(--color-surface)', color:'var(--color-text-muted)' };
    const role   = ROLE_LABELS[e.actor_role]  || (e.actor_role ? e.actor_role.replace(/_/g,' ') : '—');

    // Surface field-change details if present
    let detail = esc(e.description);
    if (e.event_type === 'contact_field_changed' && e.field_name) {
      detail += `<div style="margin-top:4px;font-size:10px;color:var(--color-text-muted)">
        <strong>${esc(e.field_name)}</strong>: ${esc(e.old_value||'—')} → ${esc(e.new_value||'—')}
      </div>`;
    }

    return `<tr>
      <td style="font-size:var(--text-xs);color:var(--color-text-muted);white-space:nowrap;vertical-align:top">${fmtDateTime(e.occurred_at)}</td>
      <td style="font-size:var(--text-xs);vertical-align:top;color:var(--color-text-muted)">${esc(role)}</td>
      <td style="vertical-align:top">
        <span class="event-type-pill" style="background:${colors.bg};color:${colors.color}">${esc(label)}</span>
      </td>
      <td style="font-size:var(--text-sm);vertical-align:top">${detail}</td>
    </tr>`;
  }).join('');
}

// ── Supplier summary card ─────────────────────────────────────────────────

async function loadSupplierSummary() {
  const { data: contact } = await supabaseClient
    .from('contacts')
    .select('company_name, country, approval_status, supplier_type')
    .eq('id', supplierId)
    .single();

  if (!contact) return;

  document.getElementById('topbar-title').textContent = `Audit Trail — ${contact.company_name}`;
  document.title = `Audit Trail — ${contact.company_name}`;

  const detailUrl = `detail.html?id=${supplierId}`;
  document.getElementById('back-link').href = detailUrl;

  // Print header
  const now = new Date();
  const generated = now.toLocaleString('en-GB', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
  document.getElementById('print-supplier-line').textContent =
    `Supplier: ${contact.company_name} — ${contact.country || ''}`;
  document.getElementById('print-generated-line').textContent =
    `Generated: ${generated} — Vertex Metals Ltd, Compliance & Operations`;
  document.getElementById('generated-at').textContent = generated;

  const approvalCls = OnboardingWorkflow.stageBadgeClass(contact.approval_status);
  document.getElementById('supplier-summary').querySelector('.panel-body').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-4)">
      <div>
        <h2 style="margin:0 0 var(--space-2)">${esc(contact.company_name)}</h2>
        <div style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap;font-size:var(--text-sm)">
          ${contact.country ? `<span style="color:var(--color-text-muted)">${esc(contact.country)}</span>` : ''}
          ${contact.supplier_type ? `<span style="color:var(--color-text-muted)">${esc(contact.supplier_type.replace('_',' '))}</span>` : ''}
          <span class="badge ${approvalCls}">${esc(contact.approval_status?.replace(/_/g,' ') || 'prospect')}</span>
        </div>
      </div>
      <div style="text-align:right;font-size:var(--text-xs);color:var(--color-text-muted)">
        <div>${allEvents.length} total events</div>
        ${allEvents.length ? `<div>First: ${fmtDate(allEvents[0]?.occurred_at)}</div>
        <div>Last: ${fmtDate(allEvents[allEvents.length-1]?.occurred_at)}</div>` : ''}
      </div>
    </div>`;
}

// ── Init ──────────────────────────────────────────────────────────────────

(async () => {
  if (!supplierId) {
    document.body.innerHTML = '<p style="padding:2rem;color:var(--color-danger)">Missing supplier_id in URL.</p>';
    return;
  }
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';

  await loadData();
  await loadSupplierSummary();
})();
