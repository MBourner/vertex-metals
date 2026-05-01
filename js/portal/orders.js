/**
 * Vertex Metals Portal — Orders List
 * Handles portal/orders/index.html
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmt(n, dp = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

async function loadOrders() {
  const filterState  = document.getElementById('filter-state')?.value  || '';
  const filterSearch = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
  const tbody = document.getElementById('orders-body');
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">Loading…</td></tr>';

  let query = supabaseClient
    .from('trades')
    .select(`
      id, reference, product, quantity_mt, sell_price_gbp, cost_price_gbp,
      current_state, created_at, customer_po_reference,
      buyer:contacts!trades_buyer_id_fkey(company_name),
      supplier:contacts!trades_supplier_id_fkey(company_name)
    `)
    .order('created_at', { ascending: false });

  if (filterState === 'active') {
    query = query.not('current_state', 'in', '("complete","cancelled")');
  } else if (filterState === 'blocked') {
    query = query.in('current_state', ['kyc_blocked','sanctions_blocked']);
  } else if (filterState === 'queue') {
    query = query.in('current_state', ['order_drafted','supplier_po_drafted','invoice_drafted']);
  } else if (filterState) {
    query = query.eq('current_state', filterState);
  }

  const { data, error } = await query;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
    return;
  }

  let rows = data || [];
  if (filterSearch) {
    rows = rows.filter(r =>
      (r.reference || '').toLowerCase().includes(filterSearch) ||
      (r.buyer?.company_name || '').toLowerCase().includes(filterSearch) ||
      (r.product || '').toLowerCase().includes(filterSearch) ||
      (r.customer_po_reference || '').toLowerCase().includes(filterSearch)
    );
  }

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No orders found.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(t => {
    const margin = (t.sell_price_gbp != null && t.cost_price_gbp != null)
      ? t.sell_price_gbp - t.cost_price_gbp : null;
    const marginStyle = margin != null && margin < 0 ? 'color:var(--color-danger)' : '';
    return `<tr style="cursor:pointer" onclick="location.href='detail.html?id=${esc(t.id)}'">
      <td style="font-family:var(--font-display);font-weight:600">${esc(t.reference || t.id.slice(0,8))}</td>
      <td>${esc(t.buyer?.company_name || '—')}</td>
      <td>${esc(t.supplier?.company_name || '—')}</td>
      <td>${esc(t.product || '—')}</td>
      <td>${fmt(t.quantity_mt, 0)}</td>
      <td>${t.sell_price_gbp != null ? '£' + fmt(t.sell_price_gbp) : '—'}</td>
      <td style="${marginStyle}">${margin != null ? '£' + fmt(margin) : '—'}</td>
      <td>${StateMachine.stateBadge(t.current_state)}</td>
      <td style="color:var(--color-text-muted);font-size:var(--text-sm)">${new Date(t.created_at).toLocaleDateString('en-GB')}</td>
    </tr>`;
  }).join('');
}

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  await StateMachine.loadReference();
  await loadOrders();
})();
