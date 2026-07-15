/**
 * Vertex Metals — Customer-Facing Quote Page
 * Accessed via magic link: /customer-quote/?token={uuid}
 * Uses Supabase anon key — no auth required.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmt(n, dp = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-GB') : '—'; }

const VERTEX = {
  name:    'Vertex Metals Ltd',
  addr1:   'No 3 Falcon Cliff',
  addr2:   '9–10 Palace Road, Douglas',
  addr3:   'Isle of Man, IM2 4LD',
  email:   'sales@vertexmetalsltd.com',
  reg:     'Incorporated in the Isle of Man under the Companies Act 1931',
};

let _quoteId = null;

async function init() {
  const token = new URLSearchParams(window.location.search).get('token');

  if (!token) {
    showError();
    return;
  }

  // Fetch quote by magic_link_token (anon read allowed for published quotes)
  const { data: quotes, error } = await supabaseClient
    .from('customer_quotes')
    .select('*')
    .eq('magic_link_token', token)
    .in('status', ['issued', 'sent', 'accepted', 'rejected', 'expired'])
    .limit(1);

  if (error || !quotes || !quotes.length) {
    showError();
    return;
  }

  const cq = quotes[0];
  _quoteId = cq.id;

  // Fetch line items
  const { data: lines } = await supabaseClient
    .from('customer_quote_lines')
    .select('*')
    .eq('customer_quote_id', cq.id)
    .order('line_number');

  document.getElementById('cq-loading').style.display = 'none';
  document.getElementById('quote-print-template').style.display = 'block';

  renderQuote(cq, lines || []);

  // Show accept bar or accepted banner
  if (cq.status === 'accepted') {
    document.getElementById('cq-accepted-banner').style.display = 'block';
  } else if (['issued', 'sent'].includes(cq.status)) {
    document.getElementById('cq-accept-bar').style.display = 'flex';
  }

  // Set page title
  if (cq.quote_reference) {
    document.title = `${cq.quote_reference} — Vertex Metals Quote`;
  }
}

function showError() {
  document.getElementById('cq-loading').style.display = 'none';
  document.getElementById('cq-error').style.display   = 'block';
}

function renderQuote(cq, lines) {
  const today = fmtDate(new Date());
  const sym = cq.currency === 'USD' ? '$' : '£';

  // Build customer address
  const addrLines = [
    cq.customer_name,
    cq.customer_company,
    cq.customer_address_line_1,
    cq.customer_address_line_2,
    cq.customer_city,
    cq.customer_postcode,
    cq.customer_country,
  ].filter(Boolean);
  const vatLine = cq.customer_vat_number ? `VAT Registration No. ${cq.customer_vat_number}` : '';

  // Build line items table rows
  const lineRows = lines.map((l, i) => `
    <tr class="${l.is_alternative ? 'alt-row' : ''}">
      <td>${l.line_number || i + 1}</td>
      <td>${esc(l.product_family || '—')}${l.is_alternative ? '<span class="alt-tag">Alt</span>' : ''}</td>
      <td>${esc(l.product_type || '—')}</td>
      <td>${esc(l.grade_specification || '—')}</td>
      <td>${esc(l.description)}</td>
      <td>${l.vat_rate != null ? `${fmt(l.vat_rate, 0)}%` : '—'}</td>
      <td style="text-align:right">${l.quantity != null ? fmt(l.quantity, l.unit === 'MT' ? 3 : 2) : '—'}</td>
      <td>${esc(l.unit || 'MT')}</td>
      <td style="text-align:right">${l.unit_price_gbp != null ? `${sym}${fmt(l.unit_price_gbp)}` : '—'}</td>
      <td class="amount">${l.amount_gbp != null ? `${sym}${fmt(l.amount_gbp)}` : '—'}</td>
    </tr>`).join('');

  // VAT summary (group by rate)
  const vatGroups = {};
  lines.forEach(l => {
    const rate = l.vat_rate ?? 20;
    if (!vatGroups[rate]) vatGroups[rate] = { vat: 0, net: 0 };
    vatGroups[rate].net += parseFloat(l.amount_gbp || 0);
    vatGroups[rate].vat += parseFloat(l.vat_amount_gbp || 0);
  });
  const vatSummaryRows = Object.entries(vatGroups).map(([rate, g]) => `
    <tr>
      <td>VAT @ ${rate}%</td>
      <td>${sym}${fmt(g.vat)}</td>
      <td>${sym}${fmt(g.net)}</td>
    </tr>`).join('');

  // Notes block (lead time, payment terms, etc.)
  const noteItems = [
    cq.lead_time      ? `Lead time: ${cq.lead_time}` : null,
    cq.payment_terms  ? `Payment terms: ${cq.payment_terms}` : null,
    cq.notes          ? cq.notes : null,
  ].filter(Boolean);

  document.getElementById('quote-print-template').innerHTML = `

    <!-- Header -->
    <div class="qdoc-header">
      <div>
        <div class="qdoc-logo">VERTEX <span>METALS</span></div>
        <div style="font-size:11px;color:#666;margin-top:8px;line-height:1.7">
          ${esc(VERTEX.addr1)}<br>${esc(VERTEX.addr2)}<br>${esc(VERTEX.addr3)}<br>
          <a href="mailto:${esc(VERTEX.email)}" style="color:#7ab8d4">${esc(VERTEX.email)}</a>
        </div>
      </div>
      <div class="qdoc-header-contact">
        <div style="font-family:Syne,sans-serif;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#aaa;margin-bottom:8px">Estimate</div>
        <div class="qdoc-ref-row"><span class="key">ESTIMATE</span><span class="val">${esc(cq.quote_reference || cq.id.slice(0,8).toUpperCase())}</span></div>
        <div class="qdoc-ref-row"><span class="key">DATE</span><span class="val">${esc(fmtDate(cq.issued_date))}</span></div>
        ${cq.validity_date ? `<div class="qdoc-ref-row"><span class="key">EXPIRATION DATE</span><span class="val">${esc(fmtDate(cq.validity_date))}</span></div>` : ''}
      </div>
    </div>

    <!-- Heading -->
    <div class="qdoc-heading">Estimate</div>

    <!-- Address + ref -->
    <div class="qdoc-meta">
      <div>
        <span class="qdoc-address label">ADDRESS</span>
        <div class="qdoc-address">
          ${addrLines.map(l => esc(l)).join('<br>')}
          ${vatLine ? `<br><em style="font-size:11px;color:#888">${esc(vatLine)}</em>` : ''}
        </div>
      </div>
    </div>

    <!-- Line items table -->
    <table class="qdoc-table">
      <thead>
        <tr>
          <th>#</th>
          <th>PRODUCT</th>
          <th>TYPE</th>
          <th>SPECIFICATION</th>
          <th>DESCRIPTION</th>
          <th>VAT</th>
          <th style="text-align:right">QTY</th>
          <th>UNIT</th>
          <th style="text-align:right">PRICE</th>
          <th style="text-align:right">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows || '<tr><td colspan="10" style="text-align:center;color:#999;padding:16px">No line items</td></tr>'}
      </tbody>
    </table>

    <!-- Notes -->
    ${noteItems.length ? `<div class="qdoc-notes">${noteItems.map(esc).join('\n')}</div>` : ''}

    <!-- Totals -->
    <div class="qdoc-totals">
      <div class="qdoc-totals-row"><span class="label">SUBTOTAL</span><span class="amount">${cq.subtotal_gbp ? `${sym}${fmt(cq.subtotal_gbp)}` : '—'}</span></div>
      <div class="qdoc-totals-row"><span class="label">VAT TOTAL</span><span class="amount">${cq.vat_total_gbp ? `${sym}${fmt(cq.vat_total_gbp)}` : '—'}</span></div>
      <div class="qdoc-totals-row total"><span class="label">TOTAL</span><span class="amount">${cq.total_gbp ? `${sym}${fmt(cq.total_gbp)}` : '—'}</span></div>
    </div>

    <!-- VAT summary -->
    ${vatSummaryRows ? `
    <div class="qdoc-vat-summary" style="margin-top:20px">
      <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#7ab8d4;margin-bottom:8px">VAT Summary</p>
      <table>
        <thead><tr><th>RATE</th><th>VAT</th><th>NET</th></tr></thead>
        <tbody>${vatSummaryRows}</tbody>
      </table>
    </div>` : ''}

    <!-- Acceptance section -->
    <div class="qdoc-acceptance">
      <div>
        <div class="qdoc-acceptance-label">Accepted By</div>
        <div class="qdoc-acceptance-field">${cq.status === 'accepted' ? '' : '&nbsp;'}</div>
      </div>
      <div>
        <div class="qdoc-acceptance-label">Accepted Date</div>
        <div class="qdoc-acceptance-field">${cq.status === 'accepted' && cq.response_date ? fmtDate(cq.response_date) : '&nbsp;'}</div>
      </div>
    </div>

    <!-- T&Cs -->
    ${cq.terms_conditions ? `<div class="qdoc-terms">${esc(cq.terms_conditions)}</div>` : ''}

    <!-- Footer -->
    <div class="qdoc-footer">
      <span>${esc(VERTEX.name)} — ${esc(VERTEX.reg)}</span>
      <span>Page 1 of 1</span>
    </div>
  `;
}

async function acceptQuote() {
  const btn = document.getElementById('accept-btn');
  btn.disabled = true;
  btn.textContent = 'Accepting…';

  const today = new Date().toISOString().split('T')[0];

  // Fetch rfq_id so we can update the RFQ status too
  const { data: cq } = await supabaseClient.from('customer_quotes').select('rfq_id').eq('id', _quoteId).single();

  const { error } = await supabaseClient
    .from('customer_quotes')
    .update({ status: 'accepted', response_date: today })
    .eq('id', _quoteId);

  // Also update the RFQ submission status (best-effort — may fail if RLS blocks anon update)
  if (!error && cq?.rfq_id) {
    await supabaseClient.from('rfq_submissions').update({ status: 'accepted' }).eq('id', cq.rfq_id);
  }

  if (error) {
    btn.disabled = false;
    btn.textContent = 'Accept this Quote';
    alert('Sorry, something went wrong. Please email us at sales@vertexmetalsltd.com to accept your quote.');
    return;
  }

  document.getElementById('cq-accept-bar').style.display    = 'none';
  document.getElementById('cq-accepted-banner').style.display = 'block';
}

function downloadPdf() {
  const template = document.getElementById('quote-print-template');
  const ref      = document.title.split('—')[0].trim() || 'VM-Quote';
  html2pdf().set({
    margin:      [10, 10, 10, 10],
    filename:    `${ref}.pdf`,
    image:       { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }).from(template).save();
}

// Init on load
init();
