/**
 * Vertex Metals Portal — Logistics Quotes
 * Freight quotes from logistics providers, used for landed cost calculation.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-GB') : '—';
}

function statusBadge(status) {
  const map = { active: 'success', expired: 'neutral', used: 'info' };
  return `<span class="badge badge-${map[status] || 'neutral'}">${esc(status)}</span>`;
}

function modeBadge(mode) {
  const map = { sea: 'info', air: 'accent', road: 'warning', rail: 'neutral' };
  return `<span class="badge badge-${map[mode] || 'neutral'}">${esc(mode || '—')}</span>`;
}

function isExpired(validityDate) {
  return validityDate ? new Date(validityDate) < new Date() : false;
}

// ── Load list ─────────────────────────────────────────────────────────────────

async function loadLogisticsQuotes() {
  const statusFilter = document.getElementById('filter-status')?.value || '';
  const modeFilter   = document.getElementById('filter-mode')?.value   || '';
  const tbody        = document.getElementById('lq-body');
  tbody.innerHTML    = `<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">Loading...</td></tr>`;

  let query = supabaseClient
    .from('logistics_quotes')
    .select('*, contacts(company_name)')
    .order('created_at', { ascending: false });

  if (statusFilter) query = query.eq('status', statusFilter);
  if (modeFilter)   query = query.eq('mode', modeFilter);

  const { data, error } = await query;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No logistics quotes found.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(q => {
    const expired  = isExpired(q.validity_date) && q.status === 'active';
    const origin   = [q.origin_country, q.origin_port].filter(Boolean).join(' / ');
    const dest     = [q.destination_country, q.destination_port].filter(Boolean).join(' / ');
    const route    = origin && dest ? `${esc(origin)} → ${esc(dest)}` : esc(origin || dest || '—');
    const validity = q.validity_date
      ? fmtDate(q.validity_date) + (expired ? ' <span style="color:var(--color-warning);font-size:var(--text-xs)">(expired)</span>' : '')
      : '—';
    return `<tr style="cursor:pointer" onclick="openEditModal('${esc(q.id)}')">
      <td style="font-weight:600">${esc(q.contacts?.company_name || '—')}</td>
      <td style="font-size:var(--text-sm)">${route}</td>
      <td>${modeBadge(q.mode)}</td>
      <td>${esc(q.container_type || '—')}</td>
      <td style="font-family:var(--font-display);font-weight:600">$${fmt(q.price_per_mt_usd)}</td>
      <td>${q.min_qty_mt != null ? fmt(q.min_qty_mt, 0) : '—'}</td>
      <td>${validity}</td>
      <td>${statusBadge(q.status)}</td>
    </tr>`;
  }).join('');
}

// ── Form builder ──────────────────────────────────────────────────────────────

async function buildLqForm(lq = {}, formId, submitFn, cancelModal) {
  const { data: providers } = await supabaseClient
    .from('contacts')
    .select('id, company_name')
    .eq('type', 'logistics')
    .order('company_name');

  const providerOptions = (providers || []).map(p =>
    `<option value="${esc(p.id)}" ${p.id === lq.provider_id ? 'selected' : ''}>${esc(p.company_name)}</option>`
  ).join('');

  return `
    <form id="${formId}" onsubmit="${submitFn}">
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Logistics Provider</label>
          <select class="form-select" id="${formId}-provider">
            <option value="">— Select provider —</option>
            ${providerOptions}
          </select>
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">Add logistics companies via <a href="../contacts/index.html" style="color:var(--color-accent)">Contacts</a> with type "logistics"</span>
        </div>
        <div class="form-group">
          <label class="form-label">Origin Country <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-input" id="${formId}-origin-country" value="${esc(lq.origin_country || '')}" required placeholder="e.g. India" />
        </div>
        <div class="form-group">
          <label class="form-label">Destination Country <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-input" id="${formId}-dest-country" value="${esc(lq.destination_country || '')}" required placeholder="e.g. United Kingdom" />
        </div>
        <div class="form-group">
          <label class="form-label">Origin Port</label>
          <input type="text" class="form-input" id="${formId}-origin-port" value="${esc(lq.origin_port || '')}" placeholder="e.g. Nhava Sheva" />
        </div>
        <div class="form-group">
          <label class="form-label">Destination Port</label>
          <input type="text" class="form-input" id="${formId}-dest-port" value="${esc(lq.destination_port || '')}" placeholder="e.g. Felixstowe" />
        </div>
        <div class="form-group">
          <label class="form-label">Mode <span style="color:var(--color-danger)">*</span></label>
          <select class="form-select" id="${formId}-mode" required>
            ${['sea','air','road','rail'].map(m => `<option value="${m}" ${m === (lq.mode || 'sea') ? 'selected' : ''}>${m.charAt(0).toUpperCase() + m.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Container Type</label>
          <input type="text" class="form-input" id="${formId}-container" value="${esc(lq.container_type || '')}" placeholder="e.g. 20ft, 40ft HC" list="${formId}-container-list" />
          <datalist id="${formId}-container-list">
            <option value="20ft"><option value="40ft"><option value="40ft HC"><option value="Bulk"><option value="Flexi-bag">
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label">Price (USD/MT) <span style="color:var(--color-danger)">*</span></label>
          <input type="number" class="form-input" id="${formId}-price" value="${lq.price_per_mt_usd ?? ''}" required step="0.01" min="0" placeholder="0.00" />
        </div>
        <div class="form-group">
          <label class="form-label">Min Quantity (MT)</label>
          <input type="number" class="form-input" id="${formId}-min-qty" value="${lq.min_qty_mt ?? ''}" step="0.001" min="0" placeholder="Optional" />
        </div>
        <div class="form-group">
          <label class="form-label">Validity Date</label>
          <input type="date" class="form-input" id="${formId}-validity" value="${lq.validity_date || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" id="${formId}-status">
            <option value="active"  ${(lq.status || 'active') === 'active'  ? 'selected' : ''}>Active</option>
            <option value="expired" ${lq.status === 'expired' ? 'selected' : ''}>Expired</option>
            <option value="used"    ${lq.status === 'used'    ? 'selected' : ''}>Used</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-top:var(--space-3)">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="${formId}-notes" rows="2">${esc(lq.notes || '')}</textarea>
      </div>
      <div id="${formId}-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">${lq.id ? 'Save Changes' : 'Add Quote'}</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('${cancelModal}').classList.remove('open')">Cancel</button>
      </div>
    </form>`;
}

function getLqPayload(formId) {
  const v = id => document.getElementById(`${formId}-${id}`)?.value ?? '';
  return {
    provider_id:         v('provider')        || null,
    origin_country:      v('origin-country').trim(),
    destination_country: v('dest-country').trim(),
    origin_port:         v('origin-port').trim()  || null,
    destination_port:    v('dest-port').trim()    || null,
    mode:                v('mode')                || 'sea',
    container_type:      v('container').trim()    || null,
    price_per_mt_usd:    parseFloat(v('price'))   || null,
    min_qty_mt:          parseFloat(v('min-qty')) || null,
    validity_date:       v('validity')            || null,
    status:              v('status')              || 'active',
    notes:               v('notes').trim()        || null,
  };
}

// ── Add ───────────────────────────────────────────────────────────────────────

async function submitAddLq(e) {
  e.preventDefault();
  const alertEl = document.getElementById('add-lq-form-alert');
  const payload = getLqPayload('add-lq-form');

  if (!payload.origin_country || !payload.destination_country || !payload.price_per_mt_usd) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Origin country, destination country, and price are required.'; return;
  }

  const { error } = await supabaseClient.from('logistics_quotes').insert([payload]);
  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
  } else {
    document.getElementById('add-lq-modal').classList.remove('open');
    loadLogisticsQuotes();
  }
}

// ── Edit ──────────────────────────────────────────────────────────────────────

async function openEditModal(id) {
  const { data: lq, error } = await supabaseClient.from('logistics_quotes').select('*').eq('id', id).single();
  if (error || !lq) return;
  const html = await buildLqForm(lq, 'edit-lq-form', `submitEditLq(event,'${esc(id)}')`, 'edit-lq-modal');
  document.getElementById('edit-lq-form-container').innerHTML = html;
  document.getElementById('edit-lq-modal').classList.add('open');
}

async function submitEditLq(e, id) {
  e.preventDefault();
  const alertEl = document.getElementById('edit-lq-form-alert');
  const payload = getLqPayload('edit-lq-form');

  if (!payload.origin_country || !payload.destination_country || !payload.price_per_mt_usd) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Origin country, destination country, and price are required.'; return;
  }

  const { error } = await supabaseClient.from('logistics_quotes').update(payload).eq('id', id);
  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
  } else {
    document.getElementById('edit-lq-modal').classList.remove('open');
    loadLogisticsQuotes();
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  document.getElementById('user-email').textContent = user?.email || '';

  const html = await buildLqForm({}, 'add-lq-form', 'submitAddLq(event)', 'add-lq-modal');
  document.getElementById('add-lq-form-container').innerHTML = html;

  loadLogisticsQuotes();
})();
