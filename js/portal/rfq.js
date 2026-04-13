/**
 * Vertex Metals Portal — RFQ Module (list + detail)
 */

function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }

function statusBadge(s) {
  const map = { new:'badge-accent', reviewing:'badge-info', responded:'badge-warning', closed:'badge-neutral' };
  return `<span class="badge ${map[s]||'badge-neutral'}">${esc(s)}</span>`;
}

async function loadRfqs() {
  const status = document.getElementById('filter-status')?.value;
  const type   = document.getElementById('filter-type')?.value;
  const tbody  = document.getElementById('rfq-table-body');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">Loading...</td></tr>';

  let q = supabaseClient.from('rfq_submissions').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  if (type)   q = q.eq('type', type);

  const { data, error } = await q;
  if (error) { tbody.innerHTML = `<tr><td colspan="6" style="color:var(--color-danger);padding:var(--space-4)">Error: ${esc(error.message)}</td></tr>`; return; }
  if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No RFQs found</td></tr>'; return; }

  tbody.innerHTML = data.map(r => `
    <tr onclick="location.href='detail.html?id=${r.id}'" style="cursor:pointer">
      <td>${new Date(r.created_at).toLocaleDateString('en-GB')}</td>
      <td><strong>${esc(r.name)}</strong></td>
      <td>${esc(r.company)}</td>
      <td><span class="badge badge-neutral">${esc(r.type)}</span></td>
      <td>${esc(r.product || '—')}</td>
      <td>${statusBadge(r.status)}</td>
    </tr>`).join('');
}

// ── Detail page ──────────────────────────────────────────────

async function loadRfqDetail() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) { document.getElementById('rfq-detail').innerHTML = '<div class="alert alert-error">No ID provided</div>'; return; }

  const { data, error } = await supabaseClient.from('rfq_submissions').select('*').eq('id', id).single();
  if (error || !data) { document.getElementById('rfq-detail').innerHTML = '<div class="alert alert-error">Record not found</div>'; return; }

  document.getElementById('rfq-title').textContent = `${data.company} — ${new Date(data.created_at).toLocaleDateString('en-GB')}`;

  document.getElementById('rfq-detail').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6);margin-bottom:var(--space-8)">
      ${field('Name', data.name)}${field('Company', data.company)}
      ${field('Role', data.role)}${field('Email', `<a href="mailto:${esc(data.email)}" style="color:var(--color-accent)">${esc(data.email)}</a>`)}
      ${field('Phone', data.phone)}${field('Type', data.type)}
      ${field('Product interest', data.product)}${field('Estimated quantity (MT)', data.quantity_mt != null ? data.quantity_mt : null)}
      ${field('Country', data.country)}
    </div>
    <div style="margin-bottom:var(--space-8)"><strong>Message:</strong><p style="margin-top:var(--space-2);white-space:pre-wrap">${esc(data.message)}</p></div>
    <div style="display:flex;gap:var(--space-6);align-items:flex-end;flex-wrap:wrap">
      <div class="form-group" style="min-width:200px">
        <label class="form-label">Update Status</label>
        <select class="form-select" id="status-select" onchange="updateStatus('${id}', this.value)">
          ${['new','reviewing','responded','closed'].map(s => `<option value="${s}" ${s===data.status?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <a href="../contacts/index.html?prefill=1&name=${encodeURIComponent(data.name)}&company=${encodeURIComponent(data.company)}&email=${encodeURIComponent(data.email)}&phone=${encodeURIComponent(data.phone||'')}&type=${encodeURIComponent(data.type)}" class="btn btn-secondary btn-sm">+ Create Contact</a>
    </div>
    <div style="margin-top:var(--space-8)">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea" id="notes-field" onblur="saveNotes('${id}')" placeholder="Add notes...">${esc(data.notes||'')}</textarea>
      <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-2)">Notes auto-save on blur.</p>
    </div>`;
}

function field(label, value) {
  return `<div><p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:4px">${label}</p><p style="font-size:var(--text-sm);color:var(--color-text-primary)">${value||'—'}</p></div>`;
}

async function updateStatus(id, status) {
  await supabaseClient.from('rfq_submissions').update({ status }).eq('id', id);
}

async function saveNotes(id) {
  const notes = document.getElementById('notes-field').value;
  await supabaseClient.from('rfq_submissions').update({ notes }).eq('id', id);
}

// Auto-detect which page we're on
if (document.getElementById('rfq-table-body')) {
  (async () => { const u = await getCurrentUser(); document.getElementById('user-email').textContent = u?.email || ''; loadRfqs(); })();
}
if (document.getElementById('rfq-detail') !== null) {
  (async () => { const u = await getCurrentUser(); document.getElementById('user-email').textContent = u?.email || ''; loadRfqDetail(); })();
}
