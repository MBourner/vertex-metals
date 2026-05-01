/**
 * Vertex Metals Portal — Sanctions Screening Log
 * Handles portal/sanctions/log.html
 */

function esc(s) { if (s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }
function fmtDateTime(d) { if (!d) return '—'; return new Date(d).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }

const RESULT_CLASS = { clear:'badge-success', potential_match:'badge-warning', confirmed_match:'badge-danger' };

async function loadScreenings() {
  const filterResult  = document.getElementById('filter-result')?.value  || '';
  const filterSubject = document.getElementById('filter-subject')?.value  || '';
  const dateFrom      = document.getElementById('filter-date-from')?.value || '';
  const dateTo        = document.getElementById('filter-date-to')?.value   || '';
  const tbody = document.getElementById('sanctions-body');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">Loading…</td></tr>';

  let query = supabaseClient
    .from('sanctions_screens')
    .select('id, screened_at, subject_type, subject_name_snapshot, lists_screened, tool_used, result, match_resolution_notes, evidence_path')
    .order('screened_at', { ascending: false })
    .limit(200);

  if (filterResult)  query = query.eq('result', filterResult);
  if (dateFrom) query = query.gte('screened_at', dateFrom);
  if (dateTo)   query = query.lte('screened_at', dateTo + 'T23:59:59');

  const { data, error } = await query;
  if (error) { tbody.innerHTML = `<tr><td colspan="6" style="color:var(--color-danger);text-align:center;padding:var(--space-8)">${esc(error.message)}</td></tr>`; return; }

  let rows = data || [];
  if (filterSubject) rows = rows.filter(r => r.subject_name_snapshot?.toLowerCase().includes(filterSubject.toLowerCase()));

  if (rows.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No screening records found.</td></tr>'; return; }

  tbody.innerHTML = rows.map(s => `<tr>
    <td style="font-size:var(--text-sm);white-space:nowrap">${fmtDateTime(s.screened_at)}</td>
    <td><strong style="font-size:var(--text-sm)">${esc(s.subject_name_snapshot)}</strong><br><span style="color:var(--color-text-muted);font-size:11px">${esc(s.subject_type)}</span></td>
    <td style="font-size:var(--text-sm)">${(s.lists_screened||[]).join(', ')||'—'}</td>
    <td style="font-size:var(--text-sm);color:var(--color-text-muted)">${esc(s.tool_used||'—')}</td>
    <td><span class="badge ${RESULT_CLASS[s.result]||'badge-neutral'}">${esc(s.result?.replace('_',' '))}</span></td>
    <td style="font-size:var(--text-sm)">${esc(s.match_resolution_notes||'—')}</td>
  </tr>`).join('');
}

async function recordScreening(e) {
  e.preventDefault();
  const btn   = document.getElementById('screen-submit-btn');
  const errEl = document.getElementById('screen-error');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const subjectType = document.getElementById('s-subject-type').value;
  const subjectId   = document.getElementById('s-contact').value || null;
  const name        = document.getElementById('s-name').value.trim();
  const lists       = Array.from(document.querySelectorAll('.list-check:checked')).map(el => el.value);

  const { error } = await supabaseClient.from('sanctions_screens').insert({
    subject_type:          subjectType,
    subject_id:            subjectId || '00000000-0000-0000-0000-000000000000', // placeholder if no contact linked
    subject_name_snapshot: name,
    screened_at:           new Date().toISOString(),
    screened_by:           PortalRoles.getUserId(),
    lists_screened:        lists,
    tool_used:             document.getElementById('s-tool').value.trim() || null,
    result:                document.getElementById('s-result').value,
    match_resolution_notes: document.getElementById('s-notes').value.trim() || null,
  });

  if (error) {
    errEl.textContent = error.message;
    btn.disabled = false;
    btn.textContent = 'Save Screen';
    return;
  }

  document.getElementById('screen-modal').classList.remove('open');
  loadScreenings();
}

async function populateContactDropdown() {
  const { data } = await supabaseClient.from('contacts').select('id, company_name, type').order('company_name');
  const sel = document.getElementById('s-contact');
  (data||[]).forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = `${c.company_name} (${c.type})`;
    sel.appendChild(o);
  });
}

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  await populateContactDropdown();
  await loadScreenings();
})();
