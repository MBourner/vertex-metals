/**
 * Vertex Metals Portal — Order Detail
 * Handles portal/orders/detail.html
 *
 * Tabs load lazily on first open. Timeline and action panel are always visible.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmt(n, dp = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

const tradeId = new URLSearchParams(location.search).get('id');
let _trade    = null;
let _queueItem = null;
const _tabLoaded = {};

// ── Tab switching ─────────────────────────────────────────────────────────────

function switchTab(name) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  if (!_tabLoaded[name]) {
    _tabLoaded[name] = true;
    loadTabData(name);
  }
}

async function loadTabData(name) {
  if (name === 'documents')   loadDocuments();
  if (name === 'emails')      loadEmails();
  if (name === 'verif-log')   loadVerifLog();
  if (name === 'concession')  loadConcession();
  if (name === 'dispute')     loadDispute();
  if (name === 'audit-log')   loadAuditLog();
}

// ── Timeline ──────────────────────────────────────────────────────────────────

async function loadTimeline() {
  const el = document.getElementById('timeline-strip');
  const { data: events } = await supabaseClient
    .from('order_events')
    .select('id, created_at, event_type, from_state, to_state, actor_role')
    .eq('trade_id', tradeId)
    .eq('event_type', 'state_change')
    .order('created_at', { ascending: true });

  if (!events || events.length === 0) {
    el.innerHTML = '<span style="color:var(--color-text-muted);font-size:var(--text-sm)">No history yet.</span>';
    return;
  }

  let html = '';
  events.forEach((ev, i) => {
    const isCurrent = i === events.length - 1;
    const cls = isCurrent ? 'current' : 'done';
    const label = StateMachine.stateDisplayName(ev.to_state);
    const meta  = `${new Date(ev.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}${ev.actor_role ? ' · ' + esc(ev.actor_role) : ''}`;
    if (i > 0) html += `<div class="timeline-connector done"></div>`;
    html += `<div class="timeline-node ${cls}">
      <div class="timeline-dot"></div>
      <div class="timeline-label">${esc(label)}</div>
      <div class="timeline-meta">${esc(meta)}</div>
    </div>`;
  });
  el.innerHTML = html;
}

// ── Top bar ───────────────────────────────────────────────────────────────────

function renderTopBar(trade) {
  document.getElementById('topbar-reference').textContent =
    trade.reference || trade.id.slice(0, 8);
  document.getElementById('topbar-buyer').textContent =
    trade.buyer?.company_name || '—';
  document.getElementById('topbar-state').innerHTML =
    StateMachine.stateBadge(trade.current_state);
  document.getElementById('topbar-value').textContent =
    trade.sell_price_gbp != null ? `£${fmt(trade.sell_price_gbp)}` : '';
  document.title = `${trade.reference || 'Order'} — Vertex Metals Portal`;
}

// ── Summary tab ───────────────────────────────────────────────────────────────

function renderSummary(trade) {
  const el = document.getElementById('tab-summary');
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6)">
      <div>
        <div class="panel"><div class="panel-header"><h3>Order Details</h3></div><div class="panel-body">
          <table style="width:100%;font-size:var(--text-sm)"><tbody>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0;width:40%">Reference</td><td><strong>${esc(trade.reference || '—')}</strong></td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Customer PO Ref</td><td>${esc(trade.customer_po_reference || '—')}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Customer PO Date</td><td>${fmtDate(trade.customer_po_date)}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Buyer</td><td>${esc(trade.buyer?.company_name || '—')}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Supplier</td><td>${esc(trade.supplier?.company_name || 'Not yet assigned')}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Product</td><td>${esc(trade.product || '—')}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Specification</td><td>${esc(trade.specification || '—')}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Quantity</td><td>${fmt(trade.quantity_mt, 0)} MT</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Incoterms</td><td>${esc(trade.incoterms || '—')}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Delivery To</td><td>${esc(trade.delivery_destination || '—')}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Required Delivery</td><td>${fmtDate(trade.required_delivery_date)}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Payment Terms</td><td>${esc(trade.payment_terms || '—')}</td></tr>
            ${trade.special_conditions ? `<tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Special Conditions</td><td>${esc(trade.special_conditions)}</td></tr>` : ''}
            ${trade.cancelled_reason ? `<tr><td style="color:var(--color-danger);padding:var(--space-2) 0">Cancellation Reason</td><td style="color:var(--color-danger)">${esc(trade.cancelled_reason)}</td></tr>` : ''}
          </tbody></table>
        </div></div>
      </div>
      <div>
        <div class="panel" style="margin-bottom:var(--space-4)"><div class="panel-header"><h3>Financials</h3></div><div class="panel-body">
          <table style="width:100%;font-size:var(--text-sm)"><tbody>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0;width:50%">Agreed Sell Price</td><td>${trade.sell_price_gbp != null ? '£' + fmt(trade.sell_price_gbp) : '—'}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Cost Price</td><td>${trade.cost_price_gbp != null ? '£' + fmt(trade.cost_price_gbp) : '—'}</td></tr>
            <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Gross Margin</td><td id="summary-margin">—</td></tr>
          </tbody></table>
        </div></div>
        <div class="panel" id="action-panel"><div class="panel-header"><h3>Actions</h3></div><div class="panel-body">
          <div id="action-content"><div style="color:var(--color-text-muted);font-size:var(--text-sm)">Loading…</div></div>
        </div></div>
      </div>
    </div>
    ${trade.notes ? `<div class="panel" style="margin-top:var(--space-4)"><div class="panel-header"><h3>Operator Notes</h3></div><div class="panel-body"><p style="font-size:var(--text-sm)">${esc(trade.notes)}</p></div></div>` : ''}
  `;

  // Fill margin
  const margin = trade.sell_price_gbp != null && trade.cost_price_gbp != null
    ? trade.sell_price_gbp - trade.cost_price_gbp : null;
  const marginEl = document.getElementById('summary-margin');
  if (margin != null) {
    marginEl.textContent = '£' + fmt(margin);
    if (margin < 0) marginEl.style.color = 'var(--color-danger)';
  }
}

// ── Action panel ──────────────────────────────────────────────────────────────

async function renderActionPanel(trade) {
  const el = document.getElementById('action-content');
  const currentUserId = PortalRoles.getUserId();

  // Load active queue item (if any) so we can check four-eyes
  const { data: queueItems } = await supabaseClient
    .from('verification_queue')
    .select('id, queue_type, drafted_by, status, sla_due_at')
    .eq('trade_id', tradeId)
    .in('status', ['pending','in_review'])
    .order('created_at', { ascending: false })
    .limit(1);

  _queueItem = queueItems?.[0] || null;

  const allowed = await StateMachine.getAllowedTransitions(trade.current_state);

  if (trade.current_state === 'complete' || trade.current_state === 'cancelled') {
    el.innerHTML = `<p style="color:var(--color-text-muted);font-size:var(--text-sm)">This order is ${esc(trade.current_state)}. No further actions available.</p>`;
    return;
  }

  // If there's a pending verification queue item, show its status
  if (_queueItem) {
    const isYourDraft = _queueItem.drafted_by === currentUserId;
    const sla = StateMachine.slaBadge(_queueItem.sla_due_at);
    if (isYourDraft) {
      el.innerHTML = `
        <div class="alert alert-info" style="margin-bottom:var(--space-4)">
          <strong>Awaiting verification</strong><br>
          <span style="font-size:var(--text-sm)">This order is in the ${esc(StateMachine.queueTypeLabel(_queueItem.queue_type))} queue. Another user must verify it before it can proceed.</span>
        </div>
        <div style="font-size:var(--text-sm);color:var(--color-text-muted)">SLA: ${sla}</div>
        <div style="margin-top:var(--space-3)"><a href="../verification-queue/index.html" class="btn btn-ghost btn-sm">View Queue →</a></div>
      `;
    } else {
      // This user can potentially approve (if they have the role)
      el.innerHTML = `
        <div style="margin-bottom:var(--space-4)">
          <p style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-3)">
            Pending ${esc(StateMachine.queueTypeLabel(_queueItem.queue_type))} · SLA: ${sla}
          </p>
          <a href="../verification-queue/index.html?highlight=${esc(_queueItem.id)}" class="btn btn-primary btn-sm">Open in Verification Queue →</a>
        </div>
      `;
    }
    return;
  }

  // Special: release approval for docs_under_review
  if (trade.current_state === 'docs_under_review' && PortalRoles.hasRole('quality')) {
    const releaseBtn = `<button onclick="handleRequestRelease()" class="btn btn-primary btn-sm">Recommend Release →</button>`;
    el.innerHTML = `<div style="margin-bottom:var(--space-3)">${releaseBtn}</div>`;
  }

  if (allowed.length === 0) {
    el.innerHTML = (el.innerHTML || '') + `<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No actions available for your current role.</p>`;
    return;
  }

  let html = el.innerHTML;
  html += `<div style="display:flex;flex-direction:column;gap:var(--space-2)">`;
  allowed.forEach(t => {
    html += `<button onclick="openTransitionModal('${esc(t.toState)}','${esc(t.displayName)}')" class="btn btn-secondary btn-sm">${esc(t.displayName)}</button>`;
  });
  html += `</div>`;
  el.innerHTML = html;
}

async function handleRequestRelease() {
  const notes = prompt('Notes for the approver (optional):');
  const result = await StateMachine.requestRelease(tradeId, { notes });
  if (result.ok) {
    showAlert('Release approval requested. An approver will review in the verification queue.', 'success');
    setTimeout(() => location.reload(), 1500);
  } else {
    showAlert(result.error, 'error');
  }
}

// ── Transition modal ──────────────────────────────────────────────────────────

function openTransitionModal(toState, displayName) {
  document.getElementById('transition-modal-title').textContent = `Transition → ${displayName}`;
  document.getElementById('transition-to-state').value    = toState;
  document.getElementById('transition-notes').value       = '';
  document.getElementById('transition-reason-code').value = '';
  document.getElementById('transition-error').textContent = '';
  document.getElementById('transition-modal').classList.add('open');
}

async function submitTransition(e) {
  e.preventDefault();
  const btn     = document.getElementById('transition-submit-btn');
  const errEl   = document.getElementById('transition-error');
  const toState = document.getElementById('transition-to-state').value;
  const notes   = document.getElementById('transition-notes').value.trim() || null;
  const reason  = document.getElementById('transition-reason-code').value || null;

  btn.disabled = true;
  btn.textContent = 'Saving…';
  errEl.textContent = '';

  const result = await StateMachine.transition(tradeId, toState, {
    notes, reasonCode: reason,
  });

  if (result.ok) {
    document.getElementById('transition-modal').classList.remove('open');
    location.reload();
  } else {
    errEl.textContent = result.error;
    btn.disabled = false;
    btn.textContent = 'Confirm';
  }
}

// ── Documents tab ─────────────────────────────────────────────────────────────

async function loadDocuments() {
  const el = document.getElementById('tab-documents');
  const { data: docs, error } = await supabaseClient
    .from('order_documents')
    .select('id, created_at, document_type, file_name, file_size_bytes, source, mime_type, file_path')
    .eq('trade_id', tradeId)
    .order('created_at', { ascending: false });

  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }

  const typeLabels = {
    customer_po:'Customer PO', supplier_quote:'Supplier Quote', supplier_po:'Supplier PO',
    mill_certificate:'Mill Certificate', certificate_of_conformity:'Certificate of Conformity',
    bill_of_lading:'Bill of Lading', delivery_note:'Delivery Note', invoice:'Invoice',
    proof_of_delivery:'Proof of Delivery', concession_form:'Concession Form',
    dispute_record:'Dispute Record', other:'Other',
  };

  let html = `<div style="margin-bottom:var(--space-4)"><h3 style="margin-bottom:var(--space-3)">Upload Document</h3>
    <form onsubmit="uploadDocument(event)" style="display:flex;gap:var(--space-3);align-items:flex-end;flex-wrap:wrap">
      <div class="form-group" style="margin:0">
        <label class="form-label">Type</label>
        <select class="form-select" id="upload-doc-type">
          ${Object.entries(typeLabels).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label">File</label>
        <input type="file" id="upload-doc-file" class="form-input" style="padding:var(--space-1)" required />
      </div>
      <button type="submit" class="btn btn-primary btn-sm" id="upload-doc-btn">Upload</button>
    </form>
    <div id="upload-doc-error" style="color:var(--color-danger);font-size:var(--text-sm);margin-top:var(--space-2)"></div>
  </div><hr style="border:none;border-top:1px solid var(--color-border);margin-bottom:var(--space-4)">`;

  if (!docs || docs.length === 0) {
    html += '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No documents attached yet.</p>';
  } else {
    html += `<div class="table-wrapper"><table><thead><tr><th>Type</th><th>File Name</th><th>Size</th><th>Source</th><th>Uploaded</th><th></th></tr></thead><tbody>`;
    docs.forEach(d => {
      const size = d.file_size_bytes ? (d.file_size_bytes / 1024).toFixed(0) + ' KB' : '—';
      html += `<tr>
        <td><span class="badge badge-neutral">${esc(typeLabels[d.document_type] || d.document_type)}</span></td>
        <td>${esc(d.file_name)}</td>
        <td style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(size)}</td>
        <td style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(d.source?.replace('_',' '))}</td>
        <td style="color:var(--color-text-muted);font-size:var(--text-sm)">${fmtDate(d.created_at)}</td>
        <td><button onclick="downloadDoc('${esc(d.file_path)}','${esc(d.file_name)}')" class="btn btn-ghost btn-sm">↓</button></td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }
  el.innerHTML = html;
}

async function uploadDocument(e) {
  e.preventDefault();
  const btn   = document.getElementById('upload-doc-btn');
  const errEl = document.getElementById('upload-doc-error');
  const file  = document.getElementById('upload-doc-file').files[0];
  const type  = document.getElementById('upload-doc-type').value;
  if (!file) return;

  btn.disabled = true;
  btn.textContent = 'Uploading…';
  errEl.textContent = '';

  try {
    const path = `${tradeId}/${type}-${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabaseClient.storage.from('order-documents').upload(path, file);
    if (uploadErr) throw new Error(uploadErr.message);

    const { error: insertErr } = await supabaseClient.from('order_documents').insert({
      trade_id: tradeId, document_type: type, file_path: path,
      file_name: file.name, file_size_bytes: file.size,
      mime_type: file.type || 'application/octet-stream',
      uploaded_by: PortalRoles.getUserId(), source: 'manual_upload',
    });
    if (insertErr) throw new Error(insertErr.message);

    _tabLoaded.documents = false;
    loadDocuments();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Upload';
  }
}

async function downloadDoc(filePath, fileName) {
  const { data, error } = await supabaseClient.storage.from('order-documents').download(filePath);
  if (error) { showAlert(error.message, 'error'); return; }
  const url = URL.createObjectURL(data);
  const a   = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Emails tab ────────────────────────────────────────────────────────────────

async function loadEmails() {
  const el = document.getElementById('tab-emails');
  const { data: emails, error } = await supabaseClient
    .from('inbound_emails')
    .select('id, received_at, from_address, subject, processed')
    .eq('linked_trade_id', tradeId)
    .order('received_at', { ascending: false });

  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!emails || emails.length === 0) {
    el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No emails linked to this order.</p>';
    return;
  }

  el.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>From</th><th>Subject</th><th>Received</th><th>Processed</th></tr></thead>
    <tbody>${emails.map(em => `<tr>
      <td>${esc(em.from_address)}</td>
      <td>${esc(em.subject || '(no subject)')}</td>
      <td style="color:var(--color-text-muted);font-size:var(--text-sm)">${fmtDateTime(em.received_at)}</td>
      <td>${em.processed ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-neutral">No</span>'}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

// ── Verification log tab ──────────────────────────────────────────────────────

async function loadVerifLog() {
  const el = document.getElementById('tab-verif-log');
  const { data: items, error } = await supabaseClient
    .from('verification_queue')
    .select('id, created_at, queue_type, drafted_by, priority, sla_due_at, status, decision_at, decision_reason_code, decision_notes')
    .eq('trade_id', tradeId)
    .order('created_at', { ascending: false });

  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!items || items.length === 0) {
    el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No verification queue items for this order.</p>';
    return;
  }

  const statusClass = { pending:'badge-warning', in_review:'badge-info', approved:'badge-success', rejected:'badge-danger', cancelled:'badge-neutral' };
  el.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Type</th><th>Priority</th><th>SLA</th><th>Status</th><th>Decision</th><th>Reason</th></tr></thead>
    <tbody>${items.map(item => `<tr>
      <td>${esc(StateMachine.queueTypeLabel(item.queue_type))}</td>
      <td><span class="badge badge-neutral">${esc(item.priority)}</span></td>
      <td>${StateMachine.slaBadge(item.sla_due_at)}</td>
      <td><span class="badge ${statusClass[item.status]||'badge-neutral'}">${esc(item.status)}</span></td>
      <td style="color:var(--color-text-muted);font-size:var(--text-sm)">${item.decision_at ? fmtDateTime(item.decision_at) : '—'}</td>
      <td style="font-size:var(--text-sm)">${esc(item.decision_reason_code || '')} ${esc(item.decision_notes || '')}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

// ── Concession tab ────────────────────────────────────────────────────────────

async function loadConcession() {
  const el = document.getElementById('tab-concession');
  const { data: rows, error } = await supabaseClient
    .from('concessions').select('*').eq('trade_id', tradeId);

  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!rows || rows.length === 0) {
    el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No concession record for this order.</p>';
    return;
  }
  const c = rows[0];
  el.innerHTML = `<div class="panel"><div class="panel-body"><table style="width:100%;font-size:var(--text-sm)"><tbody>
    <tr><td style="color:var(--color-text-muted);width:35%;padding:var(--space-2) 0">Original Spec</td><td>${esc(c.original_specification)}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Actual Spec</td><td>${esc(c.actual_specification)}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Delta</td><td>${esc(c.delta_summary)}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Customer Signatory</td><td>${esc(c.customer_signatory_name || '—')} ${c.customer_signatory_email ? `(${esc(c.customer_signatory_email)})` : ''}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Signed</td><td>${fmtDate(c.customer_signed_at)}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Commercial Adjustment</td><td>${c.commercial_adjustment_gbp != null ? '£' + fmt(c.commercial_adjustment_gbp) : '—'}</td></tr>
  </tbody></table></div></div>`;
}

// ── Dispute tab ───────────────────────────────────────────────────────────────

async function loadDispute() {
  const el = document.getElementById('tab-dispute');
  const { data: rows, error } = await supabaseClient
    .from('disputes').select('*').eq('trade_id', tradeId);

  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!rows || rows.length === 0) {
    el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No dispute recorded for this order.</p>';
    return;
  }
  const d = rows[0];
  const statusClass = { open:'badge-danger', investigating:'badge-warning', supplier_notified:'badge-info', resolved:'badge-success', escalated:'badge-danger' };
  el.innerHTML = `<div class="panel"><div class="panel-body"><table style="width:100%;font-size:var(--text-sm)"><tbody>
    <tr><td style="color:var(--color-text-muted);width:35%;padding:var(--space-2) 0">Status</td><td><span class="badge ${statusClass[d.status]||'badge-neutral'}">${esc(d.status)}</span></td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Category</td><td>${esc(d.category)}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Raised By</td><td>${esc(d.raised_by)} on ${fmtDate(d.raised_at)}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Description</td><td>${esc(d.description)}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Resolution</td><td>${esc(d.resolution || '—')}</td></tr>
    <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Cost Attribution</td><td>${esc(d.cost_attribution || '—')}</td></tr>
  </tbody></table></div></div>`;
}

// ── Audit log tab ─────────────────────────────────────────────────────────────

async function loadAuditLog() {
  const el = document.getElementById('tab-audit-log');
  const { data: events, error } = await supabaseClient
    .from('order_events')
    .select('id, created_at, event_type, from_state, to_state, actor_role, reason_code, notes, evidence_ref')
    .eq('trade_id', tradeId)
    .order('created_at', { ascending: true });

  if (error) { el.innerHTML = `<div class="alert alert-error">${esc(error.message)}</div>`; return; }
  if (!events || events.length === 0) {
    el.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No audit events recorded yet.</p>';
    return;
  }

  const typeClass = { state_change:'badge-info', approval:'badge-success', rejection:'badge-danger', override:'badge-danger', note:'badge-neutral', document_attached:'badge-neutral', concession_decision:'badge-warning' };
  el.innerHTML = `
    <div style="text-align:right;margin-bottom:var(--space-3)"><button onclick="exportAuditLog()" class="btn btn-ghost btn-sm">Export CSV</button></div>
    <div class="table-wrapper"><table>
    <thead><tr><th>Time</th><th>Event</th><th>From</th><th>To</th><th>Role</th><th>Reason</th><th>Notes</th></tr></thead>
    <tbody>${events.map(ev => `<tr>
      <td style="font-size:var(--text-sm);color:var(--color-text-muted);white-space:nowrap">${fmtDateTime(ev.created_at)}</td>
      <td><span class="badge ${typeClass[ev.event_type]||'badge-neutral'}">${esc(ev.event_type?.replace('_',' '))}</span></td>
      <td style="font-size:var(--text-sm)">${ev.from_state ? StateMachine.stateDisplayName(ev.from_state) : '—'}</td>
      <td style="font-size:var(--text-sm)">${ev.to_state ? StateMachine.stateDisplayName(ev.to_state) : '—'}</td>
      <td style="font-size:var(--text-sm);color:var(--color-text-muted)">${esc(ev.actor_role || '—')}</td>
      <td style="font-size:var(--text-sm)">${esc(ev.reason_code || '—')}</td>
      <td style="font-size:var(--text-sm);max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(ev.notes || '')}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function exportAuditLog() {
  const rows = [['Time','Event','From','To','Role','Reason','Notes']];
  document.querySelectorAll('#tab-audit-log tbody tr').forEach(tr => {
    rows.push(Array.from(tr.querySelectorAll('td')).map(td => `"${td.textContent.replace(/"/g,'""')}"`));
  });
  const csv  = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `audit-log-${tradeId.slice(0,8)}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Alert helper ──────────────────────────────────────────────────────────────

function showAlert(msg, type = 'info') {
  const el = document.getElementById('page-alert');
  el.className = `alert alert-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'}`;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  if (!tradeId) { document.body.innerHTML = '<p style="padding:2rem">No order ID specified.</p>'; return; }

  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';

  await StateMachine.loadReference();

  const { data: trade, error } = await supabaseClient
    .from('trades')
    .select(`
      *, buyer:contacts!trades_buyer_id_fkey(id,company_name,email,country),
      supplier:contacts!trades_supplier_id_fkey(id,company_name,email,country),
      product_line:product_lines(id,name,cn_code)
    `)
    .eq('id', tradeId)
    .single();

  if (error || !trade) {
    document.body.innerHTML = `<p style="padding:2rem;color:var(--color-danger)">Order not found: ${esc(error?.message)}</p>`;
    return;
  }

  _trade = trade;
  renderTopBar(trade);
  renderSummary(trade);
  renderActionPanel(trade);

  // Load timeline and first (default) tab
  await loadTimeline();
  _tabLoaded.summary = true;

  // Load reason codes for the transition modal dropdown
  const { data: reasonCodes } = await supabaseClient.from('reason_codes').select('code, description').order('category');
  const rcSel = document.getElementById('transition-reason-code');
  if (rcSel && reasonCodes) {
    reasonCodes.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.code;
      opt.textContent = r.description;
      rcSel.appendChild(opt);
    });
  }
})();
