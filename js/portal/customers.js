/**
 * Vertex Metals Portal — Customers Homepage
 * Basic customer metrics, plus shortcuts to RFQ, contact, and order creation.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function kycBadge(status) {
  if (!status) return '<span class="badge badge-neutral">none</span>';
  const map = { pending: 'warning', in_progress: 'info', approved: 'success', rejected: 'danger', expired: 'neutral' };
  return `<span class="badge badge-${map[status] || 'neutral'}">${esc(status.replace('_',' '))}</span>`;
}

(async () => {
  const user = await getCurrentUser();
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user?.email || '';

  const [customers, openRfqs, activeOrders] = await Promise.all([
    supabaseClient
      .from('contacts')
      .select('id, kyc_records(kyc_status)')
      .eq('type', 'buyer'),

    supabaseClient
      .from('rfq_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'buyer')
      .not('status', 'eq', 'closed'),

    supabaseClient
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .not('current_state', 'in', '("complete","cancelled")'),
  ]);

  const customerRows = customers.data || [];
  const pendingKyc = customerRows.filter(c => {
    const status = c.kyc_records?.[0]?.kyc_status;
    return status === 'pending' || status === 'in_progress';
  }).length;

  document.getElementById('stat-total-customers').textContent = customerRows.length;
  document.getElementById('stat-open-rfqs').textContent       = openRfqs.count ?? '—';
  document.getElementById('stat-active-orders').textContent   = activeOrders.count ?? '—';
  document.getElementById('stat-pending-kyc').textContent      = pendingKyc;

  // ── Recent Customers ──────────────────────────────────────────────────────
  const { data: recent } = await supabaseClient
    .from('contacts')
    .select('id, company_name, primary_contact_name, country, kyc_records(kyc_status)')
    .eq('type', 'buyer')
    .order('created_at', { ascending: false })
    .limit(8);

  const el = document.getElementById('recent-customers');
  if (!recent || recent.length === 0) {
    el.innerHTML = '<div style="padding:var(--space-8);text-align:center;color:var(--color-text-muted);font-size:var(--text-sm)">No customers yet.</div>';
  } else {
    el.innerHTML = `<div class="table-wrapper" style="border:none"><table><thead><tr><th>Company</th><th>Primary Contact</th><th>Country</th><th>KYC</th></tr></thead><tbody>
      ${recent.map(c => `<tr>
        <td style="font-size:var(--text-sm);font-weight:600">${esc(c.company_name)}</td>
        <td style="font-size:var(--text-sm)">${esc(c.primary_contact_name || '—')}</td>
        <td style="font-size:var(--text-sm)">${esc(c.country || '—')}</td>
        <td>${kycBadge(c.kyc_records?.[0]?.kyc_status)}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
  }
})();
