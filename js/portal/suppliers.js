/**
 * Vertex Metals Portal — Suppliers
 * Handles portal/suppliers/index.html
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

// Days until a future date (negative = overdue)
function daysUntil(d) {
  if (!d) return null;
  return Math.floor((new Date(d) - Date.now()) / 86400000);
}
// Days since a past date
function daysSince(d) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d)) / 86400000);
}

function auditDueBadge(date) {
  if (!date) return '<span style="color:var(--color-danger);font-size:var(--text-sm)">Not set</span>';
  const days = daysUntil(date);
  if (days < 0)   return `<span style="color:var(--color-danger);font-weight:600">${fmtDate(date)} (overdue)</span>`;
  if (days <= 60) return `<span style="color:#d97706">${fmtDate(date)} (${days}d)</span>`;
  return `<span>${fmtDate(date)}</span>`;
}

function sanctionsBadge(date) {
  if (!date) return '<span style="color:var(--color-danger);font-size:var(--text-sm)">Never screened</span>';
  const ago = daysSince(date);
  if (ago > 90)   return `<span style="color:var(--color-danger);font-weight:600">${fmtDate(date)} (overdue)</span>`;
  if (ago > 76)   return `<span style="color:#d97706">${fmtDate(date)}</span>`;
  return `<span>${fmtDate(date)}</span>`;
}

const APPROVAL_CLASS = {
  approved:     'badge-success',
  under_audit:  'badge-warning',
  prospect:     'badge-neutral',
  suspended:    'badge-danger',
  delisted:     'badge-danger',
};

async function loadSuppliers() {
  const filterStatus = document.getElementById('filter-status')?.value || '';
  const filterSearch = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
  const tbody = document.getElementById('suppliers-body');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">Loading…</td></tr>';

  let query = supabaseClient
    .from('contacts')
    .select('id, company_name, country, approval_status, approved_at, next_audit_due_date, last_sanctions_screened_at, last_sanctions_result')
    .eq('type', 'supplier')
    .order('company_name');

  if (filterStatus) query = query.eq('approval_status', filterStatus);

  const { data, error } = await query;
  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
    return;
  }

  let rows = data || [];
  if (filterSearch) {
    rows = rows.filter(r => (r.company_name || '').toLowerCase().includes(filterSearch) || (r.country || '').toLowerCase().includes(filterSearch));
  }

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No suppliers found.</td></tr>';
    return;
  }

  // Load active order counts for all suppliers at once
  const supplierIds = rows.map(r => r.id);
  const { data: orderCounts } = await supabaseClient
    .from('trades')
    .select('supplier_id')
    .in('supplier_id', supplierIds)
    .not('current_state', 'in', '("complete","cancelled")');

  const countMap = {};
  (orderCounts || []).forEach(t => { countMap[t.supplier_id] = (countMap[t.supplier_id] || 0) + 1; });

  tbody.innerHTML = rows.map(s => {
    const approvalCls = APPROVAL_CLASS[s.approval_status] || 'badge-neutral';
    const activeOrders = countMap[s.id] || 0;
    return `<tr style="cursor:pointer" onclick="location.href='detail.html?id=${esc(s.id)}'">
      <td><strong>${esc(s.company_name)}</strong></td>
      <td style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(s.country || '—')}</td>
      <td><span class="badge ${approvalCls}">${esc(s.approval_status || 'prospect')}</span></td>
      <td style="font-size:var(--text-sm)">${auditDueBadge(s.next_audit_due_date)}</td>
      <td style="font-size:var(--text-sm)">${sanctionsBadge(s.last_sanctions_screened_at)}</td>
      <td style="text-align:center">${activeOrders || '—'}</td>
      <td onclick="event.stopPropagation()">
        <a href="audit.html?supplier_id=${esc(s.id)}" class="btn btn-sm" style="border:1px solid var(--color-border);background:var(--color-surface-raised);white-space:nowrap">Record Audit</a>
      </td>
    </tr>`;
  }).join('');
}

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  await loadSuppliers();
})();
