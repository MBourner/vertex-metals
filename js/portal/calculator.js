/**
 * Vertex Metals Portal — Markup Calculator
 */

function fmt(n, decimals = 2) {
  if (isNaN(n) || n === null) return '—';
  return n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function calculate() {
  const fob      = parseFloat(document.getElementById('fob').value) || 0;
  const qty      = parseFloat(document.getElementById('qty').value) || 0;
  const freight  = parseFloat(document.getElementById('freight').value) || 0;
  const ins      = parseFloat(document.getElementById('insurance').value) || 0;
  const rate     = parseFloat(document.getElementById('rate').value) || 0;
  const margin   = parseFloat(document.getElementById('margin').value) || 0;

  if (!fob || !qty || !rate) {
    document.getElementById('results').innerHTML = '<div style="color:var(--color-text-muted);font-size:var(--text-sm)">Enter FOB price, quantity, and exchange rate to see results.</div>';
    return;
  }

  const totalCostUSD   = (fob * qty) + freight + ins;
  const totalCostGBP   = totalCostUSD / rate;
  const costPerMtGBP   = totalCostGBP / qty;
  const sellPerMtGBP   = costPerMtGBP / (1 - margin / 100);
  const totalSellGBP   = sellPerMtGBP * qty;
  const grossMarginGBP = totalSellGBP - totalCostGBP;
  const marginPct      = ((grossMarginGBP / totalSellGBP) * 100);

  document.getElementById('results').innerHTML = `
    ${resultRow('Total FOB cost (USD)', '$' + fmt(fob * qty))}
    ${resultRow('Total landed cost (USD)', '$' + fmt(totalCostUSD), true)}
    ${resultRow('Total landed cost (GBP)', '£' + fmt(totalCostGBP), true)}
    ${resultRow('Cost per MT (GBP)', '£' + fmt(costPerMtGBP))}
    <div style="border-top:2px solid var(--color-accent);margin:var(--space-4) 0"></div>
    ${resultRow('Suggested sell per MT (GBP)', '£' + fmt(sellPerMtGBP), true, 'var(--color-accent)')}
    ${resultRow('Total sell value (GBP)', '£' + fmt(totalSellGBP), true, 'var(--color-accent)')}
    ${resultRow('Gross margin (GBP)', '£' + fmt(grossMarginGBP), true)}
    ${resultRow('Gross margin (%)', fmt(marginPct, 1) + '%', true)}`;
}

function resultRow(label, value, bold = false, color = 'var(--color-text-primary)') {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border)">
    <span style="font-size:var(--text-sm);color:var(--color-text-muted)">${label}</span>
    <span style="font-family:var(--font-display);font-size:${bold?'var(--text-xl)':'var(--text-base)'};font-weight:${bold?700:500};color:${color}">${value}</span>
  </div>`;
}

async function saveQuote() {
  const fob       = parseFloat(document.getElementById('fob').value);
  const qty       = parseFloat(document.getElementById('qty').value);
  const supplier  = document.getElementById('save-supplier').value;
  const product   = document.getElementById('save-product').value.trim();
  const validity  = document.getElementById('save-validity').value;
  const alertEl   = document.getElementById('save-alert');

  if (!supplier || !product || !fob || !qty) {
    alertEl.style.display = 'block';
    alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Supplier, product, FOB price, and quantity are required.';
    return;
  }

  const { error } = await supabaseClient.from('supplier_quotes').insert([{
    supplier_id: supplier, product, fob_price_usd: fob, quantity_mt: qty,
    validity_date: validity || null, incoterm: 'FOB', status: 'active',
  }]);

  if (error) {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-error';
    alertEl.textContent = 'Save failed: ' + error.message;
  } else {
    alertEl.style.display = 'block'; alertEl.className = 'alert alert-success';
    alertEl.textContent = 'Quote saved successfully.';
  }
}

// Load suppliers for the save dropdown
(async () => {
  const user = await getCurrentUser();
  document.getElementById('user-email').textContent = user?.email || '';

  const { data } = await supabaseClient.from('contacts').select('id, company_name').eq('type','supplier').order('company_name');
  if (data) {
    const sel = document.getElementById('save-supplier');
    data.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.company_name;
      sel.appendChild(opt);
    });
  }
})();
