/**
 * Vertex Metals Portal — Sales Homepage
 * Basic sales pipeline metrics: open RFQs, quotes, active orders, sales value.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmtGBP(n) {
  if (n == null || isNaN(n)) return '—';
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

(async () => {
  const user = await getCurrentUser();
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user?.email || '';

  await StateMachine.loadReference();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [openRfqs, quoted, activeOrders, salesValue] = await Promise.all([
    supabaseClient
      .from('rfq_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'buyer')
      .not('status', 'eq', 'closed'),

    supabaseClient
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('current_state', 'quoted'),

    supabaseClient
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .not('current_state', 'in', '("complete","cancelled")'),

    supabaseClient
      .from('trades')
      .select('sell_price_gbp')
      .gte('created_at', startOfMonth.toISOString()),
  ]);

  document.getElementById('stat-open-rfqs').textContent    = openRfqs.count    ?? '—';
  document.getElementById('stat-quoted').textContent       = quoted.count      ?? '—';
  document.getElementById('stat-active-orders').textContent = activeOrders.count ?? '—';

  const monthTotal = (salesValue.data || []).reduce((sum, t) => sum + (Number(t.sell_price_gbp) || 0), 0);
  document.getElementById('stat-sales-value').textContent = fmtGBP(monthTotal);

  // ── Recent Customer Orders ────────────────────────────────────────────────
  const { data: orders } = await supabaseClient
    .from('trades')
    .select(`
      id, reference, product, quantity_mt, sell_price_gbp, current_state, created_at,
      buyer:contacts!trades_buyer_id_fkey(company_name)
    `)
    .order('created_at', { ascending: false })
    .limit(8);

  const el = document.getElementById('recent-orders');
  if (!orders || orders.length === 0) {
    el.innerHTML = '<div style="padding:var(--space-8);text-align:center;color:var(--color-text-muted);font-size:var(--text-sm)">No orders yet.</div>';
  } else {
    el.innerHTML = `<div class="table-wrapper" style="border:none"><table><thead><tr><th>Reference</th><th>Buyer</th><th>Product</th><th>Qty (MT)</th><th>Sell (GBP)</th><th>Status</th></tr></thead><tbody>
      ${orders.map(o => `<tr onclick="location.href='../orders/detail.html?id=${esc(o.id)}'" style="cursor:pointer">
        <td style="font-size:var(--text-sm);font-weight:600">${esc(o.reference || o.id.slice(0,8))}</td>
        <td style="font-size:var(--text-sm)">${esc(o.buyer?.company_name || '—')}</td>
        <td style="font-size:var(--text-sm)">${esc(o.product || '—')}</td>
        <td style="font-size:var(--text-sm)">${o.quantity_mt ?? '—'}</td>
        <td style="font-size:var(--text-sm)">${o.sell_price_gbp != null ? fmtGBP(o.sell_price_gbp) : '—'}</td>
        <td>${StateMachine.stateBadge(o.current_state)}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
  }
})();
