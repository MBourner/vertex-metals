/**
 * Vertex Metals Portal — Concessions Register
 * Handles portal/concessions/index.html
 */

function esc(s) { if (s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n,dp=2) { if (n==null||isNaN(n)) return '—'; return Number(n).toLocaleString('en-GB',{minimumFractionDigits:dp,maximumFractionDigits:dp}); }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }

async function loadConcessions() {
  const tbody = document.getElementById('concessions-body');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">Loading…</td></tr>';

  const filterBuyer    = document.getElementById('filter-buyer')?.value    || '';
  const filterSupplier = document.getElementById('filter-supplier')?.value || '';
  const dateFrom       = document.getElementById('filter-date-from')?.value || '';
  const dateTo         = document.getElementById('filter-date-to')?.value   || '';

  let query = supabaseClient
    .from('concessions')
    .select(`
      id, created_at, delta_summary, customer_signed_at,
      commercial_adjustment_gbp, precedent_acknowledged,
      trade:trades(
        id, reference, product,
        buyer:contacts!trades_buyer_id_fkey(id, company_name),
        supplier:contacts!trades_supplier_id_fkey(id, company_name)
      )
    `)
    .order('created_at', { ascending: false });

  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo)   query = query.lte('created_at', dateTo + 'T23:59:59');

  const { data, error } = await query;
  if (error) { tbody.innerHTML = `<tr><td colspan="7" style="color:var(--color-danger);text-align:center;padding:var(--space-8)">${esc(error.message)}</td></tr>`; return; }

  let rows = data || [];
  if (filterBuyer)    rows = rows.filter(c => c.trade?.buyer?.id === filterBuyer);
  if (filterSupplier) rows = rows.filter(c => c.trade?.supplier?.id === filterSupplier);

  if (rows.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No concessions recorded.</td></tr>'; return; }

  tbody.innerHTML = rows.map(c => `<tr style="cursor:pointer" onclick="location.href='../orders/detail.html?id=${esc(c.trade?.id)}'">
    <td style="font-family:var(--font-display);font-size:var(--text-sm)">${esc(c.trade?.reference||'—')}</td>
    <td style="font-size:var(--text-sm)">${esc(c.trade?.buyer?.company_name||'—')}</td>
    <td style="font-size:var(--text-sm)">${esc(c.trade?.supplier?.company_name||'—')}</td>
    <td style="font-size:var(--text-sm)">${esc(c.trade?.product||'—')}</td>
    <td style="font-size:var(--text-sm);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.delta_summary)}</td>
    <td style="font-size:var(--text-sm)">${fmtDate(c.customer_signed_at)}</td>
    <td style="font-size:var(--text-sm)">${c.commercial_adjustment_gbp!=null?'£'+fmt(c.commercial_adjustment_gbp):'—'}</td>
  </tr>`).join('');
}

async function populateFilters() {
  const [buyersRes, suppliersRes] = await Promise.all([
    supabaseClient.from('contacts').select('id, company_name').eq('type','buyer').order('company_name'),
    supabaseClient.from('contacts').select('id, company_name').eq('type','supplier').order('company_name'),
  ]);
  const buyerSel = document.getElementById('filter-buyer');
  const suppSel  = document.getElementById('filter-supplier');
  (buyersRes.data||[]).forEach(b => { const o=document.createElement('option'); o.value=b.id; o.textContent=b.company_name; buyerSel.appendChild(o); });
  (suppliersRes.data||[]).forEach(s => { const o=document.createElement('option'); o.value=s.id; o.textContent=s.company_name; suppSel.appendChild(o); });
}

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  await populateFilters();
  await loadConcessions();
})();
