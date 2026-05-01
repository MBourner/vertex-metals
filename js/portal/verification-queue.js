/**
 * Vertex Metals Portal — Verification Queue
 * Handles portal/verification-queue/index.html
 *
 * Two-column layout: left = filtered queue list, right = detail pane.
 * Decisions call StateMachine.decide() which enforces four-eyes server-side.
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
  return new Date(d).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
}
function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (h >= 24) return `${Math.floor(h/24)}d ago`;
  if (h >= 1)  return `${h}h ago`;
  if (m >= 1)  return `${m}m ago`;
  return 'just now';
}

let _allItems      = [];
let _selectedId    = null;
let _reasonCodes   = [];
const _currentUser = { id: null };

// ── Queue loading ─────────────────────────────────────────────────────────────

async function loadQueue() {
  const filterType   = document.getElementById('filter-type')?.value   || '';
  const filterStatus = document.getElementById('filter-status')?.value || 'open';
  const showOverdue  = document.getElementById('filter-overdue')?.checked;

  const listEl = document.getElementById('vq-list');
  listEl.innerHTML = '<div style="padding:var(--space-6);color:var(--color-text-muted);font-size:var(--text-sm)">Loading…</div>';

  let query = supabaseClient
    .from('verification_queue')
    .select(`
      id, created_at, queue_type, drafted_by, priority, sla_due_at, status,
      trade:trades(
        id, reference, current_state, product, specification,
        quantity_mt, sell_price_gbp, cost_price_gbp,
        customer_po_reference, incoterms, delivery_destination,
        required_delivery_date, payment_terms, notes,
        buyer:contacts!trades_buyer_id_fkey(id, company_name, country),
        supplier:contacts!trades_supplier_id_fkey(
          id, company_name, approval_status, next_audit_due_date, last_sanctions_screened_at
        )
      )
    `)
    .order('sla_due_at', { ascending: true });

  if (filterStatus === 'open') {
    query = query.in('status', ['pending','in_review']);
  } else if (filterStatus === 'decided-today') {
    const today = new Date(); today.setHours(0,0,0,0);
    query = query.in('status', ['approved','rejected']).gte('decision_at', today.toISOString());
  } else {
    query = query.in('status', ['pending','in_review']);
  }

  if (filterType) query = query.eq('queue_type', filterType);

  const { data, error } = await query;

  if (error) {
    listEl.innerHTML = `<div style="padding:var(--space-6);color:var(--color-danger);font-size:var(--text-sm)">${esc(error.message)}</div>`;
    return;
  }

  _allItems = data || [];

  let items = _allItems;
  if (showOverdue) items = items.filter(i => StateMachine.slaStatus(i.sla_due_at) === 'overdue');

  if (items.length === 0) {
    listEl.innerHTML = '<div style="padding:var(--space-6);color:var(--color-text-muted);font-size:var(--text-sm);text-align:center">Queue is clear ✓</div>';
    return;
  }

  listEl.innerHTML = items.map(renderRow).join('');

  // Auto-select item from URL param (e.g. linked from order detail)
  const highlight = new URLSearchParams(location.search).get('highlight');
  if (highlight && items.find(i => i.id === highlight)) {
    selectItem(highlight);
  }
}

function renderRow(item) {
  const sla      = StateMachine.slaStatus(item.sla_due_at);
  const slaColor = sla === 'overdue' ? 'var(--color-danger)' : sla === 'soon' ? '#d97706' : 'var(--color-text-muted)';
  const isYours  = item.drafted_by === _currentUser.id;
  const selected = item.id === _selectedId ? 'background:rgba(122,184,212,.10);border-left:3px solid var(--color-accent)' : 'border-left:3px solid transparent';
  const typeLabel = StateMachine.queueTypeLabel(item.queue_type);
  const typeBadgeClass = {
    po_translation:'badge-info', supplier_po_approval:'badge-accent',
    release_approval:'badge-warning', invoice_review:'badge-success',
  }[item.queue_type] || 'badge-neutral';

  const slaText = new Date(item.sla_due_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

  return `<div class="vq-row" onclick="selectItem('${esc(item.id)}')"
    style="padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--color-border);cursor:pointer;${selected};transition:background .15s"
    onmouseenter="this.style.background='rgba(122,184,212,.06)'" onmouseleave="this.style.background='${item.id===_selectedId?'rgba(122,184,212,.10)':''}'"
    id="row-${esc(item.id)}">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
      <span class="badge ${typeBadgeClass}" style="font-size:10px">${esc(typeLabel)}</span>
      <span class="badge badge-neutral" style="font-size:10px">${esc(item.priority)}</span>
    </div>
    <div style="font-family:var(--font-display);font-weight:600;font-size:var(--text-sm);margin-bottom:2px">
      ${esc(item.trade?.reference || item.trade?.id?.slice(0,8) || '—')}
    </div>
    <div style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-2)">
      ${esc(item.trade?.buyer?.company_name || '—')}
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px">
      <span style="color:${slaColor}">SLA: ${esc(slaText)}</span>
      <span style="color:var(--color-text-muted)">${esc(timeAgo(item.created_at))}</span>
    </div>
    ${isYours ? '<div style="font-size:10px;color:var(--color-text-muted);margin-top:var(--space-1)">Drafted by you</div>' : ''}
  </div>`;
}

// ── Item selection and detail rendering ───────────────────────────────────────

async function selectItem(itemId) {
  _selectedId = itemId;

  // Re-render list to update selection highlight
  document.querySelectorAll('.vq-row').forEach(el => {
    const id = el.id.replace('row-','');
    el.style.background = id === itemId ? 'rgba(122,184,212,.10)' : '';
    el.style.borderLeft  = id === itemId ? '3px solid var(--color-accent)' : '3px solid transparent';
  });

  const item = _allItems.find(i => i.id === itemId);
  if (!item) return;

  const detailEl = document.getElementById('vq-detail');
  detailEl.innerHTML = '<div style="padding:var(--space-6);color:var(--color-text-muted);font-size:var(--text-sm)">Loading context…</div>';

  try {
    switch (item.queue_type) {
      case 'po_translation':      await renderPoTranslation(item, detailEl);   break;
      case 'supplier_po_approval':await renderSupplierPo(item, detailEl);      break;
      case 'release_approval':    await renderReleaseApproval(item, detailEl); break;
      case 'invoice_review':      await renderInvoiceReview(item, detailEl);   break;
      default:
        detailEl.innerHTML = `<div style="padding:var(--space-6)">Unknown queue type: ${esc(item.queue_type)}</div>`;
    }
  } catch (err) {
    detailEl.innerHTML = `<div style="padding:var(--space-6);color:var(--color-danger)">Failed to load context: ${esc(err.message)}</div>`;
  }
}

// ── Shared rendering helpers ──────────────────────────────────────────────────

function queueItemHeader(item) {
  const typeLabel = StateMachine.queueTypeLabel(item.queue_type);
  const sla = StateMachine.slaBadge(item.sla_due_at);
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-5);flex-wrap:wrap;gap:var(--space-3)">
      <div>
        <h2 style="margin:0 0 var(--space-1)">${esc(typeLabel)}</h2>
        <div style="font-size:var(--text-sm);color:var(--color-text-muted)">
          ${StateMachine.stateBadge(item.trade?.current_state)}
          <span style="margin-left:var(--space-2)">${esc(item.trade?.reference || '—')}</span>
        </div>
      </div>
      <div style="text-align:right;font-size:var(--text-sm)">
        <div>SLA: ${sla}</div>
        <div style="color:var(--color-text-muted);margin-top:2px">Submitted ${esc(timeAgo(item.created_at))}</div>
      </div>
    </div>
    <a href="../orders/detail.html?id=${esc(item.trade?.id)}" target="_blank"
       style="font-size:var(--text-sm);color:var(--color-accent);text-decoration:none">
      Open full order record ↗
    </a>
    <hr style="border:none;border-top:1px solid var(--color-border);margin:var(--space-5) 0">
  `;
}

function decisionPanel(item) {
  const isYourDraft = item.drafted_by === _currentUser.id;
  const disabledAttr = isYourDraft ? 'disabled' : '';
  const rcOptions = _reasonCodes.map(r =>
    `<option value="${esc(r.code)}">${esc(r.description)}</option>`
  ).join('');

  return `
    <hr style="border:none;border-top:2px solid var(--color-border);margin:var(--space-6) 0">
    <h3 style="margin-bottom:var(--space-4)">Decision</h3>
    ${isYourDraft ? `<div class="alert alert-info" style="margin-bottom:var(--space-4)">
      <strong>Four-eyes rule.</strong> You drafted this item. A different user must approve or reject it.
    </div>` : ''}
    <div class="form-grid" style="margin-bottom:var(--space-3)">
      <div class="form-group">
        <label class="form-label">Reason Code <small style="color:var(--color-text-muted)">(required to reject)</small></label>
        <select class="form-select" id="decision-reason">
          <option value="">— None —</option>
          ${rcOptions}
        </select>
      </div>
    </div>
    <div class="form-group" style="margin-bottom:var(--space-4)">
      <label class="form-label">Notes for drafter / audit log</label>
      <textarea class="form-textarea" id="decision-notes" rows="3"
        placeholder="Describe what you verified, or why you are rejecting"></textarea>
    </div>
    <div id="decision-error" style="font-size:var(--text-sm);margin-bottom:var(--space-3)"></div>
    <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;align-items:center">
      <button onclick="submitDecision('approved')" class="btn btn-primary" ${disabledAttr}
        title="${isYourDraft ? 'You cannot approve your own submission' : ''}">
        ✓ Approve
      </button>
      <button onclick="submitDecision('rejected')" class="btn btn-secondary"
        style="border-color:var(--color-danger);color:var(--color-danger)">
        ✗ Reject — Return to Drafter
      </button>
      <button onclick="saveInReview()" class="btn btn-sm"
        style="border:1px solid var(--color-border);background:var(--color-surface-raised);margin-left:auto"
        title="Save your notes and mark as in review without making a final decision">
        Save notes (in review)
      </button>
    </div>
  `;
}

function kv(label, value, danger = false) {
  return `<tr>
    <td style="color:var(--color-text-muted);padding:var(--space-2) var(--space-3) var(--space-2) 0;width:40%;font-size:var(--text-sm);vertical-align:top">${esc(label)}</td>
    <td style="font-size:var(--text-sm);padding:var(--space-2) 0;${danger?'color:var(--color-danger);font-weight:600':''}">${value}</td>
  </tr>`;
}

function complianceBadge(value, thresholdDays, label) {
  if (!value) return `<span style="color:var(--color-danger);font-weight:600">Not on record</span>`;
  const daysAgo = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  const overdue = daysAgo > thresholdDays;
  const color   = overdue ? 'var(--color-danger)' : daysAgo > thresholdDays * 0.8 ? '#d97706' : 'inherit';
  return `<span style="color:${color}">${esc(fmtDate(value))} (${daysAgo}d ago${overdue?' — <strong>OVERDUE</strong>':''})</span>`;
}

// ── PO Translation detail ─────────────────────────────────────────────────────

async function renderPoTranslation(item, el) {
  const trade = item.trade;

  // Load supplementary context in parallel
  const [historyRes, kycRes, sanctionsRes, docsRes] = await Promise.all([
    supabaseClient.from('trades')
      .select('reference, product, quantity_mt, sell_price_gbp, current_state, created_at')
      .eq('buyer_id', trade.buyer?.id)
      .neq('id', trade.id)
      .order('created_at', { ascending: false })
      .limit(8),
    supabaseClient.from('kyc_records')
      .select('kyc_status, risk_rating, last_screened_date, next_review_date')
      .eq('contact_id', trade.buyer?.id)
      .limit(1),
    supabaseClient.from('sanctions_screens')
      .select('screened_at, result, lists_screened')
      .eq('subject_id', trade.buyer?.id)
      .order('screened_at', { ascending: false })
      .limit(1),
    supabaseClient.from('order_documents')
      .select('id, document_type, file_name, file_path')
      .eq('trade_id', trade.id)
      .in('document_type', ['customer_po','other']),
  ]);

  const history   = historyRes.data   || [];
  const kyc       = kycRes.data?.[0]  || null;
  const sanctions = sanctionsRes.data?.[0] || null;
  const docs      = docsRes.data      || [];

  // Price comparison flag
  let priceFlag = '';
  const sameProduct = history.filter(h => h.product === trade.product && h.sell_price_gbp);
  if (sameProduct.length > 0 && trade.sell_price_gbp) {
    const avg = sameProduct.reduce((s, h) => s + h.sell_price_gbp, 0) / sameProduct.length;
    const diff = Math.abs(trade.sell_price_gbp - avg) / avg;
    if (diff > 0.20) {
      const dir = trade.sell_price_gbp > avg ? 'above' : 'below';
      priceFlag = `<div class="alert" style="background:#fef3c7;border:1px solid #f59e0b;padding:var(--space-3);border-radius:var(--radius-sm);margin-top:var(--space-3);font-size:var(--text-sm)">
        ⚠ Price is ${(diff*100).toFixed(0)}% ${esc(dir)} the average for this product (avg £${fmt(avg)}). Verify with the customer PO.
      </div>`;
    }
  }

  // KYC / sanctions status flags
  const kycOk      = kyc?.kyc_status === 'approved';
  const kycColor   = kycOk ? 'inherit' : 'var(--color-danger)';
  const riskColor  = kyc?.risk_rating === 'high' ? 'var(--color-danger)' : kyc?.risk_rating === 'medium' ? '#d97706' : 'inherit';
  const sanctOk    = sanctions && (Date.now() - new Date(sanctions.screened_at).getTime()) < 90 * 86400000;

  let html = queueItemHeader(item);

  // Order fields panel
  html += `<div class="panel" style="margin-bottom:var(--space-4)">
    <div class="panel-header"><h3>Order as Drafted — verify against attached PO</h3></div>
    <div class="panel-body">
      <table style="width:100%"><tbody>
        ${kv('Order Reference',    esc(trade.reference || '—'))}
        ${kv('Customer PO Ref',   `<strong>${esc(trade.customer_po_reference || '—')}</strong>`)}
        ${kv('Buyer',              esc(trade.buyer?.company_name || '—') + (trade.buyer?.country ? ` (${esc(trade.buyer.country)})` : ''))}
        ${kv('Product',            esc(trade.product || '—'))}
        ${kv('Specification',     `<span style="font-family:monospace;font-size:11px">${esc(trade.specification || '—')}</span>`)}
        ${kv('Quantity',           trade.quantity_mt != null ? fmt(trade.quantity_mt, 0) + ' MT' : '—')}
        ${kv('Agreed Price (GBP)', trade.sell_price_gbp != null ? '£' + fmt(trade.sell_price_gbp) : '—')}
        ${kv('Incoterms',          esc(trade.incoterms || '—'))}
        ${kv('Delivery To',        esc(trade.delivery_destination || '—'))}
        ${kv('Required Delivery',  fmtDate(trade.required_delivery_date))}
        ${kv('Payment Terms',      esc(trade.payment_terms || '—'))}
      </tbody></table>
      ${priceFlag}
      ${trade.notes ? `<div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--color-surface);border-radius:var(--radius-sm);font-size:var(--text-sm)"><strong>Operator notes:</strong> ${esc(trade.notes)}</div>` : ''}
    </div>
  </div>`;

  // PO document
  if (docs.length > 0) {
    html += `<div class="panel" style="margin-bottom:var(--space-4)">
      <div class="panel-header"><h3>Attached PO Document</h3></div>
      <div class="panel-body">${docs.map(d =>
        `<div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border)">
          <span style="font-size:var(--text-sm)">${esc(d.file_name)}</span>
          <button onclick="viewDoc('${esc(d.file_path)}','${esc(d.file_name)}')" class="btn btn-sm" style="border:1px solid var(--color-border);background:var(--color-surface-raised)">View ↗</button>
        </div>`
      ).join('')}</div>
    </div>`;
  } else {
    html += `<div class="alert" style="background:#fef3c7;border:1px solid #f59e0b;padding:var(--space-3);border-radius:var(--radius-sm);margin-bottom:var(--space-4);font-size:var(--text-sm)">
      ⚠ No PO document is attached to this order. Request the operator to upload it before approving.
    </div>`;
  }

  // Customer history
  html += `<div class="panel" style="margin-bottom:var(--space-4)">
    <div class="panel-header"><h3>Customer Order History (last 8)</h3></div>
    <div class="panel-body">`;
  if (history.length === 0) {
    html += '<p style="font-size:var(--text-sm);color:var(--color-text-muted)">No previous orders for this customer.</p>';
  } else {
    html += `<div class="table-wrapper"><table><thead><tr><th>Reference</th><th>Product</th><th>Qty</th><th>Sell (GBP)</th><th>State</th></tr></thead><tbody>
      ${history.map(h => `<tr>
        <td style="font-size:var(--text-sm)">${esc(h.reference || '—')}</td>
        <td style="font-size:var(--text-sm)">${esc(h.product || '—')}</td>
        <td style="font-size:var(--text-sm)">${fmt(h.quantity_mt, 0)}</td>
        <td style="font-size:var(--text-sm)">${h.sell_price_gbp != null ? '£' + fmt(h.sell_price_gbp) : '—'}</td>
        <td>${StateMachine.stateBadge(h.current_state)}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
  }
  html += '</div></div>';

  // Compliance
  html += `<div class="panel" style="margin-bottom:var(--space-4)">
    <div class="panel-header"><h3>Compliance — Buyer</h3></div>
    <div class="panel-body"><table style="width:100%"><tbody>
      ${kv('KYC Status',      kyc ? `<span style="color:${kycColor};font-weight:600">${esc(kyc.kyc_status)}</span>` : '<span style="color:var(--color-danger)">No KYC record</span>')}
      ${kv('Risk Rating',     kyc ? `<span style="color:${riskColor}">${esc(kyc.risk_rating)}</span>` : '—')}
      ${kv('KYC Next Review', kyc ? complianceBadge(kyc.next_review_date, 0, 'review') : '—')}
      ${kv('Last Sanctions Screen', sanctions
        ? `${complianceBadge(sanctions.screened_at, 90, 'screen')} — <span style="${sanctions.result==='clear'?'':'color:var(--color-danger);font-weight:600'}">${esc(sanctions.result)}</span>`
        : '<span style="color:var(--color-danger);font-weight:600">Never screened</span>')}
    </tbody></table></div>
  </div>`;

  html += decisionPanel(item);
  el.innerHTML = html;
}

// ── Supplier PO Approval detail ───────────────────────────────────────────────

async function renderSupplierPo(item, el) {
  const trade = item.trade;
  const supplier = trade.supplier;

  // Load supplier sanctions history
  const { data: sanctionsRows } = await supabaseClient
    .from('sanctions_screens')
    .select('screened_at, result')
    .eq('subject_id', supplier?.id)
    .order('screened_at', { ascending: false })
    .limit(1);
  const sanctions = sanctionsRows?.[0] || null;

  // Load supplier KYC
  const { data: kycRows } = await supabaseClient
    .from('kyc_records')
    .select('kyc_status, risk_rating, next_review_date')
    .eq('contact_id', supplier?.id)
    .limit(1);
  const kyc = kycRows?.[0] || null;

  const approvalColor = {
    approved:'inherit', prospect:'var(--color-text-muted)',
    under_audit:'#d97706', suspended:'var(--color-danger)', delisted:'var(--color-danger)',
  }[supplier?.approval_status] || 'inherit';

  const margin = trade.sell_price_gbp != null && trade.cost_price_gbp != null
    ? trade.sell_price_gbp - trade.cost_price_gbp : null;
  const marginPct = margin != null && trade.sell_price_gbp
    ? (margin / trade.sell_price_gbp * 100).toFixed(1) : null;

  const auditDue = supplier?.next_audit_due_date;
  const auditOverdue = auditDue && new Date(auditDue) < new Date();

  let html = queueItemHeader(item);

  html += `<div class="panel" style="margin-bottom:var(--space-4)">
    <div class="panel-header"><h3>Sales Order (already verified)</h3></div>
    <div class="panel-body"><table style="width:100%"><tbody>
      ${kv('Customer', esc(trade.buyer?.company_name || '—'))}
      ${kv('Product', esc(trade.product || '—'))}
      ${kv('Specification', `<span style="font-family:monospace;font-size:11px">${esc(trade.specification || '—')}</span>`)}
      ${kv('Quantity', trade.quantity_mt != null ? fmt(trade.quantity_mt, 0) + ' MT' : '—')}
      ${kv('Sell Price (GBP)', trade.sell_price_gbp != null ? '£' + fmt(trade.sell_price_gbp) : '—')}
      ${kv('Incoterms', esc(trade.incoterms || '—'))}
      ${kv('Delivery To', esc(trade.delivery_destination || '—'))}
    </tbody></table></div>
  </div>`;

  html += `<div class="panel" style="margin-bottom:var(--space-4)">
    <div class="panel-header"><h3>Supplier PO Details</h3></div>
    <div class="panel-body"><table style="width:100%"><tbody>
      ${kv('Supplier', esc(supplier?.company_name || '—'))}
      ${kv('Approval Status', `<span style="color:${approvalColor};font-weight:600">${esc(supplier?.approval_status || '—')}</span>`,
           supplier?.approval_status && supplier.approval_status !== 'approved')}
      ${kv('Next Audit Due', auditDue
        ? `<span style="color:${auditOverdue ? 'var(--color-danger)' : 'inherit'};font-weight:${auditOverdue?'600':'400'}">${fmtDate(auditDue)}${auditOverdue ? ' — OVERDUE' : ''}</span>`
        : '—', auditOverdue)}
      ${kv('Cost Price (GBP)', trade.cost_price_gbp != null ? '£' + fmt(trade.cost_price_gbp) : '—')}
      ${kv('Gross Margin', margin != null
        ? `£${fmt(margin)} (${marginPct}%)` : '—',
        margin != null && margin < 0)}
    </tbody></table></div>
  </div>`;

  html += `<div class="panel" style="margin-bottom:var(--space-4)">
    <div class="panel-header"><h3>Compliance — Supplier</h3></div>
    <div class="panel-body"><table style="width:100%"><tbody>
      ${kv('KYC Status', kyc
        ? `<span style="${kyc.kyc_status!=='approved'?'color:var(--color-danger);font-weight:600':''}">${esc(kyc.kyc_status)}</span>`
        : '<span style="color:var(--color-danger)">No KYC record</span>')}
      ${kv('KYC Next Review', kyc ? complianceBadge(kyc.next_review_date, 0, 'review') : '—')}
      ${kv('Last Sanctions Screen', sanctions
        ? `${complianceBadge(sanctions.screened_at, 90, 'screen')} — <span style="${sanctions.result==='clear'?'':'color:var(--color-danger);font-weight:600'}">${esc(sanctions.result)}</span>`
        : '<span style="color:var(--color-danger);font-weight:600">Never screened</span>')}
    </tbody></table></div>
  </div>`;

  html += decisionPanel(item);
  el.innerHTML = html;
}

// ── Release Approval detail ───────────────────────────────────────────────────

async function renderReleaseApproval(item, el) {
  const trade = item.trade;

  const [docsRes, concessionRes] = await Promise.all([
    supabaseClient.from('order_documents')
      .select('id, document_type, file_name, file_path, created_at')
      .eq('trade_id', trade.id)
      .order('document_type'),
    supabaseClient.from('concessions')
      .select('*').eq('trade_id', trade.id).limit(1),
  ]);

  const docs      = docsRes.data      || [];
  const concession = concessionRes.data?.[0] || null;

  const docTypeLabel = {
    mill_certificate:'Mill Certificate', certificate_of_conformity:'Certificate of Conformity',
    bill_of_lading:'Bill of Lading', delivery_note:'Delivery Note',
    customer_po:'Customer PO', supplier_po:'Supplier PO',
    invoice:'Invoice', proof_of_delivery:'Proof of Delivery',
    concession_form:'Concession Form', dispute_record:'Dispute Record', other:'Other',
  };

  const keyDocs = ['mill_certificate','certificate_of_conformity','bill_of_lading'];
  const missingKeyDocs = keyDocs.filter(t => !docs.find(d => d.document_type === t));

  let html = queueItemHeader(item);

  if (missingKeyDocs.length > 0) {
    html += `<div class="alert" style="background:#fef3c7;border:1px solid #f59e0b;padding:var(--space-3);border-radius:var(--radius-sm);margin-bottom:var(--space-4);font-size:var(--text-sm)">
      ⚠ Missing key documents: ${missingKeyDocs.map(t => esc(docTypeLabel[t] || t)).join(', ')}
    </div>`;
  }

  html += `<div class="panel" style="margin-bottom:var(--space-4)">
    <div class="panel-header"><h3>Documents on File</h3></div>
    <div class="panel-body">`;
  if (docs.length === 0) {
    html += '<p style="font-size:var(--text-sm);color:var(--color-text-muted)">No documents attached.</p>';
  } else {
    docs.forEach(d => {
      const isKey = keyDocs.includes(d.document_type);
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border)">
        <div>
          <span class="badge ${isKey?'badge-success':'badge-neutral'}">${esc(docTypeLabel[d.document_type]||d.document_type)}</span>
          <span style="font-size:var(--text-sm);margin-left:var(--space-2)">${esc(d.file_name)}</span>
        </div>
        <button onclick="viewDoc('${esc(d.file_path)}','${esc(d.file_name)}')" class="btn btn-sm" style="border:1px solid var(--color-border);background:var(--color-surface-raised)">View ↗</button>
      </div>`;
    });
  }
  html += '</div></div>';

  html += `<div class="panel" style="margin-bottom:var(--space-4)">
    <div class="panel-header"><h3>Order Specification</h3></div>
    <div class="panel-body"><table style="width:100%"><tbody>
      ${kv('Product', esc(trade.product || '—'))}
      ${kv('Specification', `<span style="font-family:monospace;font-size:11px">${esc(trade.specification || '—')}</span>`)}
      ${kv('Quantity', trade.quantity_mt != null ? fmt(trade.quantity_mt, 0) + ' MT' : '—')}
      ${kv('Incoterms', esc(trade.incoterms || '—'))}
    </tbody></table></div>
  </div>`;

  if (concession) {
    html += `<div class="panel" style="margin-bottom:var(--space-4);border:1px solid #f59e0b">
      <div class="panel-header" style="background:#fffbeb"><h3>⚠ Concession Granted</h3></div>
      <div class="panel-body"><table style="width:100%"><tbody>
        ${kv('Original Spec', esc(concession.original_specification))}
        ${kv('Actual Spec',   esc(concession.actual_specification))}
        ${kv('Delta',         esc(concession.delta_summary))}
        ${kv('Signed By',     esc(concession.customer_signatory_name || '—'))}
        ${kv('Signed At',     fmtDate(concession.customer_signed_at))}
      </tbody></table></div>
    </div>`;
  }

  html += decisionPanel(item);
  el.innerHTML = html;
}

// ── Invoice Review detail ─────────────────────────────────────────────────────

async function renderInvoiceReview(item, el) {
  const trade = item.trade;

  const { data: invDocs } = await supabaseClient
    .from('order_documents')
    .select('id, file_name, file_path, document_type')
    .eq('trade_id', trade.id)
    .eq('document_type', 'invoice');

  const margin = trade.sell_price_gbp != null && trade.cost_price_gbp != null
    ? trade.sell_price_gbp - trade.cost_price_gbp : null;

  let html = queueItemHeader(item);

  html += `<div class="panel" style="margin-bottom:var(--space-4)">
    <div class="panel-header"><h3>Trade Summary</h3></div>
    <div class="panel-body"><table style="width:100%"><tbody>
      ${kv('Reference', esc(trade.reference || '—'))}
      ${kv('Buyer', esc(trade.buyer?.company_name || '—'))}
      ${kv('Product', esc(trade.product || '—'))}
      ${kv('Quantity', trade.quantity_mt != null ? fmt(trade.quantity_mt, 0) + ' MT' : '—')}
      ${kv('Invoice Value (GBP)', trade.sell_price_gbp != null ? '<strong>£' + fmt(trade.sell_price_gbp) + '</strong>' : '—')}
      ${kv('Gross Margin', margin != null ? '£' + fmt(margin) : '—', margin != null && margin < 0)}
      ${kv('Payment Terms', esc(trade.payment_terms || '—'))}
    </tbody></table></div>
  </div>`;

  if (invDocs && invDocs.length > 0) {
    html += `<div class="panel" style="margin-bottom:var(--space-4)">
      <div class="panel-header"><h3>Invoice Document</h3></div>
      <div class="panel-body">${invDocs.map(d =>
        `<div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:var(--text-sm)">${esc(d.file_name)}</span>
          <button onclick="viewDoc('${esc(d.file_path)}','${esc(d.file_name)}')" class="btn btn-sm" style="border:1px solid var(--color-border);background:var(--color-surface-raised)">View ↗</button>
        </div>`
      ).join('')}</div>
    </div>`;
  } else {
    html += `<div class="alert" style="background:#fef3c7;border:1px solid #f59e0b;padding:var(--space-3);border-radius:var(--radius-sm);margin-bottom:var(--space-4);font-size:var(--text-sm)">
      ⚠ No invoice document is attached.
    </div>`;
  }

  html += decisionPanel(item);
  el.innerHTML = html;
}

// ── Save notes without deciding ───────────────────────────────────────────────

async function saveInReview() {
  const notes = document.getElementById('decision-notes')?.value?.trim();
  const errEl = document.getElementById('decision-error');

  if (!notes) {
    errEl.style.color = 'var(--color-danger)';
    errEl.textContent = 'Enter some notes before saving.';
    return;
  }

  const item = _allItems.find(i => i.id === _selectedId);
  if (!item) return;

  // Mark the queue item as in_review so others can see it is being looked at
  await supabaseClient
    .from('verification_queue')
    .update({ status: 'in_review' })
    .eq('id', _selectedId);

  // Write a note event to the audit log
  await supabaseClient.from('order_events').insert({
    trade_id:   item.trade.id,
    event_type: 'note',
    from_state: item.trade.current_state,
    to_state:   item.trade.current_state,
    actor_id:   PortalRoles.getUserId(),
    actor_role: PortalRoles.getRoles()[0] || null,
    notes,
  });

  errEl.style.color = 'green';
  errEl.textContent = 'Notes saved — item marked as in review.';
  setTimeout(() => { errEl.textContent = ''; errEl.style.color = ''; }, 4000);
  loadQueue(); // refresh the list so the item shows 'in_review' status
}

// ── Decision submission ───────────────────────────────────────────────────────

async function submitDecision(decision) {
  const errEl      = document.getElementById('decision-error');
  const reason     = document.getElementById('decision-reason')?.value || null;
  const notes      = document.getElementById('decision-notes')?.value?.trim() || null;

  if (decision === 'rejected' && !reason && !notes) {
    errEl.textContent = 'Please provide a reason code or notes when rejecting.';
    return;
  }

  errEl.textContent = '';
  document.querySelectorAll('#vq-detail button').forEach(b => b.disabled = true);

  const result = await StateMachine.decide(_selectedId, decision, {
    reasonCode: reason,
    notes,
  });

  if (result.ok) {
    const msg = decision === 'approved' ? 'Approved — order advanced.' : 'Rejected — returned to drafter.';
    document.getElementById('vq-detail').innerHTML = `
      <div style="padding:var(--space-8);text-align:center">
        <div class="badge ${decision==='approved'?'badge-success':'badge-danger'}" style="font-size:var(--text-base);padding:var(--space-3) var(--space-5)">${esc(msg)}</div>
        <p style="margin-top:var(--space-4);color:var(--color-text-muted)">Reloading queue…</p>
      </div>`;
    _selectedId = null;
    setTimeout(loadQueue, 1000);
  } else {
    document.querySelectorAll('#vq-detail button').forEach(b => b.disabled = false);
    errEl.textContent = result.error;
  }
}

// ── Document viewer ───────────────────────────────────────────────────────────

async function viewDoc(filePath, fileName) {
  const { data, error } = await supabaseClient.storage.from('order-documents').download(filePath);
  if (error) { alert('Could not load document: ' + error.message); return; }
  const url = URL.createObjectURL(data);
  window.open(url, '_blank');
  // Revoke after a short delay to allow the tab to load
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  _currentUser.id = user?.id || null;
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';

  await StateMachine.loadReference();

  // Load reason codes for the decision panel
  const { data: rc } = await supabaseClient.from('reason_codes').select('code, description').order('category');
  _reasonCodes = rc || [];

  await loadQueue();
})();
