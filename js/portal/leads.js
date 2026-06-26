/**
 * Vertex Metals Portal — Leads Hub
 * Handles portal/leads/index.html
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

// ── Config ────────────────────────────────────────────────────────────────────

const STAGES = {
  potential:      { label: 'Potential',      badge: 'badge-neutral' },
  contacted:      { label: 'Contacted',      badge: 'badge-info'    },
  interested:     { label: 'Interested',     badge: 'badge-accent'  },
  not_replied:    { label: 'Not Replied',    badge: 'badge-warning' },
  not_interested: { label: 'Not Interested', badge: 'badge-danger'  },
  not_suitable:   { label: 'Not Suitable',   badge: 'badge-neutral' },
  discussion:     { label: 'In Discussion',  badge: 'badge-warning' },
  converted:      { label: 'Converted',      badge: 'badge-success' },
};

const PIPELINE_STAGES = ['potential', 'contacted', 'interested', 'discussion', 'converted'];
const OUTCOME_STAGES  = ['not_replied', 'not_interested', 'not_suitable'];

const PRODUCT_FAMILIES = [
  'Aluminium', 'Copper', 'Stainless Steel', 'Mild Steel', 'Other Metals', 'Critical Minerals',
];

const REGIONS = [
  'UK', 'Europe', 'North America', 'Middle East', 'Africa', 'Asia Pacific', 'Latin America', 'Other',
];

const SOURCES = {
  research:   'Research',
  referral:   'Referral',
  linkedin:   'LinkedIn',
  trade_show: 'Trade Show',
  conference: 'Conference',
  other:      'Other',
};

// ── State ──────────────────────────────────────────────────────────────────────

let _stageFilter  = '';
let _allLeads     = [];
let _currentUser  = null;

// ── Pipeline bar ──────────────────────────────────────────────────────────────

const STAGE_COLORS = {
  potential:      '#9ca3af',
  contacted:      '#2563eb',
  interested:     '#7ab8d4',
  discussion:     '#d97706',
  converted:      '#16a34a',
  not_replied:    '#d97706',
  not_interested: '#dc2626',
  not_suitable:   '#6b7280',
};

function renderPipelineBar() {
  const el = document.getElementById('pipeline-bar');
  if (!el) return;

  const counts = {};
  Object.keys(STAGES).forEach(s => counts[s] = 0);
  _allLeads.forEach(l => { if (l.stage in counts) counts[l.stage]++; });

  const pipelineCards = PIPELINE_STAGES.map((stage, i) => {
    const cfg    = STAGES[stage];
    const active = _stageFilter === stage;
    const color  = STAGE_COLORS[stage];
    const isLast = i === PIPELINE_STAGES.length - 1;
    const arrow  = !isLast
      ? `<div style="color:var(--color-border);font-size:1.6rem;align-self:center;flex-shrink:0;user-select:none">›</div>`
      : '';
    return `
      <div onclick="setStageFilter('${stage}')" style="
          flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:var(--space-2);padding:var(--space-6) var(--space-4);min-height:110px;
          text-align:center;cursor:pointer;transition:all var(--transition);
          background:${active ? '#0a1728' : 'var(--color-surface-raised)'};
          border-top:4px solid ${color};
          border-right:1px solid ${active ? color : 'var(--color-border)'};
          border-bottom:1px solid ${active ? color : 'var(--color-border)'};
          border-left:1px solid ${active ? color : 'var(--color-border)'};
          border-radius:var(--radius);
          box-shadow:${active ? `0 4px 12px ${color}33` : 'var(--shadow-sm)'}">
        <span style="
            font-family:var(--font-display);font-size:var(--text-3xl);font-weight:700;line-height:1;
            color:${active ? color : 'var(--color-text-primary)'}">${counts[stage]}</span>
        <span style="
            font-size:var(--text-xs);font-weight:600;letter-spacing:.07em;text-transform:uppercase;
            white-space:nowrap;margin-top:var(--space-1);
            color:${active ? '#ffffff' : 'var(--color-text-muted)'}">${esc(cfg.label)}</span>
      </div>
      ${arrow}`;
  }).join('');

  const outcomeCards = OUTCOME_STAGES.map(stage => {
    const cfg    = STAGES[stage];
    const active = _stageFilter === stage;
    const color  = STAGE_COLORS[stage];
    return `
      <div onclick="setStageFilter('${stage}')" style="
          display:flex;align-items:center;gap:var(--space-3);
          padding:var(--space-3) var(--space-4);cursor:pointer;transition:all var(--transition);
          background:${active ? color + '18' : 'var(--color-surface-raised)'};
          border-top:3px solid ${color};
          border-right:1px solid ${active ? color : 'var(--color-border)'};
          border-bottom:1px solid ${active ? color : 'var(--color-border)'};
          border-left:1px solid ${active ? color : 'var(--color-border)'};
          border-radius:var(--radius)">
        <span style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;color:${color}">${counts[stage]}</span>
        <span style="font-size:var(--text-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted)">${esc(cfg.label)}</span>
      </div>`;
  }).join('');

  const clearLink = _stageFilter
    ? `<span onclick="setStageFilter('')" style="font-size:var(--text-xs);color:var(--color-text-muted);cursor:pointer;text-decoration:underline;align-self:center;margin-left:auto">Clear filter</span>`
    : '';

  el.innerHTML = `
    <div style="display:flex;align-items:stretch;gap:var(--space-2);margin-bottom:var(--space-3)">${pipelineCards}</div>
    <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap">${outcomeCards}${clearLink}</div>`;
}

function setStageFilter(stage) {
  _stageFilter = _stageFilter === stage ? '' : stage;
  renderPipelineBar();
  renderLeadsTable();
}

// ── List ──────────────────────────────────────────────────────────────────────

async function loadLeads() {
  document.getElementById('leads-body').innerHTML =
    `<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">Loading…</td></tr>`;

  const { data, error } = await supabaseClient
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    document.getElementById('leads-body').innerHTML =
      `<tr><td colspan="8" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
    return;
  }

  _allLeads = data || [];
  renderPipelineBar();
  renderLeadsTable();
}

function renderLeadsTable() {
  const tbody    = document.getElementById('leads-body');
  const search   = (document.getElementById('filter-search')?.value   || '').toLowerCase();
  const region   =  document.getElementById('filter-region')?.value   || '';
  const product  =  document.getElementById('filter-product')?.value  || '';
  const assigned =  document.getElementById('filter-assigned')?.value || '';

  let rows = _allLeads;
  if (_stageFilter) rows = rows.filter(l => l.stage === _stageFilter);
  if (search)   rows = rows.filter(l =>
    (l.company_name || '').toLowerCase().includes(search) ||
    (l.contact_name || '').toLowerCase().includes(search) ||
    (l.country      || '').toLowerCase().includes(search));
  if (region)   rows = rows.filter(l => l.region === region);
  if (product)  rows = rows.filter(l => (l.product_interests || []).includes(product));
  if (assigned) rows = rows.filter(l => l.assigned_to === assigned);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No leads found.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(l => {
    const stageCfg = STAGES[l.stage] || { label: l.stage, badge: 'badge-neutral' };
    const products = l.product_interests || [];
    const productHtml = products.length
      ? products.map(p => `<span class="badge badge-neutral" style="font-size:10px;padding:2px 7px">${esc(p)}</span>`).join(' ')
      : '<span style="color:var(--color-text-muted)">—</span>';

    let actionHtml = '';
    if (l.stage === 'discussion') {
      actionHtml = `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();confirmConvert('${esc(l.id)}','${esc(l.company_name)}')">Convert →</button>`;
    } else if (l.stage === 'converted' && l.converted_contact_id) {
      actionHtml = `<a href="../customers/detail.html?id=${esc(l.converted_contact_id)}" class="btn btn-ghost btn-sm" onclick="event.stopPropagation()">View →</a>`;
    }

    return `<tr style="cursor:pointer" onclick="openEditModal('${esc(l.id)}')">
      <td>
        <div style="font-weight:600">${esc(l.company_name)}</div>
        ${l.contact_name ? `<div style="font-size:var(--text-xs);color:var(--color-text-muted)">${esc(l.contact_name)}${l.job_title ? ' · ' + esc(l.job_title) : ''}</div>` : ''}
      </td>
      <td>
        <div style="font-size:var(--text-sm)">${esc(l.country || '—')}</div>
        ${l.region ? `<div style="font-size:var(--text-xs);color:var(--color-text-muted)">${esc(l.region)}</div>` : ''}
      </td>
      <td style="max-width:220px;white-space:normal">${productHtml}</td>
      <td><span class="badge ${stageCfg.badge}">${esc(stageCfg.label)}</span></td>
      <td style="font-size:var(--text-sm)">${esc(l.assigned_to || '—')}</td>
      <td style="font-size:var(--text-sm);color:var(--color-text-muted)">${fmtDate(l.last_contacted_at)}</td>
      <td style="font-size:var(--text-sm);color:var(--color-text-muted)">${esc(SOURCES[l.source] || l.source || '—')}</td>
      <td onclick="event.stopPropagation()" style="white-space:nowrap">${actionHtml}</td>
    </tr>`;
  }).join('');
}

// ── Form ──────────────────────────────────────────────────────────────────────

function buildLeadForm(lead = {}, formId = 'lead-form', submitFn = 'submitLead(event)') {
  const interests = lead.product_interests || [];

  return `<form id="${formId}" onsubmit="${submitFn}; return false;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-bottom:var(--space-5)">

      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Company Name <span style="color:var(--color-danger)">*</span></label>
        <input type="text" class="form-input" id="${formId}-company" value="${esc(lead.company_name || '')}" required />
      </div>

      <div class="form-group">
        <label class="form-label">Contact Name</label>
        <input type="text" class="form-input" id="${formId}-contact" value="${esc(lead.contact_name || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Job Title</label>
        <input type="text" class="form-input" id="${formId}-title" value="${esc(lead.job_title || '')}" />
      </div>

      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" id="${formId}-email" value="${esc(lead.email || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input type="text" class="form-input" id="${formId}-phone" value="${esc(lead.phone || '')}" />
      </div>

      <div class="form-group">
        <label class="form-label">Website</label>
        <input type="url" class="form-input" id="${formId}-website" value="${esc(lead.website || '')}" placeholder="https://" />
      </div>
      <div class="form-group">
        <label class="form-label">Country</label>
        <input type="text" class="form-input" id="${formId}-country" value="${esc(lead.country || '')}" placeholder="e.g. United Kingdom" />
      </div>

      <div class="form-group">
        <label class="form-label">Region</label>
        <select class="form-select" id="${formId}-region">
          <option value="">— Select —</option>
          ${REGIONS.map(r => `<option value="${esc(r)}" ${lead.region === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Source</label>
        <select class="form-select" id="${formId}-source">
          <option value="">— Select —</option>
          ${Object.entries(SOURCES).map(([v, lbl]) => `<option value="${v}" ${lead.source === v ? 'selected' : ''}>${esc(lbl)}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Stage</label>
        <select class="form-select" id="${formId}-stage">
          ${Object.entries(STAGES).map(([v, cfg]) =>
            `<option value="${v}" ${(lead.stage || 'potential') === v ? 'selected' : ''}>${esc(cfg.label)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Assigned To</label>
        <select class="form-select" id="${formId}-assigned">
          <option value="">— Unassigned —</option>
          <option value="Jackson Paul"   ${lead.assigned_to === 'Jackson Paul'   ? 'selected' : ''}>Jackson Paul</option>
          <option value="Martyn Bourner" ${lead.assigned_to === 'Martyn Bourner' ? 'selected' : ''}>Martyn Bourner</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Last Contacted</label>
        <input type="date" class="form-input" id="${formId}-last-contact"
               value="${lead.last_contacted_at ? lead.last_contacted_at.substring(0, 10) : ''}" />
      </div>

    </div>

    <div class="form-group" style="margin-bottom:var(--space-4)">
      <label class="form-label">Product Interests</label>
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-3) var(--space-5);padding:var(--space-3) var(--space-4);background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius)">
        ${PRODUCT_FAMILIES.map(f => `
          <label style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-sm);cursor:pointer">
            <input type="checkbox" data-family="${esc(f)}" ${interests.includes(f) ? 'checked' : ''} />
            ${esc(f)}
          </label>`).join('')}
      </div>
    </div>

    <div class="form-group" style="margin-bottom:var(--space-4)">
      <label class="form-label">Next Action</label>
      <input type="text" class="form-input" id="${formId}-next-action"
             value="${esc(lead.next_action || '')}" placeholder="e.g. Send product brochure, schedule intro call" />
    </div>

    <div class="form-group" style="margin-bottom:var(--space-5)">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea" id="${formId}-notes" rows="3">${esc(lead.notes || '')}</textarea>
    </div>

    <div id="${formId}-error" style="display:none;margin-bottom:var(--space-3);padding:var(--space-3) var(--space-4);background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.2);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--color-danger)"></div>

    <div style="display:flex;gap:var(--space-3);justify-content:flex-end;flex-wrap:wrap">
      <button type="button" class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-primary btn-sm">${lead.id ? 'Save Changes' : 'Add Lead'}</button>
    </div>
  </form>`;
}

function getLeadPayload(formId) {
  const interests = [...document.querySelectorAll(`#${formId} [data-family]:checked`)].map(cb => cb.dataset.family);
  return {
    company_name:      document.getElementById(`${formId}-company`)?.value.trim()     || null,
    contact_name:      document.getElementById(`${formId}-contact`)?.value.trim()     || null,
    job_title:         document.getElementById(`${formId}-title`)?.value.trim()       || null,
    email:             document.getElementById(`${formId}-email`)?.value.trim()       || null,
    phone:             document.getElementById(`${formId}-phone`)?.value.trim()       || null,
    website:           document.getElementById(`${formId}-website`)?.value.trim()     || null,
    country:           document.getElementById(`${formId}-country`)?.value.trim()     || null,
    region:            document.getElementById(`${formId}-region`)?.value             || null,
    stage:             document.getElementById(`${formId}-stage`)?.value              || 'potential',
    source:            document.getElementById(`${formId}-source`)?.value             || null,
    assigned_to:       document.getElementById(`${formId}-assigned`)?.value           || null,
    last_contacted_at: document.getElementById(`${formId}-last-contact`)?.value       || null,
    next_action:       document.getElementById(`${formId}-next-action`)?.value.trim() || null,
    notes:             document.getElementById(`${formId}-notes`)?.value.trim()       || null,
    product_interests: interests.length ? interests : null,
  };
}

// ── Modal ──────────────────────────────────────────────────────────────────────

function openAddModal() {
  document.getElementById('modal-title').textContent = 'Add Lead';
  document.getElementById('modal-body').innerHTML = buildLeadForm({}, 'lead-form', 'submitLead(event)');
  document.getElementById('lead-modal').classList.add('open');
}

async function openEditModal(id) {
  document.getElementById('modal-title').textContent = 'Edit Lead';
  document.getElementById('modal-body').innerHTML =
    `<div style="text-align:center;padding:var(--space-8);color:var(--color-text-muted)">Loading…</div>`;
  document.getElementById('lead-modal').classList.add('open');

  const [{ data, error }, { data: notes }] = await Promise.all([
    supabaseClient.from('leads').select('*').eq('id', id).single(),
    supabaseClient.from('lead_notes').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
  ]);

  if (error || !data) {
    document.getElementById('modal-body').innerHTML = `<p style="color:var(--color-danger)">Failed to load lead.</p>`;
    return;
  }
  document.getElementById('modal-body').innerHTML =
    buildLeadForm(data, 'edit-form', `submitEditLead(event,'${id}')`) +
    buildNotesSection(id, notes || []);
}

function closeModal() {
  document.getElementById('lead-modal').classList.remove('open');
}

// ── Submit ─────────────────────────────────────────────────────────────────────

async function submitLead(e) {
  e.preventDefault();
  const errEl = document.getElementById('lead-form-error');
  const payload = getLeadPayload('lead-form');
  if (!payload.company_name) {
    errEl.style.display = 'block'; errEl.textContent = 'Company name is required.'; return;
  }
  const btn = document.querySelector('#lead-form button[type=submit]');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const { error } = await supabaseClient.from('leads').insert([payload]);
  if (error) {
    errEl.style.display = 'block'; errEl.textContent = 'Save failed: ' + error.message;
    if (btn) { btn.disabled = false; btn.textContent = 'Add Lead'; }
  } else {
    closeModal();
    loadLeads();
  }
}

async function submitEditLead(e, id) {
  e.preventDefault();
  const errEl = document.getElementById('edit-form-error');
  const payload = getLeadPayload('edit-form');
  if (!payload.company_name) {
    errEl.style.display = 'block'; errEl.textContent = 'Company name is required.'; return;
  }
  const btn = document.querySelector('#edit-form button[type=submit]');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const { error } = await supabaseClient
    .from('leads')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    errEl.style.display = 'block'; errEl.textContent = 'Save failed: ' + error.message;
    if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
  } else {
    closeModal();
    loadLeads();
  }
}

// ── Notes / Activity log ──────────────────────────────────────────────────────

function noteHtml(n) {
  return `
    <div style="padding:var(--space-4) 0;border-bottom:1px solid var(--color-border)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:var(--space-4);margin-bottom:var(--space-2)">
        <span style="font-size:var(--text-xs);font-weight:600;color:var(--color-text-secondary)">${esc(n.author || 'Unknown')}</span>
        <span style="font-size:var(--text-xs);color:var(--color-text-muted);white-space:nowrap">${fmtDateTime(n.created_at)}</span>
      </div>
      <p style="margin:0;font-size:var(--text-sm);line-height:1.6;white-space:pre-wrap;color:var(--color-text-primary)">${esc(n.note)}</p>
    </div>`;
}

function buildNotesSection(leadId, notes) {
  const AUTHOR_MAP = {
    'martynjbourner@googlemail.com': 'Martyn Bourner',
  };
  const defaultAuthor = AUTHOR_MAP[_currentUser?.email] || '';

  const notesList = notes.length
    ? notes.map(noteHtml).join('')
    : `<p style="color:var(--color-text-muted);font-size:var(--text-sm);padding:var(--space-4) 0">No notes yet — add the first one above.</p>`;

  return `
    <div style="margin-top:var(--space-8);padding-top:var(--space-6);border-top:2px solid var(--color-border)">
      <h4 style="margin:0 0 var(--space-4) 0;font-size:var(--text-xs);font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-muted)">Activity Log</h4>

      <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:var(--space-4);margin-bottom:var(--space-4)">
        <textarea class="form-textarea" id="new-note-text" rows="3"
          placeholder="Add a note, call summary, next action…"
          style="margin-bottom:var(--space-3);font-size:var(--text-sm)"></textarea>
        <div style="display:flex;align-items:center;gap:var(--space-3);justify-content:space-between;flex-wrap:wrap">
          <select class="form-select" id="new-note-author" style="width:auto;font-size:var(--text-sm)">
            <option value="Jackson Paul"   ${defaultAuthor === 'Jackson Paul'   ? 'selected' : ''}>Jackson Paul</option>
            <option value="Martyn Bourner" ${defaultAuthor === 'Martyn Bourner' ? 'selected' : ''}>Martyn Bourner</option>
          </select>
          <button class="btn btn-primary btn-sm" id="add-note-btn" onclick="addNote('${esc(leadId)}')">Save Note</button>
        </div>
        <div id="note-error" style="display:none;margin-top:var(--space-3);font-size:var(--text-xs);color:var(--color-danger)"></div>
      </div>

      <div id="notes-list">${notesList}</div>
    </div>`;
}

async function addNote(leadId) {
  const text   = (document.getElementById('new-note-text')?.value || '').trim();
  const author =  document.getElementById('new-note-author')?.value || null;
  const errEl  =  document.getElementById('note-error');
  const btn    =  document.getElementById('add-note-btn');

  errEl.style.display = 'none';
  if (!text) { errEl.style.display = 'block'; errEl.textContent = 'Note text is required.'; return; }

  btn.disabled = true; btn.textContent = 'Saving…';

  const { error } = await supabaseClient.from('lead_notes').insert([{ lead_id: leadId, note: text, author }]);

  if (error) {
    errEl.style.display = 'block'; errEl.textContent = 'Save failed: ' + error.message;
    btn.disabled = false; btn.textContent = 'Save Note'; return;
  }

  // Auto-update last_contacted_at on the lead
  await supabaseClient.from('leads')
    .update({ last_contacted_at: new Date().toISOString().substring(0, 10), updated_at: new Date().toISOString() })
    .eq('id', leadId);

  document.getElementById('new-note-text').value = '';
  btn.disabled = false; btn.textContent = 'Save Note';

  // Reload just the notes list in-place (no modal flicker)
  const { data: notes } = await supabaseClient
    .from('lead_notes').select('*').eq('lead_id', leadId).order('created_at', { ascending: false });

  const listEl = document.getElementById('notes-list');
  if (listEl) listEl.innerHTML = (notes || []).map(noteHtml).join('') || `<p style="color:var(--color-text-muted);font-size:var(--text-sm);padding:var(--space-4) 0">No notes yet.</p>`;

  // Refresh the table row's Last Contacted column silently
  const lead = _allLeads.find(l => l.id === leadId);
  if (lead) { lead.last_contacted_at = new Date().toISOString().substring(0, 10); renderLeadsTable(); }
}

// ── Convert to Customer ───────────────────────────────────────────────────────

function confirmConvert(id, companyName) {
  document.getElementById('modal-title').textContent = 'Convert to Customer';
  document.getElementById('modal-body').innerHTML = `
    <p style="margin-bottom:var(--space-4)">Convert <strong>${esc(companyName)}</strong> to a customer record?</p>
    <p style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-6)">
      This will create a new Contacts record with their details and mark this lead as Converted.
      You will be taken to the customer detail page to complete their profile.
    </p>
    <div style="display:flex;gap:var(--space-3);justify-content:flex-end">
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary btn-sm" onclick="convertToCustomer('${esc(id)}')">Convert to Customer →</button>
    </div>`;
  document.getElementById('lead-modal').classList.add('open');
}

async function convertToCustomer(id) {
  const lead = _allLeads.find(l => l.id === id);
  if (!lead) return;

  document.getElementById('modal-body').innerHTML =
    `<div style="text-align:center;padding:var(--space-8);color:var(--color-text-muted)">Creating customer record…</div>`;

  const { data: contact, error: contactErr } = await supabaseClient
    .from('contacts')
    .insert([{
      company_name:         lead.company_name,
      type:                 'buyer',
      primary_contact_name: lead.contact_name || null,
      email:                lead.email        || null,
      phone:                lead.phone        || null,
      country:              lead.country      || null,
    }])
    .select('id')
    .single();

  if (contactErr) {
    document.getElementById('modal-body').innerHTML = `
      <p style="color:var(--color-danger);margin-bottom:var(--space-4)">Failed to create customer record: ${esc(contactErr.message)}</p>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button>`;
    return;
  }

  await supabaseClient.from('leads').update({
    stage:                'converted',
    converted_contact_id: contact.id,
    updated_at:           new Date().toISOString(),
  }).eq('id', id);

  location.href = `../customers/detail.html?id=${contact.id}`;
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  _currentUser = await getCurrentUser();

  const regionSel = document.getElementById('filter-region');
  REGIONS.forEach(r => {
    const o = document.createElement('option'); o.value = r; o.textContent = r; regionSel?.appendChild(o);
  });

  const productSel = document.getElementById('filter-product');
  PRODUCT_FAMILIES.forEach(f => {
    const o = document.createElement('option'); o.value = f; o.textContent = f; productSel?.appendChild(o);
  });

  await loadLeads();
})();
