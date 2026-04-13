/**
 * Vertex Metals Portal — Dashboard
 * Fetches live stats and recent records from Supabase.
 */
(async () => {
  const user = await getCurrentUser();
  document.getElementById('user-email').textContent = user?.email || 'Unknown';

  const today = new Date().toISOString().split('T')[0];
  const in14  = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  const [rfqRes, tradeRes, kycRes, quotesRes] = await Promise.all([
    supabaseClient.from('rfq_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabaseClient.from('trades').select('id', { count: 'exact', head: true }).not('status', 'in', '("complete","closed")'),
    supabaseClient.from('contacts').select('id', { count: 'exact', head: true }).in('kyc_status', ['not_started','in_progress']),
    supabaseClient.from('supplier_quotes').select('id', { count: 'exact', head: true }).eq('status','active').lte('validity_date', in14).gte('validity_date', today),
  ]);

  document.getElementById('stat-rfqs').textContent   = rfqRes.count ?? '—';
  document.getElementById('stat-trades').textContent = tradeRes.count ?? '—';
  document.getElementById('stat-kyc').textContent    = kycRes.count ?? '—';
  document.getElementById('stat-quotes').textContent = quotesRes.count ?? '—';

  // Recent RFQs
  const { data: rfqs } = await supabaseClient
    .from('rfq_submissions')
    .select('id, created_at, company, product_interest, counterparty_type, status')
    .order('created_at', { ascending: false })
    .limit(5);

  const rfqEl = document.getElementById('recent-rfqs');
  if (!rfqs || rfqs.length === 0) {
    rfqEl.innerHTML = '<div style="padding:var(--space-8);text-align:center;color:var(--color-text-muted);font-size:var(--text-sm)">No RFQs yet</div>';
  } else {
    rfqEl.innerHTML = `<div class="table-wrapper" style="border:none"><table><thead><tr><th>Company</th><th>Product</th><th>Type</th><th>Status</th></tr></thead><tbody>${
      rfqs.map(r => `<tr onclick="location.href='rfq/detail.html?id=${r.id}'" style="cursor:pointer">
        <td><strong>${esc(r.company)}</strong><br><small style="color:var(--color-text-muted)">${new Date(r.created_at).toLocaleDateString('en-GB')}</small></td>
        <td>${esc(r.product_interest || '—')}</td>
        <td><span class="badge badge-neutral">${esc(r.counterparty_type)}</span></td>
        <td>${statusBadge(r.status)}</td>
      </tr>`).join('')
    }</tbody></table></div>`;
  }

  // Active Trades
  const { data: trades } = await supabaseClient
    .from('trades')
    .select('id, reference, product, status, buyer_id, contacts!trades_buyer_id_fkey(company_name)')
    .not('status', 'in', '("complete","closed")')
    .order('created_at', { ascending: false })
    .limit(5);

  const tradeEl = document.getElementById('recent-trades');
  if (!trades || trades.length === 0) {
    tradeEl.innerHTML = '<div style="padding:var(--space-8);text-align:center;color:var(--color-text-muted);font-size:var(--text-sm)">No active trades</div>';
  } else {
    tradeEl.innerHTML = `<div class="table-wrapper" style="border:none"><table><thead><tr><th>Reference</th><th>Buyer</th><th>Product</th><th>Status</th></tr></thead><tbody>${
      trades.map(t => `<tr>
        <td><strong>${esc(t.reference)}</strong></td>
        <td>${esc(t.contacts?.company_name || '—')}</td>
        <td>${esc(t.product)}</td>
        <td>${tradeStatusBadge(t.status)}</td>
      </tr>`).join('')
    }</tbody></table></div>`;
  }
})();

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function statusBadge(s) {
  const map = { new:'badge-accent', in_review:'badge-info', quoted:'badge-warning', closed:'badge-neutral' };
  return `<span class="badge ${map[s]||'badge-neutral'}">${esc(s)}</span>`;
}

function tradeStatusBadge(s) {
  const map = { enquiry:'badge-neutral', quoted:'badge-info', confirmed:'badge-accent', in_transit:'badge-warning', delivered:'badge-success', invoiced:'badge-warning', complete:'badge-success' };
  return `<span class="badge ${map[s]||'badge-neutral'}">${esc(s)}</span>`;
}
