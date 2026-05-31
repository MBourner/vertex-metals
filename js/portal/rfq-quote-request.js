/**
 * Vertex Metals Portal — RFQ Quote Request PDF Generator
 * URL: /portal/rfq/quote-request.html?rfq={id}&type={supplier|logistics}
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-GB') : '—'; }

const params = new URLSearchParams(window.location.search);
const _rfqId = params.get('rfq');
const _type  = params.get('type') || 'supplier';

const VERTEX = {
  name:  'Vertex Metals Ltd',
  addr:  'No 3 Falcon Cliff, 9–10 Palace Road, Douglas, Isle of Man, IM2 4LD',
  email: 'sales@vertexmetalsltd.com',
  reg:   'Incorporated in the Isle of Man under the Companies Act 1931',
};

let _state = {
  toName:       '',
  toCompany:    '',
  refDate:      new Date().toISOString().split('T')[0],
  rfqRef:       '',
  incoterm:     'FOB',
  origin:       '',
  destination:  'United Kingdom',
  validityDays: 14,
  requireMds:   true,
  notes:        '',
  rfqLines:     [],   // array of rfq_lines records
};

let _supplierContacts  = [];
let _logisticsContacts = [];

async function init() {
  if (!_rfqId) {
    document.getElementById('edit-form-container').innerHTML = '<div class="alert alert-error">No RFQ ID provided in URL.</div>';
    return;
  }

  const isSupplier = _type === 'supplier';
  document.getElementById('topbar-title').textContent = isSupplier ? 'Supplier Quote Request' : 'Logistics Quote Request';
  document.getElementById('page-heading').textContent = isSupplier ? 'Supplier Quote Request' : 'Logistics Quote Request';
  const backBtn = document.getElementById('back-to-rfq-btn');
  if (backBtn) backBtn.href = `detail.html?id=${_rfqId}`;

  // Load RFQ, rfq_lines, and contacts in parallel
  const [{ data: rfq }, { data: lines }, { data: contacts }] = await Promise.all([
    supabaseClient.from('rfq_submissions').select('*').eq('id', _rfqId).single(),
    supabaseClient.from('rfq_lines').select('*, product_lines(name)').eq('rfq_id', _rfqId).order('line_number'),
    supabaseClient.from('contacts').select('id,company_name,primary_contact_name,email,phone')
      .eq('type', isSupplier ? 'supplier' : 'logistics').order('company_name'),
  ]);

  if (rfq) {
    _state.rfqRef      = _rfqId.slice(0, 8).toUpperCase();
    _state.origin      = rfq.country || '';
    _state.notes       = rfq.specifications || '';
  }

  _state.rfqLines = lines || [];

  if (isSupplier) _supplierContacts  = contacts || [];
  else            _logisticsContacts = contacts || [];

  buildForm(isSupplier);
  updatePreview();
}

function buildForm(isSupplier) {
  const contacts = isSupplier ? _supplierContacts : _logisticsContacts;
  const contactOpts = contacts.map(c =>
    `<option value="${esc(c.id)}">${esc(c.company_name)}${c.primary_contact_name ? ' — ' + esc(c.primary_contact_name) : ''}</option>`
  ).join('');

  const el = document.getElementById('edit-form-container');
  el.innerHTML = `
    <div class="form-group">
      <label class="form-label">To: ${isSupplier ? 'Supplier' : 'Provider'}</label>
      <select class="form-select" id="f-contact" onchange="prefillContact(this.value)">
        <option value="">— Select from contacts —</option>${contactOpts}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">To: Contact Name</label>
      <input type="text" class="form-input" id="f-to-name" value="${esc(_state.toName)}" oninput="_state.toName=this.value;updatePreview()" />
    </div>
    <div class="form-group">
      <label class="form-label">To: Company</label>
      <input type="text" class="form-input" id="f-to-company" value="${esc(_state.toCompany)}" oninput="_state.toCompany=this.value;updatePreview()" />
    </div>
    <div class="form-group">
      <label class="form-label">Date</label>
      <input type="date" class="form-input" id="f-date" value="${esc(_state.refDate)}" oninput="_state.refDate=this.value;updatePreview()" />
    </div>
    ${isSupplier ? `
    <div class="form-group">
      <label class="form-label">Incoterm</label>
      <select class="form-select" id="f-incoterm" onchange="_state.incoterm=this.value;updatePreview()">
        ${['FOB','CIF','EXW','DAP','CIP'].map(t => `<option value="${t}"${t===_state.incoterm?' selected':''}>${t}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="margin-top:var(--space-2)">
      <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;font-size:var(--text-sm)">
        <input type="checkbox" id="f-mds" ${_state.requireMds?'checked':''} onchange="_state.requireMds=this.checked;updatePreview()" />
        Request material data sheet
      </label>
    </div>` : `
    <div class="form-group">
      <label class="form-label">Origin</label>
      <input type="text" class="form-input" id="f-origin" value="${esc(_state.origin)}" oninput="_state.origin=this.value;updatePreview()" />
    </div>
    <div class="form-group">
      <label class="form-label">Destination</label>
      <input type="text" class="form-input" id="f-dest" value="${esc(_state.destination)}" oninput="_state.destination=this.value;updatePreview()" />
    </div>`}
    <div class="form-group">
      <label class="form-label">Quote Valid For (days)</label>
      <input type="number" class="form-input" id="f-validity" value="${_state.validityDays}" min="1" oninput="_state.validityDays=parseInt(this.value)||14;updatePreview()" />
    </div>
    <div class="form-group">
      <label class="form-label">Additional Notes</label>
      <textarea class="form-textarea" id="f-notes" rows="3" oninput="_state.notes=this.value;updatePreview()">${esc(_state.notes)}</textarea>
    </div>
  `;
}

function prefillContact(contactId) {
  const contacts = _type === 'supplier' ? _supplierContacts : _logisticsContacts;
  const c = contacts.find(x => x.id === contactId);
  if (!c) return;
  _state.toName    = c.primary_contact_name || '';
  _state.toCompany = c.company_name || '';
  const nameEl    = document.getElementById('f-to-name');
  const companyEl = document.getElementById('f-to-company');
  if (nameEl)    nameEl.value    = _state.toName;
  if (companyEl) companyEl.value = _state.toCompany;
  updatePreview();
}

function updatePreview() {
  const isSupplier = _type === 'supplier';
  const today      = fmtDate(_state.refDate);
  const toBlock    = [_state.toName, _state.toCompany].filter(Boolean).join('<br>') || '—';

  // Build the lines table for the PDF
  let linesSection = '';
  if (_state.rfqLines.length > 0) {
    const hasAlts = _state.rfqLines.some(l => l.is_alternative);
    linesSection = `
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:12px">
        <thead>
          <tr style="background:#f4f5f7">
            <th style="padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#888;border-bottom:1px solid #e5e7eb;width:40px">Line</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#888;border-bottom:1px solid #e5e7eb">Description</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#888;border-bottom:1px solid #e5e7eb">Grade / Spec</th>
            <th style="padding:6px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#888;border-bottom:1px solid #e5e7eb">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${_state.rfqLines.map(l => `
          <tr style="border-bottom:1px solid #f3f4f6;${l.is_alternative ? 'background:#fffbf0' : ''}">
            <td style="padding:7px 10px;font-weight:600;color:#888">${l.line_number}${l.is_alternative ? '*' : ''}</td>
            <td style="padding:7px 10px">${esc(l.description)}</td>
            <td style="padding:7px 10px;color:#555">${esc(l.grade_specification || '—')}</td>
            <td style="padding:7px 10px;text-align:right">${l.quantity ? l.quantity + ' ' + (l.quantity_unit || 'MT') : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${hasAlts ? `<p style="font-size:10px;color:#888;margin-top:6px">* Alternative grades or specifications accepted in lieu if primary is not available.</p>` : ''}`;
  }

  // Requirements list
  let reqList = '';
  if (isSupplier) {
    reqList = `
      <div style="margin-top:14px">
        <p style="font-size:12px;font-weight:600;margin-bottom:6px">Please provide for each line:</p>
        <ul style="font-size:12px;color:#444;margin:0;padding-left:18px;line-height:1.8">
          <li>Best price in USD (${esc(_state.incoterm)} terms) — per MT or per piece as applicable</li>
          <li>Quote valid for a minimum of <strong>${_state.validityDays} days</strong></li>
          ${_state.requireMds ? '<li>Material data sheet (MDS) for each product</li>' : ''}
          <li>Available quantity, lead time, and earliest shipment date</li>
        </ul>
      </div>`;
  } else {
    reqList = `
      <div style="margin-top:14px">
        <p style="font-size:12px;font-weight:600;margin-bottom:6px">Requirements:</p>
        <ul style="font-size:12px;color:#444;margin:0;padding-left:18px;line-height:1.8">
          <li>All-inclusive freight rate from <strong>${esc(_state.origin || '—')}</strong> to <strong>${esc(_state.destination)}</strong></li>
          <li>Quote valid for a minimum of <strong>${_state.validityDays} days</strong></li>
          <li>Please advise transit time and earliest available loading date</li>
          <li>Confirm if rate is per MT or a flat shipment fee</li>
        </ul>
      </div>`;
  }

  document.getElementById('qr-print-template').innerHTML = `
    <div class="qr-doc-header">
      <div>
        <div class="qr-doc-logo">VERTEX <span>METALS</span></div>
        <div style="font-size:11px;color:#555;margin-top:6px;line-height:1.6">
          ${esc(VERTEX.addr)}<br>
          <a href="mailto:${esc(VERTEX.email)}" style="color:#7ab8d4">${esc(VERTEX.email)}</a>
        </div>
      </div>
      <div class="qr-doc-contact">
        <div style="font-family:Syne,sans-serif;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#888;margin-bottom:4px">${isSupplier ? 'Supplier' : 'Logistics'} Quote Request</div>
        <div style="font-size:11px;color:#555;line-height:1.7">
          <strong>Date:</strong> ${esc(today)}<br>
          <strong>Ref:</strong> VM-QR-${esc(_state.rfqRef)}<br>
          <strong>Validity requested:</strong> ${_state.validityDays} days
        </div>
      </div>
    </div>

    <div class="qr-doc-heading">${isSupplier ? 'Supplier' : 'Logistics'} Quote Request</div>

    <div class="qr-meta-grid">
      <div class="qr-meta-item"><label>To</label><p>${toBlock}</p></div>
      <div class="qr-meta-item"><label>From</label><p>${esc(VERTEX.name)}</p></div>
    </div>

    <div class="qr-section">
      <div class="qr-section-title">${isSupplier ? 'Products Required' : 'Shipment Details'}</div>
      ${linesSection || `<p style="font-size:12px;color:#888">No lines defined on this RFQ yet.</p>`}
      ${reqList}
    </div>

    ${_state.notes ? `
    <div class="qr-section">
      <div class="qr-section-title">Additional Information</div>
      <div class="qr-notes-box">${esc(_state.notes)}</div>
    </div>` : ''}

    <div class="qr-respond-box">
      <strong style="color:#ffffff;display:block;margin-bottom:4px;font-family:Syne,sans-serif;letter-spacing:.04em">Please respond to:</strong>
      <span style="color:#ffffff">${esc(VERTEX.email)}</span>
      <span style="color:rgba(255,255,255,.6)"> &mdash; quoting reference </span>
      <strong style="color:#ffffff">VM-QR-${esc(_state.rfqRef)}</strong>
    </div>

    <div class="qr-footer">
      <span>${esc(VERTEX.name)} &mdash; ${esc(VERTEX.reg)}</span>
      <span>Page 1 of 1</span>
    </div>
  `;
}

function generatePdf() {
  const template = document.getElementById('qr-print-template');
  const filename = `VM-QR-${_state.rfqRef}-${_type}.pdf`;
  html2pdf().set({
    margin:      [15, 12, 15, 12],
    filename,
    image:       { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak:   { mode: 'avoid-all' },
  }).from(template).save();
}

(async () => {
  const user = await getCurrentUser();
  const el = document.getElementById('user-email');
  if (el) el.textContent = user?.email || '';
  await init();
})();
