/**
 * Vertex Metals Portal — Document Expiry Monitor
 * Handles portal/suppliers/expiry-monitor.html
 *
 * ISO 9001 Clause 7.5 — monitors expiry dates across all supplier documents.
 * Shows expired, expiring within 30 days, expiring within 90 days, and current.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

const DOC_LABELS = {
  business_registration:        'Business Registration',
  beneficial_owner_declaration: 'Beneficial Owner Declaration',
  bank_details:                 'Bank Details',
  dpa:                          'Data Processing Agreement',
  tax_certificate:              'Tax / VAT / GST Certificate',
  quality_cert:                 'Quality Certificate',
  test_certificate:             'Test / Mill Certificates',
  iso_certificate:              'ISO Certificate',
  insurance_cargo:              'Cargo Insurance',
  insurance_liability:          'Liability Insurance',
  audit_report:                 'Audit Report',
  w9:                           'W-9 (US Tax Form)',
  other:                        'Other',
};

let allDocs = [];

// ── Load all supplier documents with expiry dates ─────────────────────────

async function loadDocs() {
  const { data, error } = await supabaseClient
    .from('supplier_documents')
    .select('*, supplier:contacts(id, company_name, approval_status)')
    .eq('is_current', true)
    .eq('not_applicable', false)
    .not('expiry_date', 'is', null)
    .order('expiry_date', { ascending: true });

  if (error) {
    document.getElementById('docs-body').innerHTML =
      `<tr><td colspan="6" style="color:var(--color-danger);padding:var(--space-4)">${esc(error.message)}</td></tr>`;
    return;
  }

  allDocs = data || [];

  populateTypeFilter();
  updateKpis();
  renderDocs();
}

function daysUntil(dateStr) {
  return Math.floor((new Date(dateStr) - Date.now()) / 86400000);
}

function bucket(dateStr) {
  const d = daysUntil(dateStr);
  if (d < 0)   return 'expired';
  if (d <= 30) return 'critical';
  if (d <= 90) return 'warning';
  return 'ok';
}

function populateTypeFilter() {
  const sel = document.getElementById('filter-type');
  const types = [...new Set(allDocs.map(d => d.document_type))].sort();
  types.forEach(t => {
    const o = document.createElement('option');
    o.value = t;
    o.textContent = DOC_LABELS[t] || t;
    sel.appendChild(o);
  });
}

function updateKpis() {
  const counts = { expired:0, critical:0, warning:0, ok:0 };
  allDocs.forEach(d => counts[bucket(d.expiry_date)]++);
  document.getElementById('kpi-expired').textContent = counts.expired;
  document.getElementById('kpi-30').textContent      = counts.critical;
  document.getElementById('kpi-90').textContent      = counts.warning;
  document.getElementById('kpi-ok').textContent      = counts.ok;

  // Highlight cards with issues
  if (counts.expired > 0) {
    document.getElementById('kpi-30').style.color = 'var(--color-danger)';
  }
  if (counts.critical > 0) {
    document.getElementById('card-30').style.borderTopColor = 'var(--color-danger)';
    document.getElementById('kpi-30').style.color = 'var(--color-danger)';
  }
  if (counts.warning > 0) {
    document.getElementById('card-90').style.borderTop = '3px solid #d97706';
    document.getElementById('kpi-90').style.color = '#d97706';
  }
}

// ── Render ────────────────────────────────────────────────────────────────

function renderDocs() {
  const bucketFilter   = document.getElementById('filter-bucket')?.value   || '';
  const typeFilter     = document.getElementById('filter-type')?.value     || '';
  const supplierSearch = (document.getElementById('filter-supplier')?.value || '').toLowerCase().trim();

  let rows = allDocs;
  if (bucketFilter)   rows = rows.filter(d => bucket(d.expiry_date) === bucketFilter);
  if (typeFilter)     rows = rows.filter(d => d.document_type === typeFilter);
  if (supplierSearch) rows = rows.filter(d => (d.supplier?.company_name || '').toLowerCase().includes(supplierSearch));

  const countEl = document.getElementById('doc-count');
  if (countEl) countEl.textContent = `${rows.length} document${rows.length !== 1 ? 's' : ''} shown`;

  const tbody = document.getElementById('docs-body');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No documents match the current filters.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(d => {
    const days  = daysUntil(d.expiry_date);
    const bkt   = bucket(d.expiry_date);
    const label = DOC_LABELS[d.document_type] || d.document_label || d.document_type;

    let statusBadge, daysText;
    if (bkt === 'expired') {
      statusBadge = '<span class="badge badge-danger">Expired</span>';
      daysText    = `<span style="color:var(--color-danger);font-size:var(--text-xs)">${Math.abs(days)}d overdue</span>`;
    } else if (bkt === 'critical') {
      statusBadge = '<span class="badge badge-danger">Expiring soon</span>';
      daysText    = `<span style="color:var(--color-danger);font-size:var(--text-xs)">${days}d remaining</span>`;
    } else if (bkt === 'warning') {
      statusBadge = '<span class="badge badge-warning">Expiring</span>';
      daysText    = `<span style="color:#d97706;font-size:var(--text-xs)">${days}d remaining</span>`;
    } else {
      statusBadge = '<span class="badge badge-success">Current</span>';
      daysText    = `<span style="color:var(--color-text-muted);font-size:var(--text-xs)">${days}d remaining</span>`;
    }

    const approvalCls = {
      approved:'badge-success', conditionally_approved:'badge-warning',
      under_review:'badge-info', rejected:'badge-danger',
    }[d.supplier?.approval_status] || 'badge-neutral';

    return `<tr>
      <td>
        <strong style="font-size:var(--text-sm)">${esc(d.supplier?.company_name || '—')}</strong>
        <br><span class="badge ${approvalCls}" style="font-size:10px">${esc(d.supplier?.approval_status?.replace(/_/g,' ') || 'prospect')}</span>
      </td>
      <td style="font-size:var(--text-sm)">${esc(label)}</td>
      <td style="font-size:var(--text-sm);text-align:center">v${d.version}</td>
      <td style="font-size:var(--text-sm)">${fmtDate(d.expiry_date)}<br>${daysText}</td>
      <td>${statusBadge}</td>
      <td>
        <a href="documents.html?supplier_id=${esc(d.supplier_id)}&onboarding_id=${esc(d.onboarding_id||'')}"
           class="btn btn-sm btn-ghost" style="border:1px solid var(--color-border);font-size:var(--text-xs)">
          Update →
        </a>
      </td>
    </tr>`;
  }).join('');
}

// ── Init ──────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  await loadDocs();
})();
