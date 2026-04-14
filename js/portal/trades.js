/**
 * Vertex Metals Portal — Trades
 * Includes live pricing calculation in the new trade modal.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function tradeStatusBadge(status) {
  const map = {
    enquiry:    'neutral',
    quoted:     'info',
    confirmed:  'accent',
    in_transit: 'warning',
    delivered:  'success',
    invoiced:   'warning',
    complete:   'success',
  };
  const label = status ? status.replace('_', ' ') : '—';
  return `<span class="badge badge-${map[status] || 'neutral'}">${esc(label)}</span>`;
}

const STATUS_OPTIONS = ['enquiry','quoted','confirmed','in_transit','delivered','invoiced','complete'];

// ── Trades list ───────────────────────────────────────────────────────────────

async function loadTrades() {
  const statusFilter = document.getElementById('filter-status')?.value || '';
  const tbody = document.getElementById('trades-body');

  let query = supabaseClient
    .from('trades')
    .select(`
      id, reference, product, quantity_mt, sell_price_gbp, cost_price_gbp, status, created_at,
      buyer:contacts!trades_buyer_id_fkey(company_name),
      supplier:contacts!trades_supplier_id_fkey(company_name)
    `)
    .order('created_at', { ascending: false });

  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--color-danger);padding:var(--space-8)">${esc(error.message)}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No trades found.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(t => {
    const margin = (t.sell_price_gbp != null && t.cost_price_gbp != null)
      ? t.sell_price_gbp - t.cost_price_gbp : null;
    const marginStyle = margin != null && margin < 0 ? 'color:var(--color-danger)' : '';
    return `<tr style="cursor:pointer" onclick="window.location.href='detail.html?id=${esc(t.id)}'">
      <td style="font-family:var(--font-display);font-weight:600">${esc(t.reference || t.id.slice(0,8))}</td>
      <td>${esc(t.buyer?.company_name || '—')}</td>
      <td>${esc(t.supplier?.company_name || '—')}</td>
      <td>${esc(t.product || '—')}</td>
      <td>${fmt(t.quantity_mt, 0)}</td>
      <td>${t.sell_price_gbp != null ? '£' + fmt(t.sell_price_gbp) : '—'}</td>
      <td style="${marginStyle}">${margin != null ? '£' + fmt(margin) : '—'}</td>
      <td>${tradeStatusBadge(t.status)}</td>
    </tr>`;
  }).join('');
}

// ── New Trade Modal ───────────────────────────────────────────────────────────

// Module-level cache populated at init
let _productLines = [];
let _suppliers    = [];
let _buyers       = [];
let _activeQuotes = [];

async function buildTradeForm() {
  return `
    <form id="new-trade-form" onsubmit="submitTrade(event)" autocomplete="off">

      <!-- ① Trade reference & status -->
      <div class="form-grid" style="margin-bottom:var(--space-5)">
        <div class="form-group">
          <label class="form-label">Reference <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-input" id="tf-reference" placeholder="e.g. VM-2025-001" required />
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" id="tf-status">
            ${STATUS_OPTIONS.map(s => `<option value="${s}"${s==='enquiry'?' selected':''}>${s.replace('_',' ')}</option>`).join('')}
          </select>
        </div>
      </div>

      <hr style="border:none;border-top:1px solid var(--color-border);margin:0 0 var(--space-5)" />

      <!-- ② Product & supplier -->
      <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-4)">Product &amp; Parties</p>
      <div class="form-grid" style="margin-bottom:var(--space-4)">
        <div class="form-group">
          <label class="form-label">Product Line <span style="color:var(--color-danger)">*</span></label>
          <select class="form-select" id="tf-product-line" onchange="onTradeProductChange()" required>
            <option value="">— Select product —</option>
            ${_productLines.map(pl => `<option value="${esc(pl.id)}" data-markup="${pl.default_markup_pct}" data-vat="${(pl.vat_rate||0)*100}" data-ins="${pl.insurance_pct||0.125}">${esc(pl.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Supplier</label>
          <select class="form-select" id="tf-supplier" onchange="onTradeSupplierChange()">
            <option value="">— Select supplier —</option>
            ${_suppliers.map(c => `<option value="${esc(c.id)}">${esc(c.company_name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Buyer</label>
          <select class="form-select" id="tf-buyer">
            <option value="">— Select buyer —</option>
            ${_buyers.map(c => `<option value="${esc(c.id)}">${esc(c.company_name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Load from Supplier Quote</label>
          <select class="form-select" id="tf-quote" onchange="onTradeQuoteChange()">
            <option value="">— Select product &amp; supplier first —</option>
          </select>
        </div>
      </div>

      <hr style="border:none;border-top:1px solid var(--color-border);margin:0 0 var(--space-5)" />

      <!-- ③ Pricing inputs -->
      <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-4)">Pricing Inputs</p>
      <div class="form-grid" style="margin-bottom:var(--space-4)">
        <div class="form-group">
          <label class="form-label">FOB Price (USD / MT)</label>
          <input type="number" class="form-input" id="tf-fob" step="0.01" min="0" placeholder="e.g. 2400" oninput="onTradePricingChange()" />
        </div>
        <div class="form-group">
          <label class="form-label">Quantity (MT) <span style="color:var(--color-danger)">*</span></label>
          <input type="number" class="form-input" id="tf-qty" step="0.001" min="0" placeholder="e.g. 25" oninput="onTradePricingChange()" required />
        </div>
        <div class="form-group">
          <label class="form-label">Freight (USD total)</label>
          <input type="number" class="form-input" id="tf-freight" step="0.01" min="0" placeholder="e.g. 1800" oninput="onTradePricingChange()" />
        </div>
        <div class="form-group">
          <label class="form-label">Insurance (USD)</label>
          <input type="number" class="form-input" id="tf-insurance" step="0.01" min="0" placeholder="Auto-calculated" oninput="onTradePricingChange()" />
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)" id="tf-ins-hint">Auto-filled from product default when FOB &amp; qty are entered</span>
        </div>
        <div class="form-group">
          <label class="form-label">GBP / USD Rate</label>
          <input type="number" class="form-input" id="tf-rate" step="0.0001" min="0" placeholder="e.g. 1.2750" oninput="onTradePricingChange()" />
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">Lock the rate at time of trade</span>
        </div>
        <div class="form-group">
          <label class="form-label">Target Margin (%)</label>
          <input type="number" class="form-input" id="tf-markup" step="0.1" min="0" max="100" placeholder="e.g. 12" oninput="onTradePricingChange()" />
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">Pre-filled from product default — override as needed</span>
        </div>
        <div class="form-group">
          <label class="form-label">VAT Rate (%)</label>
          <input type="number" class="form-input" id="tf-vat" step="0.1" min="0" max="100" placeholder="20" oninput="onTradePricingChange()" />
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">Pre-filled from product — 0 if zero-rated / reverse charge</span>
        </div>
      </div>

      <!-- ④ Live calculation results -->
      <div id="tf-results" style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:var(--space-4) var(--space-5);margin-bottom:var(--space-5);display:none">
        <p style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:var(--space-3)">Live Calculation</p>
        <div id="tf-results-inner"></div>
      </div>

      <!-- ⑤ Notes -->
      <div class="form-group" style="margin-bottom:var(--space-5)">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="tf-notes" rows="2" placeholder="Additional trade details…"></textarea>
      </div>

      <div id="new-trade-alert" class="alert" style="display:none;margin-bottom:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3)">
        <button type="submit" class="btn btn-primary">Create Trade</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('new-trade-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;
}

// ── Live calculation event handlers ──────────────────────────────────────────

function onTradeProductChange() {
  const sel  = document.getElementById('tf-product-line');
  const opt  = sel.options[sel.selectedIndex];
  if (opt && opt.value) {
    const markup = opt.dataset.markup;
    const vat    = opt.dataset.vat;
    if (markup) document.getElementById('tf-markup').value = markup;
    if (vat)    document.getElementById('tf-vat').value    = parseFloat(vat).toFixed(1);
  }
  updateQuoteSelector();
  autoFillInsurance();
  onTradePricingChange();
}

function onTradeSupplierChange() {
  updateQuoteSelector();
}

function updateQuoteSelector() {
  const productId  = document.getElementById('tf-product-line')?.value;
  const supplierId = document.getElementById('tf-supplier')?.value;
  const sel        = document.getElementById('tf-quote');
  if (!sel) return;

  const relevant = _activeQuotes.filter(q =>
    (!productId  || q.product_line_id === productId) &&
    (!supplierId || q.supplier_id     === supplierId)
  );

  if (relevant.length === 0) {
    sel.innerHTML = '<option value="">— No active quotes match —</option>';
  } else {
    sel.innerHTML = '<option value="">— Select a quote to pre-fill —</option>' +
      relevant.map(q => {
        const validity = q.validity_date ? new Date(q.validity_date).toLocaleDateString('en-GB') : 'no expiry';
        const supplier = q.contacts?.company_name || '';
        return `<option value="${esc(q.id)}" data-fob="${q.fob_price_usd}">${esc(supplier)} — $${fmt(q.fob_price_usd)}/MT (valid ${validity})</option>`;
      }).join('');
  }
}

function onTradeQuoteChange() {
  const sel = document.getElementById('tf-quote');
  const opt = sel.options[sel.selectedIndex];
  if (opt?.dataset.fob) {
    document.getElementById('tf-fob').value = opt.dataset.fob;
    autoFillInsurance();
    onTradePricingChange();
  }
}

function autoFillInsurance() {
  const fob = parseFloat(document.getElementById('tf-fob')?.value) || 0;
  const qty = parseFloat(document.getElementById('tf-qty')?.value) || 0;
  if (!fob || !qty) return;

  const productSel = document.getElementById('tf-product-line');
  const opt = productSel?.options[productSel.selectedIndex];
  const insPct = opt?.dataset.ins ? parseFloat(opt.dataset.ins) : 0.125;
  const insurance = (fob * qty) * (insPct / 100);
  const insField = document.getElementById('tf-insurance');
  if (insField && !insField.value) {
    insField.value = insurance.toFixed(2);
  }
}

function onTradePricingChange() {
  autoFillInsurance();

  const fob       = parseFloat(document.getElementById('tf-fob')?.value)      || 0;
  const qty       = parseFloat(document.getElementById('tf-qty')?.value)       || 0;
  const freight   = parseFloat(document.getElementById('tf-freight')?.value)   || 0;
  const insurance = parseFloat(document.getElementById('tf-insurance')?.value) || 0;
  const rate      = parseFloat(document.getElementById('tf-rate')?.value)      || 0;
  const markup    = parseFloat(document.getElementById('tf-markup')?.value)    || 0;
  const vatPct    = parseFloat(document.getElementById('tf-vat')?.value)       || 0;

  const resultsBox = document.getElementById('tf-results');

  if (!fob || !qty || !rate) {
    resultsBox.style.display = 'none';
    return;
  }

  const totalFobUSD     = fob * qty;
  const totalCostUSD    = totalFobUSD + freight + insurance;
  const totalCostGBP    = totalCostUSD / rate;
  const costPerMtGBP    = totalCostGBP / qty;
  const sellPerMtGBP    = markup > 0 ? costPerMtGBP / (1 - markup / 100) : costPerMtGBP;
  const totalSellGBP    = sellPerMtGBP * qty;
  const grossMarginGBP  = totalSellGBP - totalCostGBP;
  const marginPct       = totalSellGBP > 0 ? (grossMarginGBP / totalSellGBP) * 100 : 0;
  const vatAmountGBP    = totalSellGBP * (vatPct / 100);
  const totalInvoicedGBP = totalSellGBP + vatAmountGBP;

  const row = (label, value, bold = false, color = 'var(--color-text-primary)') =>
    `<div style="display:flex;justify-content:space-between;padding:var(--space-1) 0;border-bottom:1px solid var(--color-border)">
      <span style="font-size:var(--text-sm);color:var(--color-text-muted)">${label}</span>
      <span style="font-family:var(--font-display);font-size:${bold?'var(--text-base)':'var(--text-sm)'};font-weight:${bold?700:500};color:${color}">${value}</span>
    </div>`;

  resultsBox.style.display = 'block';
  document.getElementById('tf-results-inner').innerHTML =
    row('Total FOB (USD)',          '$' + fmt(totalFobUSD)) +
    row('Total landed cost (USD)',  '$' + fmt(totalCostUSD)) +
    row('Total landed cost (GBP)',  '£' + fmt(totalCostGBP), true) +
    row('Cost per MT (GBP)',        '£' + fmt(costPerMtGBP)) +
    `<div style="border-top:2px solid var(--color-accent);margin:var(--space-2) 0"></div>` +
    row('Sell per MT (GBP)',        '£' + fmt(sellPerMtGBP), true, 'var(--color-accent)') +
    row('Total sell value (GBP)',   '£' + fmt(totalSellGBP), true, 'var(--color-accent)') +
    row('Gross margin (GBP)',       '£' + fmt(grossMarginGBP), true, grossMarginGBP >= 0 ? 'var(--color-success)' : 'var(--color-danger)') +
    row('Gross margin (%)',         fmt(marginPct, 1) + '%') +
    (vatPct > 0
      ? row('VAT (' + fmt(vatPct,1) + '%) (GBP)', '£' + fmt(vatAmountGBP)) +
        `<div style="border-top:2px solid var(--color-border);margin:var(--space-2) 0"></div>` +
        row('Total invoiced (GBP)', '£' + fmt(totalInvoicedGBP), true)
      : row('VAT', 'Zero-rated / N/A'));
}

// ── Submit new trade ──────────────────────────────────────────────────────────

async function submitTrade(e) {
  e.preventDefault();
  const alertEl = document.getElementById('new-trade-alert');

  const productLineId = document.getElementById('tf-product-line').value || null;
  const supplierId    = document.getElementById('tf-supplier').value     || null;
  const buyerId       = document.getElementById('tf-buyer').value        || null;
  const reference     = document.getElementById('tf-reference').value.trim();
  const status        = document.getElementById('tf-status').value;
  const notes         = document.getElementById('tf-notes').value.trim() || null;

  const fob       = parseFloat(document.getElementById('tf-fob').value)       || null;
  const qty       = parseFloat(document.getElementById('tf-qty').value)       || null;
  const freight   = parseFloat(document.getElementById('tf-freight').value)   || null;
  const insurance = parseFloat(document.getElementById('tf-insurance').value) || null;
  const rate      = parseFloat(document.getElementById('tf-rate').value)      || null;
  const markup    = parseFloat(document.getElementById('tf-markup').value)    ?? null;
  const vatPct    = parseFloat(document.getElementById('tf-vat').value)       ?? null;

  if (!reference) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Trade reference is required.'; return;
  }
  if (!qty) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Quantity is required.'; return;
  }

  // Compute derived GBP values to store
  let cost_price_gbp = null, sell_price_gbp = null, vat_amount_gbp = null;
  if (fob && qty && rate) {
    const totalCostUSD   = (fob * qty) + (freight || 0) + (insurance || 0);
    cost_price_gbp       = totalCostUSD / rate;
    const costPerMt      = cost_price_gbp / qty;
    const sellPerMt      = markup > 0 ? costPerMt / (1 - markup / 100) : costPerMt;
    sell_price_gbp       = sellPerMt * qty;
    vat_amount_gbp       = vatPct > 0 ? sell_price_gbp * (vatPct / 100) : 0;
  }

  // Resolve product name from product line
  const pl = _productLines.find(p => p.id === productLineId);
  const productName = pl?.name || null;

  const { error } = await supabaseClient.from('trades').insert([{
    reference,
    product:         productName,
    product_line_id: productLineId,
    buyer_id:        buyerId,
    supplier_id:     supplierId,
    quantity_mt:     qty,
    fob_price_usd:   fob,
    freight_usd:     freight,
    insurance_usd:   insurance,
    exchange_rate:   rate,
    markup_pct:      markup,
    vat_rate:        vatPct != null ? vatPct / 100 : null,
    vat_amount_gbp,
    cost_price_gbp,
    sell_price_gbp,
    status,
    notes,
  }]);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
  } else {
    document.getElementById('new-trade-modal').classList.remove('open');
    loadTrades();
  }
}

// ── Trade detail page ─────────────────────────────────────────────────────────

async function loadTradeDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { document.getElementById('trade-title').textContent = 'Trade not found'; return; }

  const { data: t, error } = await supabaseClient
    .from('trades')
    .select(`
      *,
      buyer:contacts!trades_buyer_id_fkey(id, company_name, email, phone),
      supplier:contacts!trades_supplier_id_fkey(id, company_name, email, phone),
      product_line:product_lines(name, cn_code)
    `)
    .eq('id', id)
    .single();

  if (error || !t) {
    document.getElementById('trade-title').textContent = 'Error loading trade';
    document.getElementById('trade-detail').innerHTML = `<div class="alert alert-error">${esc(error?.message || 'Not found')}</div>`;
    return;
  }

  document.getElementById('trade-title').textContent = t.reference || t.id.slice(0, 8);
  document.title = `Trade ${t.reference || ''} — Vertex Metals Portal`;

  const margin    = (t.sell_price_gbp != null && t.cost_price_gbp != null) ? t.sell_price_gbp - t.cost_price_gbp : null;
  const marginPct = margin != null && t.sell_price_gbp ? (margin / t.sell_price_gbp * 100) : null;
  const totalInvoiced = t.sell_price_gbp != null ? (t.sell_price_gbp + (t.vat_amount_gbp || 0)) : null;

  const dl = (label, value) => `
    <dt style="color:var(--color-text-muted);font-size:var(--text-sm);padding:var(--space-2) 0;border-bottom:1px solid var(--color-border)">${label}</dt>
    <dd style="font-weight:500;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border)">${value || '—'}</dd>`;

  document.getElementById('trade-detail').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6);margin-bottom:var(--space-6)">

      <!-- Trade info -->
      <div class="panel"><div class="panel-header">Trade Details</div><div class="panel-body">
        <dl style="display:grid;grid-template-columns:auto 1fr;gap:0 var(--space-6)">
          ${dl('Reference', `<span style="font-family:var(--font-display);font-weight:700">${esc(t.reference || '—')}</span>`)}
          ${dl('Product', esc(t.product || '—'))}
          ${dl('CN Code', esc(t.product_line?.cn_code || '—'))}
          ${dl('Quantity', fmt(t.quantity_mt, 0) + ' MT')}
          ${dl('Status', tradeStatusBadge(t.status))}
          ${dl('Created', new Date(t.created_at).toLocaleDateString('en-GB'))}
        </dl>
      </div></div>

      <!-- Pricing breakdown -->
      <div class="panel"><div class="panel-header">Pricing Breakdown</div><div class="panel-body">
        <dl style="display:grid;grid-template-columns:auto 1fr;gap:0 var(--space-6)">
          ${dl('FOB price (USD/MT)', t.fob_price_usd != null ? '$' + fmt(t.fob_price_usd) : '—')}
          ${dl('Freight (USD)', t.freight_usd != null ? '$' + fmt(t.freight_usd) : '—')}
          ${dl('Insurance (USD)', t.insurance_usd != null ? '$' + fmt(t.insurance_usd) : '—')}
          ${dl('GBP/USD rate', t.exchange_rate != null ? fmt(t.exchange_rate, 4) : '—')}
          ${dl('Landed cost (GBP)', t.cost_price_gbp != null ? '<strong>£' + fmt(t.cost_price_gbp) + '</strong>' : '—')}
          ${dl('Markup', t.markup_pct != null ? fmt(t.markup_pct, 1) + '%' : '—')}
          ${dl('Sell value (GBP)', t.sell_price_gbp != null ? `<strong style="color:var(--color-accent)">£${fmt(t.sell_price_gbp)}</strong>` : '—')}
          ${dl('Gross margin (GBP)', margin != null ? `<strong style="color:${margin>=0?'var(--color-success)':'var(--color-danger)'}">£${fmt(margin)}</strong>` : '—')}
          ${dl('Margin %', marginPct != null ? fmt(marginPct, 1) + '%' : '—')}
          ${dl('VAT rate', t.vat_rate != null ? fmt(t.vat_rate * 100, 1) + '%' : '—')}
          ${dl('VAT amount (GBP)', t.vat_amount_gbp != null ? '£' + fmt(t.vat_amount_gbp) : '—')}
          ${dl('Total invoiced (GBP)', totalInvoiced != null ? `<strong>£${fmt(totalInvoiced)}</strong>` : '—')}
        </dl>
      </div></div>
    </div>

    <!-- Parties -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6);margin-bottom:var(--space-6)">
      <div class="panel"><div class="panel-header">Buyer</div><div class="panel-body">
        ${t.buyer ? `<div style="font-weight:600">${esc(t.buyer.company_name)}</div><div style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(t.buyer.email||'')}</div>` : '<span style="color:var(--color-text-muted)">No buyer linked</span>'}
      </div></div>
      <div class="panel"><div class="panel-header">Supplier</div><div class="panel-body">
        ${t.supplier ? `<div style="font-weight:600">${esc(t.supplier.company_name)}</div><div style="color:var(--color-text-muted);font-size:var(--text-sm)">${esc(t.supplier.email||'')}</div>` : '<span style="color:var(--color-text-muted)">No supplier linked</span>'}
      </div></div>
    </div>

    <!-- Notes + status update -->
    <div style="display:grid;grid-template-columns:1fr 280px;gap:var(--space-6)">
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="trade-notes-field" rows="5">${esc(t.notes || '')}</textarea>
        <button class="btn btn-primary btn-sm" style="margin-top:var(--space-3)" onclick="saveTradeNotes('${esc(id)}')">Save Notes</button>
        <div id="notes-alert" class="alert" style="display:none;margin-top:var(--space-2)"></div>
      </div>
      <div>
        <div class="form-group">
          <label class="form-label">Update Status</label>
          <select class="form-select" id="trade-status-select">
            ${STATUS_OPTIONS.map(s => `<option value="${s}"${s===t.status?' selected':''}>${s.replace('_',' ')}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" style="width:100%;margin-top:var(--space-3)" onclick="saveTradeStatus('${esc(id)}')">Update Status</button>
          <div id="status-alert" class="alert" style="display:none;margin-top:var(--space-2)"></div>
        </div>
      </div>
    </div>`;
}

async function saveTradeNotes(id) {
  const notes = document.getElementById('trade-notes-field').value.trim() || null;
  const alertEl = document.getElementById('notes-alert');
  const { error } = await supabaseClient.from('trades').update({ notes }).eq('id', id);
  alertEl.style.display = 'block';
  alertEl.className = error ? 'alert alert-error' : 'alert alert-success';
  alertEl.textContent = error ? 'Save failed: ' + error.message : 'Notes saved.';
}

async function saveTradeStatus(id) {
  const status = document.getElementById('trade-status-select').value;
  const alertEl = document.getElementById('status-alert');
  const { error } = await supabaseClient.from('trades').update({ status }).eq('id', id);
  alertEl.style.display = 'block';
  alertEl.className = error ? 'alert alert-error' : 'alert alert-success';
  alertEl.textContent = error ? 'Update failed: ' + error.message : 'Status updated.';
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user?.email || '';

  if (document.getElementById('trades-body')) {
    // List page — load all reference data in parallel
    const [plRes, suppRes, buyRes, quoteRes] = await Promise.all([
      supabaseClient.from('product_lines').select('*').eq('active', true).order('name'),
      supabaseClient.from('contacts').select('id, company_name').eq('type', 'supplier').order('company_name'),
      supabaseClient.from('contacts').select('id, company_name').eq('type', 'buyer').order('company_name'),
      supabaseClient.from('supplier_quotes').select('*, contacts(company_name)').eq('status', 'active'),
    ]);

    _productLines = plRes.data  || [];
    _suppliers    = suppRes.data || [];
    _buyers       = buyRes.data  || [];
    _activeQuotes = quoteRes.data || [];

    const container = document.getElementById('trade-form-container');
    if (container) container.innerHTML = await buildTradeForm();

    loadTrades();
  } else if (document.getElementById('trade-detail')) {
    loadTradeDetail();
  }
})();
