/**
 * Vertex Metals Portal — Supplier PO Drafting Form
 * Handles portal/orders/supplier-po.html
 *
 * Loaded when an order is in order_verified state and procurement
 * is ready to draft the supplier purchase order. Captures supplier
 * selection, pricing inputs, and live margin calculation, then
 * updates the trade's cost fields and transitions to supplier_po_drafted.
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

const tradeId = new URLSearchParams(location.search).get('id');
let _trade        = null;
let _productLine  = null;
let _activeQuotes = [];
let _savedPoId    = null;   // set after successful supplier_pos insert
let _savedPoRef   = null;

// ── Live pricing calculator ───────────────────────────────────────────────────

function recalculate() {
  const fob       = parseFloat(document.getElementById('f-fob').value)       || 0;
  const qty       = parseFloat(document.getElementById('f-qty').value)       || 0;
  const freight   = parseFloat(document.getElementById('f-freight').value)   || 0;
  const insurance = parseFloat(document.getElementById('f-insurance').value) || 0;
  const rate      = parseFloat(document.getElementById('f-rate').value)      || 0;
  const sellGBP   = _trade?.sell_price_gbp || 0;

  const totalCostUSD   = (fob * qty) + freight + insurance;
  const totalCostGBP   = rate > 0 ? totalCostUSD / rate : 0;
  const costPerMtGBP   = qty > 0 ? totalCostGBP / qty : 0;
  const marginGBP      = sellGBP > 0 ? sellGBP - totalCostGBP : null;
  const marginPct      = sellGBP > 0 && totalCostGBP > 0 ? ((sellGBP - totalCostGBP) / sellGBP) * 100 : null;

  document.getElementById('calc-cost-usd').textContent  = totalCostUSD > 0 ? '$' + fmt(totalCostUSD)  : '—';
  document.getElementById('calc-cost-gbp').textContent  = totalCostGBP > 0 ? '£' + fmt(totalCostGBP)  : '—';
  document.getElementById('calc-cost-mt').textContent   = costPerMtGBP > 0 ? '£' + fmt(costPerMtGBP) + '/MT' : '—';

  const marginEl = document.getElementById('calc-margin');
  if (marginGBP != null) {
    marginEl.textContent   = '£' + fmt(marginGBP) + (marginPct != null ? ' (' + fmt(marginPct, 1) + '%)' : '');
    marginEl.style.color   = marginGBP < 0 ? 'var(--color-danger)' : marginGBP < (sellGBP * 0.05) ? '#d97706' : 'var(--color-success, green)';
  } else {
    marginEl.textContent = '—';
    marginEl.style.color = '';
  }
}

function autoInsurance() {
  const fob = parseFloat(document.getElementById('f-fob').value) || 0;
  const qty = parseFloat(document.getElementById('f-qty').value) || 0;
  const insPct = _productLine?.insurance_pct || 0.00125;
  if (fob && qty) {
    document.getElementById('f-insurance').value = (fob * qty * insPct).toFixed(2);
    recalculate();
  }
}

// ── Supplier quote loading ────────────────────────────────────────────────────

async function onSupplierChange() {
  const supplierId    = document.getElementById('f-supplier').value;
  const productLineId = _trade?.product_line_id;
  await loadQuotesForSupplier(supplierId, productLineId);
}

async function loadQuotesForSupplier(supplierId, productLineId) {
  const sel = document.getElementById('f-quote');
  sel.innerHTML = '<option value="">— No quote (enter price manually) —</option>';
  _activeQuotes = [];

  if (!supplierId) return;

  const today = new Date().toISOString().split('T')[0];
  let query = supabaseClient
    .from('supplier_quotes')
    .select('id, fob_price_usd, quantity_mt, incoterm, validity_date, specification, notes')
    .eq('supplier_id', supplierId)
    .eq('status', 'active');

  if (productLineId) query = query.eq('product_line_id', productLineId);

  const { data } = await query.order('created_at', { ascending: false });
  _activeQuotes = data || [];

  const expiredGroup  = document.createElement('optgroup');
  expiredGroup.label  = '— Expired quotes (caution) —';
  let hasExpired = false;

  _activeQuotes.forEach(q => {
    const isExpired = q.validity_date && q.validity_date < today;
    const opt = document.createElement('option');
    opt.value          = q.id;
    opt.dataset.fob    = q.fob_price_usd;
    opt.dataset.incoterm = q.incoterm || '';
    opt.textContent    = `$${fmt(q.fob_price_usd)}/MT · ${esc(q.incoterm || 'FOB')} · valid to ${q.validity_date || 'no date'} · ${fmt(q.quantity_mt, 0)}MT`;
    if (isExpired) { expiredGroup.appendChild(opt); hasExpired = true; }
    else           sel.appendChild(opt);
  });
  if (hasExpired) sel.appendChild(expiredGroup);

  // Auto-select if exactly one active unexpired quote
  const active = _activeQuotes.filter(q => !q.validity_date || q.validity_date >= today);
  if (active.length === 1) { sel.value = active[0].id; onQuoteSelected(); }
}

function onQuoteSelected() {
  const sel    = document.getElementById('f-quote');
  const opt    = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) return;

  const fob     = opt.dataset.fob;
  const incoterm = opt.dataset.incoterm;

  if (fob) {
    document.getElementById('f-fob').value = fob;
    autoInsurance();
  }
  if (incoterm) {
    const incSel = document.getElementById('f-incoterms');
    if (incSel) incSel.value = incoterm;
  }
  recalculate();
}

// ── PO reference generator ────────────────────────────────────────────────────

function generatePoReference(id) {
  const now    = new Date();
  const ym     = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0');
  const suffix = (id || '').replace(/-/g, '').slice(-4).toUpperCase();
  return `VM-SPO-${ym}-${suffix}`;
}

// ── Form submission ───────────────────────────────────────────────────────────

async function submitSupplierPo(e) {
  e.preventDefault();
  const btn   = document.getElementById('submit-btn');
  const errEl = document.getElementById('form-error');
  errEl.textContent = '';
  btn.disabled      = true;
  btn.textContent   = 'Saving…';

  const supplierId    = document.getElementById('f-supplier').value;
  const fob           = parseFloat(document.getElementById('f-fob').value);
  const qty           = parseFloat(document.getElementById('f-qty').value);
  const freight       = parseFloat(document.getElementById('f-freight').value)   || 0;
  const insurance     = parseFloat(document.getElementById('f-insurance').value) || 0;
  const rate          = parseFloat(document.getElementById('f-rate').value);
  const notes         = document.getElementById('f-notes').value.trim()          || null;
  const paymentTerms  = document.getElementById('f-payment-terms')?.value.trim() || null;
  const conditions    = document.getElementById('f-conditions')?.value.trim()    || null;
  const incoterm      = document.getElementById('f-incoterms')?.value            || null;
  const origin        = document.getElementById('f-origin')?.value.trim()        || null;
  const dispatchDate  = document.getElementById('f-dispatch-date')?.value        || null;

  try {
    if (!supplierId)       throw new Error('Please select a supplier.');
    if (!fob || fob <= 0)  throw new Error('FOB price is required and must be greater than zero.');
    if (!rate || rate <= 0) throw new Error('Exchange rate is required.');
    if (!paymentTerms)     throw new Error('Payment terms are required.');

    const totalCostUSD = (fob * qty) + freight + insurance;
    const costPriceGBP = totalCostUSD / rate;
    const totalValueUSD = fob * qty;

    // 1. Generate or reuse PO reference
    const poRef = _savedPoRef || generatePoReference(tradeId);

    // 2. Save / upsert supplier_pos record
    let poSaveError;
    if (_savedPoId) {
      const { error } = await supabaseClient.from('supplier_pos').update({
        supplier_id:    supplierId,
        product_line_id: _trade?.product_line_id || null,
        product_spec:   _trade?.specification || _trade?.product || null,
        quantity_mt:    qty,
        unit_price_usd: fob,
        total_value_usd: totalValueUSD,
        incoterm,
        delivery_port:  origin,
        shipment_date:  dispatchDate,
        payment_terms:  paymentTerms,
        conditions,
        notes,
        status: 'draft',
      }).eq('id', _savedPoId);
      poSaveError = error;
    } else {
      const { data: poData, error } = await supabaseClient.from('supplier_pos').insert([{
        trade_id:        tradeId,
        po_reference:    poRef,
        supplier_id:     supplierId,
        product_line_id: _trade?.product_line_id || null,
        product_spec:    _trade?.specification || _trade?.product || null,
        quantity_mt:     qty,
        unit_price_usd:  fob,
        total_value_usd: totalValueUSD,
        incoterm,
        delivery_port:   origin,
        shipment_date:   dispatchDate,
        payment_terms:   paymentTerms,
        conditions,
        notes,
        status: 'draft',
      }]).select('id').single();
      poSaveError = error;
      if (poData) { _savedPoId = poData.id; _savedPoRef = poRef; }
    }
    if (poSaveError) throw new Error('Failed to save PO record: ' + poSaveError.message);

    // 3. Update trade cost fields
    const { error: updateErr } = await supabaseClient.from('trades').update({
      supplier_id:    supplierId,
      fob_price_usd:  fob,
      freight_usd:    freight,
      insurance_usd:  insurance,
      exchange_rate:  rate,
      cost_price_gbp: costPriceGBP,
      status:         'confirmed',
    }).eq('id', tradeId);
    if (updateErr) throw new Error(updateErr.message);

    // 4. Advance state or re-queue
    // If the trade is already at supplier_po_drafted (rejected and returned for
    // revision), the state machine won't allow a self-transition. Instead we
    // insert a fresh verification queue item directly — the same pattern used
    // by the order drafting flow on re-submission.
    const priority = document.getElementById('f-priority').value || 'routine';
    const slaHours = priority === 'expedite' ? 4 : 24;

    if (_trade?.current_state === 'supplier_po_drafted') {
      const actorId = PortalRoles.getUserId();
      const { error: queueErr } = await supabaseClient.from('verification_queue').insert({
        trade_id:   tradeId,
        queue_type: 'supplier_po_approval',
        drafted_by: actorId,
        priority,
        sla_due_at: new Date(Date.now() + slaHours * 3600_000).toISOString(),
        status:     'pending',
      });
      if (queueErr) throw new Error('Failed to queue for approval: ' + queueErr.message);
    } else {
      const result = await StateMachine.transition(tradeId, 'supplier_po_drafted', {
        actorRole: 'procurement',
        notes,
        priority,
      });
      if (!result.ok) throw new Error(result.error);
      // Update local state so a second save on this page uses the re-queue path
      _trade.current_state = 'supplier_po_drafted';
    }

    // 5. Show PDF download section
    btn.textContent = 'Saved — Resubmit';
    btn.disabled    = false;
    document.getElementById('pdf-section').style.display = 'block';
    document.getElementById('pdf-po-ref').textContent    = _savedPoRef || poRef;
    errEl.textContent = '';

  } catch (err) {
    errEl.textContent = err.message;
    btn.disabled      = false;
    btn.textContent   = _savedPoId ? 'Resubmit for Approval' : 'Submit for Approval';
  }
}

// ── PDF generation (WS5) ─────────────────────────────────────────────────────

async function generatePdf() {
  const alertEl = document.getElementById('pdf-alert');
  alertEl.style.display = 'none';

  if (!_savedPoId && !_savedPoRef) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Submit the PO first to generate a PDF.'; return;
  }

  const poRef      = _savedPoRef || document.getElementById('pdf-po-ref').textContent;
  const supplierId = document.getElementById('f-supplier').value;
  const fob        = parseFloat(document.getElementById('f-fob').value) || 0;
  const qty        = parseFloat(document.getElementById('f-qty').value) || 0;
  const incoterm   = document.getElementById('f-incoterms').value || '';
  const origin     = document.getElementById('f-origin').value || '';
  const shipDate   = document.getElementById('f-dispatch-date').value || '';
  const payTerms   = document.getElementById('f-payment-terms').value || '';
  const conditions = document.getElementById('f-conditions').value || '';
  const notes      = document.getElementById('f-notes').value.trim();

  // Fetch supplier details
  const { data: supplier } = await supabaseClient.from('contacts').select('company_name, country').eq('id', supplierId).single();

  // Populate template
  const T = id => document.getElementById(id);
  T('pt-po-ref').textContent       = poRef;
  T('pt-date').textContent         = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  T('pt-supplier-name').textContent = supplier?.company_name || '—';
  T('pt-supplier-country').textContent = supplier?.country || '';
  T('pt-product').textContent      = _trade?.product || '—';
  T('pt-spec').textContent         = _trade?.specification || '—';
  T('pt-qty').textContent          = fmt(qty, 0) + ' MT';
  T('pt-unit-price').textContent   = `USD ${fmt(fob)}/MT`;
  T('pt-total').textContent        = `USD ${fmt(fob * qty)}`;
  T('pt-incoterms').textContent    = incoterm || '—';
  T('pt-delivery-port').textContent = origin || '—';
  T('pt-shipment-date').textContent = shipDate ? new Date(shipDate).toLocaleDateString('en-GB') : '—';
  T('pt-order-ref').textContent    = _trade?.reference || '—';
  T('pt-payment-terms').textContent = payTerms || '—';
  T('pt-conditions').textContent   = conditions || '—';

  const notesBlock = T('pt-notes-block');
  if (notes) { notesBlock.style.display = 'block'; T('pt-notes').textContent = notes; }
  else        { notesBlock.style.display = 'none'; }

  // Show template briefly for html2pdf capture
  const template = document.getElementById('po-print-template');
  template.style.display = 'block';

  const filename = `${poRef}.pdf`;

  try {
    await html2pdf().set({
      margin:      [10, 10, 10, 10],
      filename,
      image:       { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(template).save();

    alertEl.style.display = 'block'; alertEl.className = 'alert alert-success';
    alertEl.textContent = `${filename} downloaded.`;
  } catch (err) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'PDF generation failed: ' + err.message;
  } finally {
    template.style.display = 'none';
  }
}

// ── Page init ─────────────────────────────────────────────────────────────────

async function init() {
  if (!tradeId) { document.body.innerHTML = '<p style="padding:2rem">No order ID specified.</p>'; return; }

  // Load trade with full context
  const { data: trade, error } = await supabaseClient
    .from('trades')
    .select(`
      *, buyer:contacts!trades_buyer_id_fkey(company_name, country),
      supplier:contacts!trades_supplier_id_fkey(company_name),
      product_line:product_lines(id, name, insurance_pct, default_markup_pct)
    `)
    .eq('id', tradeId)
    .single();

  if (error || !trade) {
    document.body.innerHTML = `<p style="padding:2rem;color:var(--color-danger)">Order not found.</p>`;
    return;
  }

  _trade       = trade;
  _productLine = trade.product_line;

  // Guard: can draft or resubmit supplier PO from order_verified or supplier_po_drafted.
  if (!['order_verified','supplier_po_drafted'].includes(trade.current_state)) {
    document.getElementById('form-error').textContent =
      `This order is currently in '${trade.current_state}' state. Supplier PO drafting is only available from 'order_verified' or when a supplier PO draft has been returned.`;
    document.getElementById('submit-btn').disabled = true;
  }

  if (trade.current_state === 'supplier_po_drafted') {
    document.getElementById('submit-btn').textContent = 'Resubmit for Approval';
  }

  document.title = `Supplier PO — ${trade.reference || tradeId.slice(0,8)} — Vertex Metals Portal`;
  document.getElementById('topbar-title').textContent = `Supplier PO — ${trade.reference || '—'}`;

  // Render customer order context panel
  document.getElementById('order-context').innerHTML = `
    <div class="panel">
      <div class="panel-header"><h3>Customer Order (verified)</h3></div>
      <div class="panel-body"><table style="width:100%;font-size:var(--text-sm)"><tbody>
        <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0;width:45%">Reference</td><td><strong>${esc(trade.reference || '—')}</strong></td></tr>
        <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Buyer</td><td>${esc(trade.buyer?.company_name || '—')}</td></tr>
        <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Customer PO Ref</td><td>${esc(trade.customer_po_reference || '—')}</td></tr>
        <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Product</td><td>${esc(trade.product || '—')}</td></tr>
        <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Specification</td><td style="font-family:monospace;font-size:11px">${esc(trade.specification || '—')}</td></tr>
        <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Quantity</td><td><strong>${fmt(trade.quantity_mt, 0)} MT</strong></td></tr>
        <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Customer Incoterms</td><td>${esc(trade.incoterms || '—')}</td></tr>
        <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Delivery To</td><td>${esc(trade.delivery_destination || '—')}</td></tr>
        <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Required By</td><td>${fmtDate(trade.required_delivery_date)}</td></tr>
        <tr><td style="color:var(--color-text-muted);padding:var(--space-2) 0">Agreed Sell Price</td><td><strong>£${fmt(trade.sell_price_gbp)}</strong></td></tr>
      </tbody></table>
      <div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--color-surface);border-radius:var(--radius-sm);font-size:var(--text-xs);color:var(--color-text-muted);line-height:1.6">
        The supplier PO specification must match the customer PO exactly. Any deviation requires a formal concession.
      </div>
    </div>
  `;

  // Pre-fill quantity from trade
  document.getElementById('f-qty').value = trade.quantity_mt || '';

  // Load approved suppliers
  const { data: suppliers } = await supabaseClient
    .from('contacts')
    .select('id, company_name, country, approval_status')
    .eq('type', 'supplier')
    .eq('approval_status', 'approved')
    .order('company_name');

  const suppSel = document.getElementById('f-supplier');
  (suppliers || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value       = s.id;
    opt.textContent = s.company_name + (s.country ? ` (${s.country})` : '');
    suppSel.appendChild(opt);
  });

  // Pre-select if supplier already assigned
  if (trade.supplier_id) {
    suppSel.value = trade.supplier_id;
    await loadQuotesForSupplier(trade.supplier_id, trade.product_line_id);
    // Pre-fill existing cost fields if previously drafted
    if (trade.fob_price_usd)  document.getElementById('f-fob').value      = trade.fob_price_usd;
    if (trade.freight_usd)    document.getElementById('f-freight').value   = trade.freight_usd;
    if (trade.insurance_usd)  document.getElementById('f-insurance').value = trade.insurance_usd;
    if (trade.exchange_rate)  document.getElementById('f-rate').value      = trade.exchange_rate;
    recalculate();
  }
}

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  await StateMachine.loadReference();
  await init();
})();
