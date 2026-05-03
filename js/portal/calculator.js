/**
 * Vertex Metals Portal — Pricing Calculator
 * Builds a sell price from supplier + logistics costs with three pricing models.
 */

function fmt(n, dp = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── State ─────────────────────────────────────────────────────────────────────

let allProductLines     = [];
let currentProduct      = null;
let supplierQuotes      = [];
let logisticsQuotes     = [];
let calculatedSellPerMt = null;
let costPerMtGbp        = null;

// ── Product cascade ───────────────────────────────────────────────────────────

async function loadAllProductLines() {
  const { data } = await supabaseClient.from('product_lines').select('*').eq('active', true)
    .order('metal_family').order('sub_type').order('name');
  allProductLines = data || [];

  const familySel = document.getElementById('sel-family');
  const families  = [...new Set(allProductLines.map(p => p.metal_family).filter(Boolean))].sort();
  families.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f; opt.textContent = f;
    familySel.appendChild(opt);
  });
}

function onFamilyChange() {
  const family   = document.getElementById('sel-family').value;
  const subtypes = [...new Set(
    allProductLines.filter(p => p.metal_family === family).map(p => p.sub_type).filter(Boolean)
  )].sort();

  const subSel = document.getElementById('sel-subtype');
  subSel.innerHTML = '<option value="">— Select subtype —</option>';
  subSel.disabled  = !family;
  subtypes.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; subSel.appendChild(o); });

  document.getElementById('sel-product').innerHTML = '<option value="">— Select product —</option>';
  document.getElementById('sel-product').disabled  = true;
  currentProduct = null;
  clearOutput();

  // If no subtypes exist for this family, skip subtype and load products directly
  if (family && subtypes.length === 0) {
    populateProductDropdown(family, null);
    subSel.disabled = true;
  }
}

function onSubtypeChange() {
  const family  = document.getElementById('sel-family').value;
  const subtype = document.getElementById('sel-subtype').value;
  populateProductDropdown(family, subtype);
}

function populateProductDropdown(family, subtype) {
  const products = allProductLines.filter(p =>
    p.metal_family === family && (subtype ? p.sub_type === subtype : true)
  );
  const sel = document.getElementById('sel-product');
  sel.innerHTML = '<option value="">— Select product —</option>';
  sel.disabled  = products.length === 0;
  products.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; sel.appendChild(o); });
}

async function onProductChange() {
  const id = document.getElementById('sel-product').value;
  currentProduct = allProductLines.find(p => p.id === id) || null;
  clearOutput();
  if (!currentProduct) return;

  // Product info strip
  document.getElementById('product-strip').classList.add('visible');
  document.getElementById('strip-markup').textContent = currentProduct.default_markup_pct != null ? `${fmt(currentProduct.default_markup_pct, 1)}%` : '—';
  document.getElementById('strip-std').textContent    = currentProduct.standard_sell_price_gbp != null ? `£${fmt(currentProduct.standard_sell_price_gbp)}` : 'Not set';
  document.getElementById('strip-mkt').textContent    = currentProduct.market_reference_price_gbp != null ? `£${fmt(currentProduct.market_reference_price_gbp)}` : 'Not set';
  const route = [currentProduct.default_origin_country, currentProduct.default_destination].filter(Boolean).join(' → ');
  document.getElementById('strip-route').textContent = route || '—';

  // Pre-fill insurance from product line
  if (currentProduct.insurance_pct != null) {
    document.getElementById('inp-insurance').value = currentProduct.insurance_pct;
  }

  // Load active supplier quotes linked to this product line
  const { data: sq } = await supabaseClient
    .from('supplier_quotes')
    .select('*, contacts(company_name)')
    .eq('product_line_id', id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  supplierQuotes = sq || [];

  const sqSel = document.getElementById('sel-supplier-quote');
  sqSel.innerHTML = '<option value="">— Select a quote —</option>';
  supplierQuotes.forEach(q => {
    const o = document.createElement('option');
    o.value = q.id;
    o.textContent = `${q.contacts?.company_name || 'Unknown'} — $${fmt(q.fob_price_usd)}/MT (${q.validity_date ? new Date(q.validity_date).toLocaleDateString('en-GB') : 'no expiry'})`;
    sqSel.appendChild(o);
  });
  if (supplierQuotes.length === 0) {
    sqSel.innerHTML = '<option value="">No active quotes for this product</option>';
  }

  // Load active logistics quotes matching the product's default route
  let lqQuery = supabaseClient.from('logistics_quotes').select('*, contacts(company_name)').eq('status', 'active');
  if (currentProduct.default_origin_country) lqQuery = lqQuery.ilike('origin_country', currentProduct.default_origin_country);
  if (currentProduct.default_destination)    lqQuery = lqQuery.ilike('destination_country', currentProduct.default_destination);
  const { data: lq } = await lqQuery.order('created_at', { ascending: false });
  logisticsQuotes = lq || [];

  const lqSel = document.getElementById('sel-logistics-quote');
  lqSel.innerHTML = '<option value="">— Select a quote —</option>';
  logisticsQuotes.forEach(q => {
    const o = document.createElement('option');
    o.value = q.id;
    const routeStr = [q.origin_country, q.destination_country].filter(Boolean).join(' → ');
    o.textContent = `${q.contacts?.company_name || 'Unknown'} — ${routeStr} — $${fmt(q.price_per_mt_usd)}/MT`;
    lqSel.appendChild(o);
  });
  if (logisticsQuotes.length === 0) {
    lqSel.innerHTML = '<option value="">No active quotes for this route</option>';
  }

  calculate();
}

// ── Source toggles ────────────────────────────────────────────────────────────

function onSupplierSourceChange() {
  const val = document.querySelector('input[name="supplier-source"]:checked')?.value;
  document.getElementById('supplier-quote-row').classList.toggle('hidden',  val !== 'quote');
  document.getElementById('supplier-avg-row').classList.toggle('hidden',    val !== 'average');
  document.getElementById('supplier-manual-row').classList.toggle('hidden', val !== 'manual');
  if (val === 'average') computeSupplierAverage();
  calculate();
}

async function computeSupplierAverage() {
  if (!currentProduct) { document.getElementById('supplier-avg-display').textContent = '—'; return; }
  const { data } = await supabaseClient
    .from('supplier_quotes')
    .select('fob_price_usd')
    .eq('product_line_id', currentProduct.id)
    .order('created_at', { ascending: false })
    .limit(5);
  if (!data || data.length === 0) {
    document.getElementById('supplier-avg-display').textContent = 'No quotes found for this product.';
    return;
  }
  const avg = data.reduce((s, q) => s + (q.fob_price_usd || 0), 0) / data.length;
  document.getElementById('supplier-avg-display').textContent = `$${fmt(avg)} USD/MT (avg of ${data.length})`;
  calculate();
}

function onSupplierQuoteSelect() {
  const id  = document.getElementById('sel-supplier-quote').value;
  const q   = supplierQuotes.find(x => x.id === id);
  const el  = document.getElementById('fob-used-display');
  if (q) { el.style.display = 'block'; document.getElementById('fob-used-val').textContent = fmt(q.fob_price_usd); }
  else   { el.style.display = 'none'; }
  calculate();
}

function onLogisticsSourceChange() {
  const val = document.querySelector('input[name="logistics-source"]:checked')?.value;
  document.getElementById('logistics-quote-row').classList.toggle('hidden',  val !== 'quote');
  document.getElementById('logistics-manual-row').classList.toggle('hidden', val !== 'manual');
  calculate();
}

// ── Pricing model ─────────────────────────────────────────────────────────────

function selectModel(model) {
  document.querySelectorAll('.model-option').forEach(el => el.classList.remove('selected'));
  document.getElementById(`model-opt-${model}`)?.classList.add('selected');
  document.querySelector(`input[name="pricing-model"][value="${model}"]`).checked = true;
  document.getElementById('min-margin-row').classList.toggle('hidden', model !== 'best');
  calculate();
}

// ── Quantity sync ─────────────────────────────────────────────────────────────

function syncQtySlider() {
  const v = parseFloat(document.getElementById('inp-qty').value) || 1;
  document.getElementById('qty-slider').value = Math.min(Math.max(v, 1), 500);
}

function syncQtyInput() {
  document.getElementById('inp-qty').value = document.getElementById('qty-slider').value;
}

// ── Cost resolution ───────────────────────────────────────────────────────────

function getFobPerMt() {
  const source = document.querySelector('input[name="supplier-source"]:checked')?.value;
  if (source === 'quote') {
    const id = document.getElementById('sel-supplier-quote').value;
    const q  = supplierQuotes.find(x => x.id === id);
    return q ? q.fob_price_usd : null;
  }
  if (source === 'average') {
    const txt = document.getElementById('supplier-avg-display').textContent;
    const m   = txt.match(/\$([\d,.]+)/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : null;
  }
  if (source === 'manual') {
    return parseFloat(document.getElementById('supplier-manual-fob').value) || null;
  }
  return null;
}

function getFreightPerMt() {
  const source = document.querySelector('input[name="logistics-source"]:checked')?.value;
  if (source === 'quote') {
    const id = document.getElementById('sel-logistics-quote').value;
    const q  = logisticsQuotes.find(x => x.id === id);
    return q ? q.price_per_mt_usd : null;
  }
  if (source === 'manual') {
    return parseFloat(document.getElementById('logistics-manual-freight').value) || null;
  }
  return null;
}

// ── Main calculation ──────────────────────────────────────────────────────────

function calculate() {
  const fobPerMt     = getFobPerMt();
  const freightPerMt = getFreightPerMt() || 0;
  const insurancePct = parseFloat(document.getElementById('inp-insurance').value) || 0;
  const otherPerMt   = parseFloat(document.getElementById('inp-overheads').value) || 0;
  const rate         = parseFloat(document.getElementById('inp-rate').value)      || 0;
  const qty          = parseFloat(document.getElementById('inp-qty').value)       || 0;
  const model        = document.querySelector('input[name="pricing-model"]:checked')?.value || 'standard';
  const out          = document.getElementById('calc-output');

  if (!fobPerMt || !rate || !qty) {
    const hints = [];
    if (!fobPerMt) hints.push('select or enter a supplier cost');
    if (!rate)     hints.push('enter the GBP/USD exchange rate');
    if (!qty)      hints.push('enter a quantity');
    out.innerHTML = `<div style="color:var(--color-text-muted);font-size:var(--text-sm)">To see results, ${hints.join(', ')}.</div>`;
    document.getElementById('override-panel').style.display = 'none';
    document.getElementById('save-panel').style.display     = 'none';
    calculatedSellPerMt = null;
    costPerMtGbp        = null;
    return;
  }

  const insurancePerMt    = fobPerMt * (insurancePct / 100);
  const totalCostUsdPerMt = fobPerMt + freightPerMt + insurancePerMt + otherPerMt;
  costPerMtGbp            = totalCostUsdPerMt / rate;

  // Sell price from chosen model
  let sellPerMt = null;
  let modelNote = '';

  if (model === 'standard') {
    const markup = currentProduct?.default_markup_pct ?? 10;
    sellPerMt = costPerMtGbp / (1 - markup / 100);
    modelNote = `Standard markup: ${fmt(markup, 1)}%`;
  } else if (model === 'best') {
    const minMargin = parseFloat(document.getElementById('inp-min-margin').value) || 5;
    sellPerMt = costPerMtGbp / (1 - minMargin / 100);
    modelNote = `Best price — minimum margin: ${fmt(minMargin, 1)}%`;
  } else if (model === 'market') {
    const mkt = currentProduct?.market_reference_price_gbp;
    if (!mkt) {
      out.innerHTML = `<div class="alert alert-warning">Market reference price not set for this product line. Edit the product line to add one, then return here.</div>`;
      document.getElementById('override-panel').style.display = 'none';
      document.getElementById('save-panel').style.display     = 'none';
      calculatedSellPerMt = null;
      return;
    }
    sellPerMt = mkt;
    modelNote = `Market reference price: £${fmt(mkt)}/MT`;
  }

  calculatedSellPerMt    = sellPerMt;
  const grossPerMt       = sellPerMt - costPerMtGbp;
  const marginPct        = (grossPerMt / sellPerMt) * 100;
  const totalSell        = sellPerMt * qty;
  const totalCost        = costPerMtGbp * qty;
  const totalGross       = totalSell - totalCost;
  const profitColor      = grossPerMt >= 0 ? 'var(--color-success,#22c55e)' : 'var(--color-danger)';

  out.innerHTML = `
    <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-3);font-style:italic">${esc(modelNote)}</div>
    <div class="result-row"><span class="result-label">Supplier FOB (USD/MT)</span><span class="result-val">$${fmt(fobPerMt)}</span></div>
    <div class="result-row"><span class="result-label">Freight (USD/MT)</span><span class="result-val">$${fmt(freightPerMt)}</span></div>
    <div class="result-row"><span class="result-label">Insurance (USD/MT)</span><span class="result-val">$${fmt(insurancePerMt)}</span></div>
    ${otherPerMt ? `<div class="result-row"><span class="result-label">Other overheads (USD/MT)</span><span class="result-val">$${fmt(otherPerMt)}</span></div>` : ''}
    <div class="result-row"><span class="result-label">Total landed cost (USD/MT)</span><span class="result-val">$${fmt(totalCostUsdPerMt)}</span></div>
    <div class="result-row"><span class="result-label">Total landed cost (GBP/MT)</span><span class="result-val" style="font-weight:700">£${fmt(costPerMtGbp)}</span></div>
    <hr class="divider">
    <div class="result-row"><span class="result-label">Sell price (GBP/MT)</span><span class="result-val highlight">£${fmt(sellPerMt)}</span></div>
    <div class="result-row"><span class="result-label">Gross profit (GBP/MT)</span><span class="result-val" style="color:${profitColor}">£${fmt(grossPerMt)}</span></div>
    <div class="result-row"><span class="result-label">Gross margin</span><span class="result-val" style="color:${profitColor}">${fmt(marginPct, 1)}%</span></div>
    <hr class="divider">
    <div class="result-row"><span class="result-label" style="font-weight:600">Total for ${fmt(qty, 0)} MT</span><span></span></div>
    <div class="result-row"><span class="result-label">Total sell value (GBP)</span><span class="result-val">£${fmt(totalSell)}</span></div>
    <div class="result-row"><span class="result-label">Total gross profit (GBP)</span><span class="result-val" style="color:${profitColor};font-size:var(--text-lg)">£${fmt(totalGross)}</span></div>
  `;

  // Override slider: range from cost price to 2× sell price
  document.getElementById('override-panel').style.display = 'block';
  document.getElementById('save-panel').style.display     = 'block';
  document.getElementById('save-price-display').textContent = `£${fmt(sellPerMt)}/MT`;

  const slider = document.getElementById('override-slider');
  slider.min   = Math.floor(costPerMtGbp);
  slider.max   = Math.ceil(sellPerMt * 2);
  slider.value = Math.round(sellPerMt);
  document.getElementById('override-slider-max-label').textContent = `£${fmt(Math.ceil(sellPerMt * 2))}/MT`;
  updateOverrideDisplay(sellPerMt);
}

// ── Override slider ───────────────────────────────────────────────────────────

function onOverrideSlide() {
  const override = parseFloat(document.getElementById('override-slider').value);
  updateOverrideDisplay(override);
  document.getElementById('save-price-display').textContent = `£${fmt(override)}/MT`;
}

function updateOverrideDisplay(priceGbp) {
  if (!costPerMtGbp || !calculatedSellPerMt) return;
  const grossMt   = priceGbp - costPerMtGbp;
  const marginPct = (grossMt / priceGbp) * 100;
  const stdPrice  = currentProduct?.standard_sell_price_gbp;
  const varPct    = stdPrice ? ((priceGbp - stdPrice) / stdPrice) * 100 : null;
  const profitColor = grossMt >= 0 ? 'var(--color-success,#22c55e)' : 'var(--color-danger)';

  document.getElementById('override-price-display').textContent  = `£${fmt(priceGbp)}/MT`;
  document.getElementById('override-margin-display').textContent = `${fmt(marginPct, 1)}%`;
  document.getElementById('override-margin-display').style.color = profitColor;

  const badge = document.getElementById('override-variance-badge');
  if (varPct != null) {
    badge.textContent = `${varPct >= 0 ? '+' : ''}${fmt(varPct, 1)}% vs std`;
    badge.className   = `variance-badge ${varPct >= 0 ? 'variance-pos' : 'variance-neg'}`;
    document.getElementById('override-vs-std').textContent = `Standard: £${fmt(stdPrice)}/MT`;
  } else {
    badge.textContent = 'No std set';
    badge.className   = 'variance-badge variance-pos';
    document.getElementById('override-vs-std').textContent = 'No standard price set on this product line yet';
  }
}

function resetOverride() {
  if (!calculatedSellPerMt) return;
  document.getElementById('override-slider').value = Math.round(calculatedSellPerMt);
  updateOverrideDisplay(calculatedSellPerMt);
  document.getElementById('save-price-display').textContent = `£${fmt(calculatedSellPerMt)}/MT`;
}

// ── Save as standard ──────────────────────────────────────────────────────────

async function saveAsStandard() {
  const alertEl = document.getElementById('save-standard-alert');
  if (!currentProduct) return;

  const priceToSave = parseFloat(document.getElementById('override-slider').value);
  if (!priceToSave || priceToSave <= 0) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'No valid price to save.'; return;
  }

  const { error } = await supabaseClient.from('product_lines').update({
    standard_sell_price_gbp: priceToSave,
    pricing_last_reviewed:   new Date().toISOString().split('T')[0],
  }).eq('id', currentProduct.id);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
  } else {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-success';
    alertEl.textContent   = `Standard price £${fmt(priceToSave)}/MT saved to ${esc(currentProduct.name)}.`;
    currentProduct.standard_sell_price_gbp = priceToSave;
    document.getElementById('strip-std').textContent = `£${fmt(priceToSave)}`;
    const idx = allProductLines.findIndex(p => p.id === currentProduct.id);
    if (idx !== -1) allProductLines[idx].standard_sell_price_gbp = priceToSave;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clearOutput() {
  calculatedSellPerMt = null;
  costPerMtGbp        = null;
  document.getElementById('product-strip').classList.remove('visible');
  document.getElementById('calc-output').innerHTML = '<div style="color:var(--color-text-muted);font-size:var(--text-sm)">Select a product and enter costs to see results.</div>';
  document.getElementById('override-panel').style.display = 'none';
  document.getElementById('save-panel').style.display     = 'none';
  document.getElementById('sel-supplier-quote').innerHTML  = '<option value="">— Select a quote —</option>';
  document.getElementById('sel-logistics-quote').innerHTML = '<option value="">— Select a quote —</option>';
  document.getElementById('fob-used-display').style.display     = 'none';
  document.getElementById('freight-used-display').style.display = 'none';
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  document.getElementById('user-email').textContent = user?.email || '';
  await loadAllProductLines();
})();
