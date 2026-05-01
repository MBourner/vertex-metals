/**
 * Vertex Metals Portal — Disputes
 * Handles portal/disputes/index.html and portal/disputes/detail.html
 */

function esc(s) { if (s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n,dp=2) { if (n==null||isNaN(n)) return '—'; return Number(n).toLocaleString('en-GB',{minimumFractionDigits:dp,maximumFractionDigits:dp}); }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }

const STATUS_CLASS = { open:'badge-danger', investigating:'badge-warning', supplier_notified:'badge-info', resolved:'badge-success', escalated:'badge-danger' };

// ── Index page ────────────────────────────────────────────────────────────────

async function loadDisputes() {
  const filterStatus   = document.getElementById('filter-status')?.value   || '';
  const filterCategory = document.getElementById('filter-category')?.value || '';
  const tbody = document.getElementById('disputes-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">Loading…</td></tr>';

  let query = supabaseClient
    .from('disputes')
    .select(`
      id, created_at, raised_at, category, status, description, cost_attribution, resolved_at,
      trade:trades(reference, buyer:contacts!trades_buyer_id_fkey(company_name), supplier:contacts!trades_supplier_id_fkey(company_name))
    `)
    .order('raised_at', { ascending: false });

  if (filterStatus)   query = query.eq('status', filterStatus);
  if (filterCategory) query = query.eq('category', filterCategory);

  const { data, error } = await query;
  if (error) { tbody.innerHTML = `<tr><td colspan="7" style="color:var(--color-danger);padding:var(--space-8);text-align:center">${esc(error.message)}</td></tr>`; return; }
  if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No disputes found.</td></tr>'; return; }

  tbody.innerHTML = data.map(d => {
    const isOpen = ['open','investigating','escalated'].includes(d.status);
    return `<tr style="cursor:pointer${isOpen?';background:rgba(239,68,68,.03)':''}" onclick="location.href='detail.html?id=${esc(d.id)}'">
      <td style="font-family:var(--font-display);font-size:var(--text-sm)">${esc(d.trade?.reference||'—')}</td>
      <td style="font-size:var(--text-sm)">${esc(d.trade?.buyer?.company_name||'—')}</td>
      <td style="font-size:var(--text-sm)">${esc(d.trade?.supplier?.company_name||'—')}</td>
      <td><span class="badge badge-neutral">${esc(d.category)}</span></td>
      <td><span class="badge ${STATUS_CLASS[d.status]||'badge-neutral'}">${esc(d.status?.replace('_',' '))}</span></td>
      <td style="font-size:var(--text-sm)">${fmtDate(d.raised_at)}</td>
      <td style="font-size:var(--text-sm)">${fmtDate(d.resolved_at)}</td>
    </tr>`;
  }).join('');
}

// ── Detail page ───────────────────────────────────────────────────────────────

const disputeId = new URLSearchParams(location.search).get('id');

async function loadDisputeDetail() {
  if (!disputeId) return;
  const { data: d, error } = await supabaseClient.from('disputes')
    .select(`*, trade:trades(id, reference, product, buyer:contacts!trades_buyer_id_fkey(company_name), supplier:contacts!trades_supplier_id_fkey(company_name))`)
    .eq('id', disputeId).single();

  if (error || !d) { document.getElementById('dispute-detail').innerHTML = `<div class="alert alert-error">Dispute not found.</div>`; return; }

  document.getElementById('topbar-title').textContent = `Dispute — ${d.trade?.reference || '—'}`;
  document.title = `Dispute — ${d.trade?.reference || ''} — Vertex Metals Portal`;

  document.getElementById('dispute-detail').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6)">
      <div>
        <div class="panel" style="margin-bottom:var(--space-4)">
          <div class="panel-header"><h3>Dispute Details</h3></div>
          <div class="panel-body"><table style="width:100%"><tbody>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0;width:40%">Order</td><td><a href="../orders/detail.html?id=${esc(d.trade?.id)}" style="color:var(--color-accent)">${esc(d.trade?.reference||'—')}</a></td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Buyer</td><td>${esc(d.trade?.buyer?.company_name||'—')}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Supplier</td><td>${esc(d.trade?.supplier?.company_name||'—')}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Category</td><td><span class="badge badge-neutral">${esc(d.category)}</span></td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Raised By</td><td>${esc(d.raised_by)} on ${fmtDate(d.raised_at)}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Cost Attribution</td><td>${esc(d.cost_attribution||'—')}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Corrective Action</td><td>${d.corrective_action_required ? '<span class="badge badge-warning">Required</span>' : '—'}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Supplier Re-Audit</td><td>${d.supplier_re_audit_triggered ? '<span class="badge badge-danger">Triggered</span>' : '—'}</td></tr>
          </tbody></table>
          <div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--color-surface);border-radius:var(--radius-sm);font-size:var(--text-sm)"><strong>Description:</strong><br>${esc(d.description)}</div>
          ${d.resolution ? `<div style="margin-top:var(--space-3);padding:var(--space-3);background:var(--color-surface);border-radius:var(--radius-sm);font-size:var(--text-sm)"><strong>Resolution:</strong><br>${esc(d.resolution)}</div>` : ''}
        </div>
      </div>

      <div>
        <div class="panel">
          <div class="panel-header"><h3>Update Status</h3></div>
          <div class="panel-body">
            <div class="form-group">
              <label class="form-label">Current Status</label>
              <select class="form-select" id="update-status">
                ${['open','investigating','supplier_notified','resolved','escalated'].map(s =>
                  `<option value="${s}"${s===d.status?' selected':''}>${s.replace('_',' ')}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Cost Attribution</label>
              <select class="form-select" id="update-cost">
                <option value="">— None —</option>
                ${['supplier','vertex','customer','shared'].map(c =>
                  `<option value="${c}"${c===d.cost_attribution?' selected':''}>${c}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Resolution Notes</label>
              <textarea class="form-textarea" id="update-resolution" rows="3">${esc(d.resolution||'')}</textarea>
            </div>
            <div style="display:flex;gap:var(--space-3);align-items:center;margin-bottom:var(--space-3)">
              <label style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-sm)">
                <input type="checkbox" id="update-corrective" ${d.corrective_action_required?'checked':''} /> Corrective action required
              </label>
              <label style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-sm)">
                <input type="checkbox" id="update-reaudit" ${d.supplier_re_audit_triggered?'checked':''} /> Trigger supplier re-audit
              </label>
            </div>
            <div id="update-error" style="color:var(--color-danger);font-size:var(--text-sm);margin-bottom:var(--space-3)"></div>
            <button onclick="saveDisputeUpdate()" class="btn btn-primary btn-sm">Save Update</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function saveDisputeUpdate() {
  const errEl = document.getElementById('update-error');
  errEl.textContent = '';
  const status   = document.getElementById('update-status').value;
  const resolved = status === 'resolved' ? new Date().toISOString() : null;

  const { error } = await supabaseClient.from('disputes').update({
    status,
    cost_attribution:          document.getElementById('update-cost').value || null,
    resolution:                document.getElementById('update-resolution').value.trim() || null,
    resolved_at:               resolved,
    corrective_action_required: document.getElementById('update-corrective').checked,
    supplier_re_audit_triggered: document.getElementById('update-reaudit').checked,
  }).eq('id', disputeId);

  if (error) { errEl.textContent = error.message; return; }
  location.reload();
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  if (document.getElementById('disputes-body')) await loadDisputes();
  if (document.getElementById('dispute-detail')) await loadDisputeDetail();
})();
