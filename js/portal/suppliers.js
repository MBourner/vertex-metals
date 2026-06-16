/**
 * Vertex Metals Portal — Suppliers
 * Handles portal/suppliers/index.html
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

async function loadSuppliers() {
  const filterStatus = document.getElementById('filter-status')?.value || '';
  const filterType   = document.getElementById('filter-type')?.value   || '';
  const filterSearch = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
  const tbody = document.getElementById('suppliers-body');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">Loading…</td></tr>';

  let query = supabaseClient
    .from('contacts')
    .select('id, company_name, type, supplier_type, country, approval_status')
    .in('type', ['supplier', 'logistics', 'other'])
    .order('company_name');

  if (filterStatus) query = query.eq('approval_status', filterStatus);
  if (filterType)   query = query.eq('type', filterType);

  const { data, error } = await query;
  if (error) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
    return;
  }

  let rows = data || [];
  if (filterSearch) {
    rows = rows.filter(r => (r.company_name || '').toLowerCase().includes(filterSearch) || (r.country || '').toLowerCase().includes(filterSearch));
  }

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No suppliers found.</td></tr>';
    return;
  }

  const supplierIds = rows.map(r => r.id);

  // Latest onboarding workflow_stage per supplier, for the Quoting Status column
  const { data: onboardings } = await supabaseClient
    .from('supplier_onboarding')
    .select('contact_id, workflow_stage, created_at')
    .in('contact_id', supplierIds)
    .order('created_at', { ascending: false });

  const stageMap = {};
  (onboardings || []).forEach(o => { if (!(o.contact_id in stageMap)) stageMap[o.contact_id] = o.workflow_stage; });

  // Products linked / active quotes, from supplier_quotes
  const { data: quotes } = await supabaseClient
    .from('supplier_quotes')
    .select('supplier_id, product_line_id, status')
    .in('supplier_id', supplierIds);

  const productsMap = {};
  const activeQuotesMap = {};
  (quotes || []).forEach(q => {
    if (q.product_line_id) {
      const set = productsMap[q.supplier_id] || (productsMap[q.supplier_id] = new Set());
      set.add(q.product_line_id);
    }
    if (q.status === 'active') activeQuotesMap[q.supplier_id] = (activeQuotesMap[q.supplier_id] || 0) + 1;
  });

  // Orders and total spend, from trades (excluding cancelled)
  const { data: trades } = await supabaseClient
    .from('trades')
    .select('supplier_id, cost_price_gbp, current_state')
    .in('supplier_id', supplierIds)
    .neq('current_state', 'cancelled');

  const ordersMap = {};
  const spendMap = {};
  (trades || []).forEach(t => {
    ordersMap[t.supplier_id] = (ordersMap[t.supplier_id] || 0) + 1;
    spendMap[t.supplier_id] = (spendMap[t.supplier_id] || 0) + (Number(t.cost_price_gbp) || 0);
  });

  const TYPE_LABEL = {
    supplier:  { label: 'Supplier',  cls: 'badge-neutral' },
    logistics: { label: 'Logistics', cls: 'badge-info'    },
    other:     { label: 'Service',   cls: 'badge-neutral' },
  };

  tbody.innerHTML = rows.map(s => {
    const typeInfo  = TYPE_LABEL[s.type] || { label: s.type, cls: 'badge-neutral' };
    const lifecycle = OnboardingWorkflow.lifecycleStatus(s, { workflow_stage: stageMap[s.id] });
    const products    = productsMap[s.id] ? productsMap[s.id].size : 0;
    const activeQuotes = activeQuotesMap[s.id] || 0;
    const orders       = ordersMap[s.id] || 0;
    const spend         = spendMap[s.id] || 0;
    const flag = typeof countryFlagEmoji === 'function' ? countryFlagEmoji(s.country) : '';
    return `<tr style="cursor:pointer" onclick="location.href='detail.html?id=${esc(s.id)}'">
      <td><strong>${esc(s.company_name)}</strong></td>
      <td><span class="badge ${typeInfo.cls}">${esc(typeInfo.label)}</span></td>
      <td style="color:var(--color-text-muted);font-size:var(--text-sm)">${flag ? flag + ' ' : ''}${esc(s.country || '—')}</td>
      <td><span class="badge ${lifecycle.badgeClass}">${esc(lifecycle.label)}</span></td>
      <td style="text-align:center">${products || '—'}</td>
      <td style="text-align:center">${activeQuotes || '—'}</td>
      <td style="text-align:center">${orders || '—'}</td>
      <td style="text-align:right">${spend ? '£' + fmt(spend) : '—'}</td>
    </tr>`;
  }).join('');
}

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  await loadSuppliers();
})();
