/**
 * Vertex Metals Portal — Supplier Quotes list
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function statusBadge(status) {
  const map = { active: 'success', expired: 'neutral', used: 'info' };
  return `<span class="badge badge-${map[status] || 'neutral'}">${esc(status)}</span>`;
}

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function isExpired(validityDate) {
  if (!validityDate) return false;
  return new Date(validityDate) < new Date();
}

async function loadQuotes() {
  const statusFilter = document.getElementById('filter-status')?.value || '';
  const tbody = document.getElementById('quotes-body');

  let query = supabaseClient
    .from('supplier_quotes')
    .select('*, contacts(company_name)')
    .order('created_at', { ascending: false });

  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No quotes found.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(q => {
    const expired = isExpired(q.validity_date) && q.status === 'active';
    const rowClass = expired ? 'class="row-warning"' : '';
    const validityDisplay = q.validity_date
      ? new Date(q.validity_date).toLocaleDateString('en-GB') + (expired ? ' <span style="color:var(--color-warning);font-size:var(--text-xs)">(expired)</span>' : '')
      : '—';
    return `<tr ${rowClass} style="cursor:pointer" onclick="openQuoteDetail('${esc(q.id)}')">
      <td>${esc(q.contacts?.company_name || '—')}</td>
      <td>${esc(q.product)}</td>
      <td>${esc(q.specification || '—')}</td>
      <td style="font-family:var(--font-display);font-weight:600">$${fmt(q.fob_price_usd)}</td>
      <td>${fmt(q.quantity_mt, 0)}</td>
      <td>${validityDisplay}</td>
      <td>${statusBadge(q.status)}</td>
    </tr>`;
  }).join('');
}

function openQuoteDetail(id) {
  // Inline expand — toggle a detail row below
  const existing = document.getElementById(`detail-${id}`);
  if (existing) { existing.remove(); return; }

  // Find the clicked row
  const rows = document.querySelectorAll('#quotes-body tr');
  let targetRow = null;
  rows.forEach(r => {
    if (r.getAttribute('onclick') === `openQuoteDetail('${id}')`) targetRow = r;
  });
  if (!targetRow) return;

  const detailRow = document.createElement('tr');
  detailRow.id = `detail-${id}`;
  detailRow.innerHTML = `<td colspan="7" style="background:var(--color-surface);padding:var(--space-4)"><div id="detail-content-${id}" style="color:var(--color-text-muted)">Loading…</div></td>`;
  targetRow.insertAdjacentElement('afterend', detailRow);

  fetchQuoteDetail(id);
}

async function fetchQuoteDetail(id) {
  const { data: q, error } = await supabaseClient
    .from('supplier_quotes')
    .select('*, contacts(company_name, email, phone)')
    .eq('id', id)
    .single();

  const el = document.getElementById(`detail-content-${id}`);
  if (error || !q) { el.textContent = 'Failed to load detail.'; return; }

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-4);margin-bottom:var(--space-4)">
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Supplier</div><div style="font-weight:600">${esc(q.contacts?.company_name || '—')}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Product</div><div style="font-weight:600">${esc(q.product)}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Specification</div><div>${esc(q.specification || '—')}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Incoterm</div><div>${esc(q.incoterm || 'FOB')}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">FOB Price (USD/MT)</div><div style="font-family:var(--font-display);font-weight:700;font-size:var(--text-lg)">$${fmt(q.fob_price_usd)}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Quantity (MT)</div><div style="font-family:var(--font-display);font-weight:700;font-size:var(--text-lg)">${fmt(q.quantity_mt, 0)}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Validity Date</div><div>${q.validity_date ? new Date(q.validity_date).toLocaleDateString('en-GB') : '—'}</div></div>
      <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Status</div><div>${statusBadge(q.status)}</div></div>
    </div>
    <div style="display:flex;gap:var(--space-3);align-items:center">
      <select class="form-select" id="status-select-${id}" style="min-width:140px">
        <option value="active" ${q.status==='active'?'selected':''}>Active</option>
        <option value="expired" ${q.status==='expired'?'selected':''}>Expired</option>
        <option value="used" ${q.status==='used'?'selected':''}>Used</option>
      </select>
      <button class="btn btn-primary btn-sm" onclick="updateQuoteStatus('${id}')">Update Status</button>
      <a href="calculator.html" class="btn btn-ghost btn-sm">Open in Calculator →</a>
    </div>
    <div id="quote-alert-${id}" class="alert" style="display:none;margin-top:var(--space-3)"></div>`;
}

async function updateQuoteStatus(id) {
  const status = document.getElementById(`status-select-${id}`).value;
  const alertEl = document.getElementById(`quote-alert-${id}`);

  const { error } = await supabaseClient.from('supplier_quotes').update({ status }).eq('id', id);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Update failed: ' + error.message;
  } else {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-success';
    alertEl.textContent = 'Status updated.';
    loadQuotes();
  }
}

(async () => {
  const user = await getCurrentUser();
  document.getElementById('user-email').textContent = user?.email || '';
  loadQuotes();
})();
