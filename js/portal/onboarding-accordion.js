/**
 * Vertex Metals Portal — Supplier Onboarding Accordion
 * Handles portal/suppliers/onboard.html
 *
 * Merged from: onboard.js, compliance-review.js, pre-trade.js, trade-ready.js
 * Stage-specific functions prefixed: s1a_, s1b_, s2_, s3_
 * Shared helpers/constants/state defined once without prefix.
 */

// ═══════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el && value != null) el.value = value;
}

function passIcon() {
  return `<div class="check-icon pass"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>`;
}

function failIcon() {
  return `<div class="check-icon fail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>`;
}

function warnIcon() {
  return `<div class="check-icon warn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>`;
}

// ═══════════════════════════════════════════════════════════
// SHARED CONSTANTS
// ═══════════════════════════════════════════════════════════

const CURRENCIES = ['USD', 'GBP', 'EUR', 'INR', 'CNY', 'AED'];

const SANCTIONS_LISTS = [
  { name: 'UK Sanctions List', url: 'https://search-uk-sanctions-list.service.gov.uk/' },
  { name: 'UN',                url: 'https://www.un.org/securitycouncil/content/un-sc-consolidated-list' },
  { name: 'EU',                url: 'https://www.sanctionsmap.eu/#/main' },
];

const SUPPLIER_TYPE_LABELS = {
  manufacturing:         'Manufacturing',
  materials_commodities: 'Materials / Commodities',
  logistics:             'Logistics / 3PL',
  packaging:             'Packaging',
  service_provider:      'Service Provider',
};

const COMPLIANCE_GROUP_LABELS = {
  corporate_risk:    'Corporate Risk',
  jurisdiction_risk: 'Jurisdiction Risk',
  product_risk:      'Product Risk',
  screening_results: 'Screening Results',
  controls:          'Mitigating Controls (reduce total)',
};

const COMMERCIAL_GROUP_LABELS = {
  product_fit:       'Product Fit',
  buyer_demand:      'Buyer Demand',
  volume_capability: 'Volume Capability',
  export_capability: 'Export Capability',
  quality_certs:     'Quality Certification',
  responsiveness:    'Responsiveness',
};

const CONTACT_TYPE_MAP = {
  manufacturing:         'supplier',
  materials_commodities: 'supplier',
  logistics:             'logistics',
  packaging:             'other',
  service_provider:      'other',
};

// ═══════════════════════════════════════════════════════════
// SHARED STATE
// ═══════════════════════════════════════════════════════════

const params     = new URLSearchParams(location.search);
let supplierId   = params.get('supplier_id') || null;
let enquiryId    = params.get('enquiry_id')  || null;
let contact      = null;
let onboarding   = null;
let onboardingId = null;

// ═══════════════════════════════════════════════════════════
// STAGE 1a — SUPPLIER REGISTRATION
// ═══════════════════════════════════════════════════════════

let s1a_contactId         = null;
let s1a_productsOffered   = [];
let s1a_removedProductIds = [];
let s1a_productFamilies   = [];
let s1a_productLinesCache = [];

function s1a_renderPrerequisites() {
  const supplierType = document.getElementById('ob-type')?.value;
  const items = OnboardingWorkflow.buildStage1aPrerequisites(supplierType);
  const list  = document.getElementById('prereq-list');
  if (list) list.innerHTML = items.map(item => `<li>${esc(item)}</li>`).join('');
}

function s1a_onSupplierTypeChange() {
  const supplierType = document.getElementById('ob-type')?.value;
  const profile = OnboardingWorkflow.getSupplierProfile(supplierType);
  s1a_renderPrerequisites();
  const exportGroup = document.getElementById('ob-export-licence-group');
  if (exportGroup) exportGroup.style.display = profile.showExportLicence ? '' : 'none';
  const qmsGroup = document.getElementById('ob-qms-group');
  if (qmsGroup) {
    qmsGroup.style.display = profile.showQms ? '' : 'none';
    if (!profile.showQms) document.getElementById('ob-qms-details').style.display = 'none';
  }
}

async function s1a_loadEnquiry() {
  if (!enquiryId) return;
  const { data: e } = await supabaseClient
    .from('supplier_enquiries')
    .select('company_name, contact_name, email, phone, country, website, products_of_interest, hq_address')
    .eq('id', enquiryId).single();
  if (!e) return;
  document.getElementById('enquiry-banner').style.display = 'block';
  document.getElementById('enquiry-banner-text').textContent = e.company_name;
  setVal('ob-company',       e.company_name);
  setVal('ob-country',       e.country);
  setVal('ob-website',       e.website);
  setVal('ob-contact-name',  e.contact_name);
  setVal('ob-contact-email', e.email);
  setVal('ob-contact-phone', e.phone);
  setVal('ob-address1',      e.hq_address);
  if (e.products_of_interest) setVal('ob-notes', `From enquiry — products / materials: ${e.products_of_interest}`);
}

async function s1a_loadExistingContact() {
  if (!supplierId || !contact) return;
  s1a_contactId = supplierId;

  const { data: products } = await supabaseClient
    .from('supplier_quotes')
    .select('id, product_line_id, product, specification, product_line:product_lines(metal_family, sub_type, name)')
    .eq('supplier_id', supplierId)
    .not('onboarding_review_status', 'is', null);

  s1a_productsOffered = (products || []).map(p => ({
    db_id:           p.id,
    product_line_id: p.product_line_id,
    product:         p.product_line?.name || p.product,
    metal_family:    p.product_line?.metal_family || '',
    sub_type:        p.product_line?.sub_type || '',
    specification:   p.specification,
  }));
  s1a_renderProductsOffered();

  if (onboarding?.workflow_stage === 'draft') {
    document.getElementById('enquiry-banner').style.display = 'block';
    document.getElementById('enquiry-banner-text').textContent = `Resuming draft for ${contact.company_name}`;
    onboardingId = onboarding.id;
  }

  setVal('ob-company',        contact.company_name);
  setVal('ob-registration',   contact.company_registration_number);
  setVal('ob-country',        contact.country);
  setVal('ob-vat',            contact.vat_number);
  setVal('ob-website',        contact.website);
  setVal('ob-beneficial',     contact.beneficial_owner);
  setVal('ob-contact-name',   contact.primary_contact_name);
  setVal('ob-contact-email',  contact.email);
  setVal('ob-contact-phone',  contact.phone);
  setVal('ob-company-phone',  contact.company_phone);
  setVal('ob-address1',       contact.address_line_1);
  setVal('ob-address2',       contact.address_line_2);
  setVal('ob-city',           contact.city);
  setVal('ob-postcode',       contact.postcode);
  setVal('ob-export-licence', contact.export_licence_number);
  setVal('ob-supplier-ref',   contact.supplier_reference);
  setVal('ob-notes',          contact.notes);
  setVal('ob-qms-ref',        contact.qms_certificate_ref);
  if (contact.qms_expiry)        setVal('ob-qms-expiry', contact.qms_expiry);
  if (contact.qms_certification) document.getElementById('ob-qms').value = contact.qms_certification;
  if (contact.supplier_type)     document.getElementById('ob-type').value = contact.supplier_type;

  if (contact.dispatch_address_line_1 || contact.dispatch_city || contact.dispatch_postcode || contact.dispatch_country) {
    document.getElementById('ob-dispatch-different').checked = true;
    document.getElementById('ob-dispatch-address').style.display = 'flex';
    setVal('ob-dispatch-address1', contact.dispatch_address_line_1);
    setVal('ob-dispatch-address2', contact.dispatch_address_line_2);
    setVal('ob-dispatch-city',     contact.dispatch_city);
    setVal('ob-dispatch-postcode', contact.dispatch_postcode);
    setVal('ob-dispatch-country',  contact.dispatch_country);
  }
}

function s1a_toggleQmsFields() {
  const qms = document.getElementById('ob-qms')?.value;
  document.getElementById('ob-qms-details').style.display = (qms && qms !== 'none') ? 'flex' : 'none';
}

function s1a_buildAddressPayload() {
  const dd = document.getElementById('ob-dispatch-different')?.checked;
  return {
    address_line_1:          document.getElementById('ob-address1')?.value.trim()    || null,
    address_line_2:          document.getElementById('ob-address2')?.value.trim()    || null,
    city:                    document.getElementById('ob-city')?.value.trim()         || null,
    postcode:                document.getElementById('ob-postcode')?.value.trim()     || null,
    dispatch_address_line_1: dd ? (document.getElementById('ob-dispatch-address1')?.value.trim() || null) : null,
    dispatch_address_line_2: dd ? (document.getElementById('ob-dispatch-address2')?.value.trim() || null) : null,
    dispatch_city:           dd ? (document.getElementById('ob-dispatch-city')?.value.trim()     || null) : null,
    dispatch_postcode:       dd ? (document.getElementById('ob-dispatch-postcode')?.value.trim() || null) : null,
    dispatch_country:        dd ? (document.getElementById('ob-dispatch-country')?.value.trim()  || null) : null,
  };
}

function s1a_buildContactPayload() {
  const supplierType   = document.getElementById('ob-type')?.value || null;
  const qms            = document.getElementById('ob-qms')?.value  || null;
  const qmsHasDetails  = qms && qms !== 'none';
  return {
    company_name:                document.getElementById('ob-company')?.value.trim(),
    company_registration_number: document.getElementById('ob-registration')?.value.trim() || null,
    country:                     document.getElementById('ob-country')?.value.trim()       || null,
    supplier_type:               supplierType,
    primary_contact_name:        document.getElementById('ob-contact-name')?.value.trim()  || null,
    email:                       document.getElementById('ob-contact-email')?.value.trim() || null,
    phone:                       document.getElementById('ob-contact-phone')?.value.trim() || null,
    company_phone:               document.getElementById('ob-company-phone')?.value.trim() || null,
    website:                     document.getElementById('ob-website')?.value.trim()        || null,
    vat_number:                  document.getElementById('ob-vat')?.value.trim()            || null,
    beneficial_owner:            document.getElementById('ob-beneficial')?.value.trim()     || null,
    export_licence_number:       document.getElementById('ob-export-licence')?.value.trim() || null,
    qms_certification:           qms || null,
    qms_certificate_ref:         qmsHasDetails ? (document.getElementById('ob-qms-ref')?.value.trim()   || null) : null,
    qms_expiry:                  qmsHasDetails ? (document.getElementById('ob-qms-expiry')?.value        || null) : null,
    supplier_reference:          document.getElementById('ob-supplier-ref')?.value.trim()  || null,
    notes:                       document.getElementById('ob-notes')?.value.trim()          || null,
    approval_status:             'under_review',
    ...s1a_buildAddressPayload(),
  };
}

async function s1a_insertContact(payload) {
  const contactType = CONTACT_TYPE_MAP[payload.supplier_type] || 'supplier';
  const { data, error } = await supabaseClient
    .from('contacts').insert({ ...payload, type: contactType }).select('id').single();
  if (!error) return data.id;
  if (error.code === '23505') {
    payload.supplier_reference = OnboardingWorkflow.generateSupplierReference();
    document.getElementById('ob-supplier-ref').value = payload.supplier_reference;
    const { data: r2, error: e2 } = await supabaseClient
      .from('contacts').insert({ ...payload, type: contactType }).select('id').single();
    if (e2) throw new Error('Failed to create supplier record: ' + e2.message);
    return r2.id;
  }
  throw new Error('Failed to create supplier record: ' + error.message);
}

async function s1a_loadProductCatalogue() {
  try {
    const { data, error } = await supabaseClient.from('product_families').select('*').order('name');
    if (error) throw error;
    s1a_productFamilies = (data || []).filter(f => f.active !== false);
  } catch {
    const { data: af } = await supabaseClient.from('product_lines').select('metal_family').order('metal_family');
    const names = [...new Set((af || []).map(r => r.metal_family).filter(Boolean))];
    s1a_productFamilies = names.map(name => ({ id: null, name, active: true }));
  }
  const { data: lines } = await supabaseClient.from('product_lines')
    .select('id, name, metal_family, sub_type').eq('active', true)
    .order('metal_family').order('sub_type').order('name');
  s1a_productLinesCache = lines || [];
}

function s1a_renderProductsOffered() {
  const tbody = document.getElementById('products-offered-body');
  if (!tbody) return;
  if (s1a_productsOffered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted);padding:var(--space-6)">No products added yet.</td></tr>';
    return;
  }
  tbody.innerHTML = s1a_productsOffered.map((p, idx) => `
    <tr>
      <td>${esc(p.metal_family || '—')}${p.sub_type ? ` / ${esc(p.sub_type)}` : ''}</td>
      <td style="font-weight:600">${esc(p.product)}</td>
      <td>${esc(p.specification || '—')}</td>
      <td style="text-align:right"><button type="button" class="btn btn-ghost btn-sm" onclick="s1a_removeProductOffered(${idx})">Remove</button></td>
    </tr>`).join('');
}

function s1a_openAddProductModal() {
  document.getElementById('add-product-form-container').innerHTML = s1a_buildAddProductForm();
  document.getElementById('add-product-modal').classList.add('open');
}

function s1a_buildAddProductForm() {
  const familyOptions = s1a_productFamilies.map(f => `<option value="${esc(f.name)}">${esc(f.name)}</option>`).join('');
  return `
    <form id="add-product-form" onsubmit="s1a_submitAddProduct(event)">
      <div class="form-group" style="margin-bottom:var(--space-4)">
        <label class="form-label">Source</label>
        <div style="display:flex;gap:var(--space-5)">
          <label style="display:flex;align-items:center;gap:var(--space-2);font-weight:normal">
            <input type="radio" name="add-product-mode" value="catalogue" checked onchange="s1a_onAddProductModeChange()" /> From catalogue
          </label>
          <label style="display:flex;align-items:center;gap:var(--space-2);font-weight:normal">
            <input type="radio" name="add-product-mode" value="new" onchange="s1a_onAddProductModeChange()" /> New product line
          </label>
        </div>
      </div>
      <div id="add-product-catalogue-fields" class="form-grid" style="margin-bottom:var(--space-4)">
        <div class="form-group">
          <label class="form-label">Family <span class="required">*</span></label>
          <select class="form-select" id="add-product-family" onchange="s1a_onAddProductFamilyChange()">
            <option value="">— Select family —</option>${familyOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Product <span class="required">*</span></label>
          <select class="form-select" id="add-product-line"><option value="">— Select family first —</option></select>
        </div>
      </div>
      <div id="add-product-new-fields" class="form-grid" style="display:none;margin-bottom:var(--space-4)">
        <div class="form-group">
          <label class="form-label">Family <span class="required">*</span></label>
          <select class="form-select" id="add-product-new-family" onchange="s1a_onAddProductNewFamilyChange()">
            <option value="">— Select family —</option>${familyOptions}<option value="__new__">— New family —</option>
          </select>
          <input type="text" class="form-input" id="add-product-new-family-name" placeholder="New family name" style="display:none;margin-top:var(--space-2)" />
        </div>
        <div class="form-group">
          <label class="form-label">Sub-type</label>
          <input type="text" class="form-input" id="add-product-new-subtype" placeholder="e.g. Alloy Wire, EC Grade" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Product Name <span class="required">*</span></label>
          <input type="text" class="form-input" id="add-product-new-name" placeholder="e.g. Aluminium Alloy Core Wire EC Grade" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Specification</label>
        <input type="text" class="form-input" id="add-product-spec" placeholder="Grade, size, standard, etc." />
      </div>
      <div id="add-product-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Add Product</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('add-product-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;
}

function s1a_onAddProductModeChange() {
  const mode = document.querySelector('input[name="add-product-mode"]:checked')?.value;
  document.getElementById('add-product-catalogue-fields').style.display = mode === 'catalogue' ? '' : 'none';
  document.getElementById('add-product-new-fields').style.display       = mode === 'new'       ? '' : 'none';
}

function s1a_onAddProductFamilyChange() {
  const family = document.getElementById('add-product-family')?.value;
  const sel    = document.getElementById('add-product-line');
  const lines  = s1a_productLinesCache.filter(pl => pl.metal_family === family);
  if (!family || lines.length === 0) { sel.innerHTML = '<option value="">— Select family first —</option>'; return; }
  sel.innerHTML = '<option value="">— Select product —</option>' +
    lines.map(pl => `<option value="${esc(pl.id)}">${esc(pl.sub_type ? `${pl.sub_type} — ${pl.name}` : pl.name)}</option>`).join('');
}

function s1a_onAddProductNewFamilyChange() {
  const val = document.getElementById('add-product-new-family')?.value;
  document.getElementById('add-product-new-family-name').style.display = val === '__new__' ? '' : 'none';
}

async function s1a_submitAddProduct(e) {
  e.preventDefault();
  const alertEl   = document.getElementById('add-product-alert');
  const showError = msg => { alertEl.style.display = 'block'; alertEl.className = 'alert alert-error'; alertEl.textContent = msg; };
  const mode      = document.querySelector('input[name="add-product-mode"]:checked')?.value;
  const spec      = document.getElementById('add-product-spec')?.value.trim() || null;
  let productLineId, product, metalFamily, subType;

  if (mode === 'catalogue') {
    productLineId = document.getElementById('add-product-line')?.value;
    if (!productLineId) return showError('Select a product from the catalogue.');
    const pl = s1a_productLinesCache.find(p => p.id === productLineId);
    if (!pl) return showError('Selected product could not be found.');
    product = pl.name; metalFamily = pl.metal_family; subType = pl.sub_type;
  } else {
    const familySel     = document.getElementById('add-product-new-family')?.value;
    const newFamilyName = document.getElementById('add-product-new-family-name')?.value.trim();
    subType             = document.getElementById('add-product-new-subtype')?.value.trim() || null;
    product             = document.getElementById('add-product-new-name')?.value.trim();
    if (!familySel) return showError('Select or create a family.');
    if (familySel === '__new__' && !newFamilyName) return showError('Enter a name for the new family.');
    if (!product) return showError('Enter a product name.');
    metalFamily = familySel === '__new__' ? newFamilyName : familySel;
    if (familySel === '__new__') await supabaseClient.from('product_families').insert({ name: metalFamily, active: true });
    const { data: newPl, error: plErr } = await supabaseClient.from('product_lines')
      .insert({ metal_family: metalFamily, sub_type: subType, name: product, active: true }).select('id').single();
    if (plErr) return showError('Failed to create product line: ' + plErr.message);
    productLineId = newPl.id;
    s1a_productLinesCache.push({ id: productLineId, name: product, metal_family: metalFamily, sub_type: subType });
  }

  if (s1a_productsOffered.some(p => p.product_line_id === productLineId)) return showError('This product has already been added.');
  s1a_productsOffered.push({ db_id: null, product_line_id: productLineId, product, metal_family: metalFamily, sub_type: subType, specification: spec });
  s1a_renderProductsOffered();
  document.getElementById('add-product-modal').classList.remove('open');
}

function s1a_removeProductOffered(idx) {
  const entry = s1a_productsOffered[idx];
  if (entry.db_id) s1a_removedProductIds.push(entry.db_id);
  s1a_productsOffered.splice(idx, 1);
  s1a_renderProductsOffered();
}

async function s1a_syncProductsOffered(cid) {
  for (const p of s1a_productsOffered) {
    if (p.db_id) continue;
    const { data, error } = await supabaseClient.from('supplier_quotes').insert({
      supplier_id: cid, product_line_id: p.product_line_id, product: p.product,
      specification: p.specification, incoterm: 'FOB', fob_price_usd: 0,
      status: 'pending', onboarding_review_status: 'pending_review',
    }).select('id').single();
    if (error) throw new Error('Failed to save offered product: ' + error.message);
    p.db_id = data.id;
  }
  if (s1a_removedProductIds.length) {
    const { error } = await supabaseClient.from('supplier_quotes').delete().in('id', s1a_removedProductIds);
    if (error) throw new Error('Failed to remove product: ' + error.message);
    s1a_removedProductIds = [];
  }
}

async function s1a_submitSaveAndExit() {
  const errEl = document.getElementById('ob-error');
  errEl.style.display = 'none';
  const company = document.getElementById('ob-company')?.value.trim();
  if (!company) {
    errEl.textContent = 'Company Name is required to save progress.';
    errEl.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const btn = document.getElementById('save-exit-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const user    = await getCurrentUser();
    const payload = s1a_buildContactPayload();
    if (!s1a_contactId) {
      s1a_contactId = await s1a_insertContact(payload);
      supplierId    = s1a_contactId;
    } else {
      const { error } = await supabaseClient.from('contacts').update(payload).eq('id', s1a_contactId);
      if (error) throw new Error('Failed to update supplier record: ' + error.message);
    }
    await s1a_syncProductsOffered(s1a_contactId);
    if (!onboardingId) {
      const { data: ob, error: obErr } = await supabaseClient.from('supplier_onboarding').insert({
        contact_id: s1a_contactId, enquiry_id: enquiryId || null,
        workflow_stage: 'draft', raised_by: user?.id || null,
      }).select('id').single();
      if (obErr) throw new Error('Failed to create onboarding record: ' + obErr.message);
      onboardingId = ob.id;
    } else {
      await supabaseClient.from('supplier_onboarding').update({ updated_at: new Date().toISOString() }).eq('id', onboardingId);
    }
    await OnboardingWorkflow.logEvent(s1a_contactId, onboardingId, 'onboarding_draft_saved', `Stage 1 progress saved as draft for ${company}.`, {});
    location.href = `detail.html?id=${s1a_contactId}`;
  } catch (err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Save Progress & Exit';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

async function s1a_submitForComplianceReview() {
  const errEl        = document.getElementById('ob-error');
  errEl.style.display = 'none';
  const company      = document.getElementById('ob-company')?.value.trim();
  const regNumber    = document.getElementById('ob-registration')?.value.trim();
  const country      = document.getElementById('ob-country')?.value.trim();
  const supplierType = document.getElementById('ob-type')?.value;
  const contactName  = document.getElementById('ob-contact-name')?.value.trim();
  const contactEmail = document.getElementById('ob-contact-email')?.value.trim();
  const qms          = document.getElementById('ob-qms')?.value;
  const profile      = OnboardingWorkflow.getSupplierProfile(supplierType);

  const missing = [];
  if (!company)      missing.push('Company Name');
  if (!regNumber)    missing.push('Registration Number');
  if (!country)      missing.push('Country');
  if (!supplierType) missing.push('Supplier Type');
  if (!contactName)  missing.push('Contact Name');
  if (!contactEmail) missing.push('Email');
  if (!qms && profile.showQms) missing.push('Quality Management System');

  if (missing.length) {
    errEl.textContent = `Please complete: ${missing.join(', ')}.`;
    errEl.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const btn = document.getElementById('complete-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const user    = await getCurrentUser();
    const payload = s1a_buildContactPayload();
    const ctLabel = payload.supplier_type === 'logistics' ? 'logistics provider'
      : payload.supplier_type === 'packaging' ? 'packaging supplier'
      : payload.supplier_type === 'service_provider' ? 'service provider' : 'supplier';

    if (!s1a_contactId) {
      const contactType = CONTACT_TYPE_MAP[payload.supplier_type] || 'supplier';
      const { data: existing } = await supabaseClient.from('contacts')
        .select('id').eq('type', contactType).ilike('company_name', company).limit(1);
      if (existing && existing.length > 0) {
        const proceed = confirm(`A ${ctLabel} named "${company}" already exists.\n\nProceed and create a new record anyway?`);
        if (!proceed) { btn.disabled = false; btn.textContent = 'Submit for Compliance Review'; return; }
      }
      s1a_contactId = await s1a_insertContact(payload);
      supplierId    = s1a_contactId;
    } else {
      const { error } = await supabaseClient.from('contacts').update(payload).eq('id', s1a_contactId);
      if (error) throw new Error('Failed to update supplier record: ' + error.message);
    }

    await s1a_syncProductsOffered(s1a_contactId);

    if (!onboardingId) {
      const { data: cuRows } = await supabaseClient.from('user_roles').select('user_id').eq('role', 'director_compliance').limit(1);
      const vetter = cuRows?.[0]?.user_id || null;
      const { data: ob, error: obErr } = await supabaseClient.from('supplier_onboarding').insert({
        contact_id: s1a_contactId, enquiry_id: enquiryId || null,
        workflow_stage: 'draft', raised_by: user?.id || null, vetting_assigned_to: vetter,
      }).select('id').single();
      if (obErr) throw new Error('Failed to create onboarding record: ' + obErr.message);
      onboardingId = ob.id;
      await OnboardingWorkflow.logEvent(s1a_contactId, onboardingId, 'onboarding_created',
        `Onboarding created for ${company} (${ctLabel}) by ${user?.email || 'unknown'}.`,
        { raised_by: user?.id, enquiry_id: enquiryId || null }
      );
      if (enquiryId) {
        await supabaseClient.from('supplier_enquiries').update({
          status: 'converted', converted_to_onboarding_id: ob.id,
          reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
        }).eq('id', enquiryId);
        await OnboardingWorkflow.logEvent(s1a_contactId, onboardingId, 'enquiry_converted',
          `Enquiry ${enquiryId} converted to onboarding.`, { enquiry_id: enquiryId }
        );
      }
    }

    const result = await OnboardingWorkflow.advanceStage(onboardingId, 'pending_compliance');
    if (!result.ok) {
      errEl.innerHTML = '<strong>Saved, but cannot be submitted for compliance review yet:</strong>' + OnboardingWorkflow.renderBlockers(result.blockers);
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Submit for Compliance Review';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    location.href = `detail.html?id=${s1a_contactId}`;
  } catch (err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Submit for Compliance Review';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

async function s1a_renderForm() {
  s1a_contactId = supplierId;
  document.getElementById('acc-s1a-body').innerHTML = `
    <div id="enquiry-banner" style="display:none;margin-bottom:var(--space-5);padding:var(--space-4) var(--space-5);background:rgba(122,184,212,0.08);border:1px solid rgba(122,184,212,0.25);border-radius:var(--radius);font-size:var(--text-sm)">
      <strong>Pre-filled from: </strong><span id="enquiry-banner-text"></span>
    </div>
    <div id="prereq-info" style="margin-bottom:var(--space-5);padding:var(--space-4) var(--space-5);background:rgba(122,184,212,0.08);border:1px solid rgba(122,184,212,0.25);border-radius:var(--radius);font-size:var(--text-sm)">
      <strong style="display:block;margin-bottom:var(--space-2)">Before you begin — have these ready:</strong>
      <ul id="prereq-list" style="margin:0;padding-left:var(--space-5);display:flex;flex-direction:column;gap:var(--space-1)"></ul>
    </div>

    <div style="margin-bottom:var(--space-6)">
      <h3 style="font-size:var(--text-base);font-weight:600;margin-bottom:var(--space-4)">Company Details</h3>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="ob-type">Supplier Type <span class="required">*</span></label>
          <select class="form-select" id="ob-type">
            <option value="">— Select type —</option>
            <option value="manufacturing">Manufacturing</option>
            <option value="materials_commodities">Materials / Commodities</option>
            <option value="logistics">Logistics / 3PL</option>
            <option value="packaging">Packaging</option>
            <option value="service_provider">Service Provider</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-company">Company Name <span class="required">*</span></label>
          <input type="text" class="form-input" id="ob-company" placeholder="Registered company name" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-registration">Registration Number <span class="required">*</span></label>
          <input type="text" class="form-input" id="ob-registration" placeholder="Company registration number" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-country">Country <span class="required">*</span></label>
          <input type="text" class="form-input" id="ob-country" placeholder="Country of incorporation" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-vat">VAT / GST Number</label>
          <input type="text" class="form-input" id="ob-vat" placeholder="If applicable" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-website">Website</label>
          <input type="url" class="form-input" id="ob-website" placeholder="https://" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label" for="ob-beneficial">Beneficial Owner(s)</label>
          <input type="text" class="form-input" id="ob-beneficial" placeholder="Name(s) of individuals owning 25%+ of shares" />
        </div>
      </div>
    </div>

    <div style="margin-bottom:var(--space-6)" id="ob-export-licence-group">
      <div class="form-group">
        <label class="form-label" for="ob-export-licence">Export Licence Number</label>
        <input type="text" class="form-input" id="ob-export-licence" placeholder="If applicable" />
      </div>
    </div>

    <div style="margin-bottom:var(--space-6)" id="ob-qms-group">
      <div class="form-group">
        <label class="form-label" for="ob-qms">Quality Management System <span class="required">*</span></label>
        <select class="form-select" id="ob-qms">
          <option value="">— Select —</option>
          <option value="iso_9001">ISO 9001</option>
          <option value="iso_14001">ISO 14001</option>
          <option value="iatf_16949">IATF 16949</option>
          <option value="as9100">AS9100</option>
          <option value="other">Other certified system</option>
          <option value="none">None / not applicable</option>
        </select>
      </div>
      <div id="ob-qms-details" class="form-grid" style="display:none;margin-top:var(--space-3)">
        <div class="form-group">
          <label class="form-label" for="ob-qms-ref">Certificate Reference</label>
          <input type="text" class="form-input" id="ob-qms-ref" placeholder="Certificate number" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-qms-expiry">Certificate Expiry</label>
          <input type="date" class="form-input" id="ob-qms-expiry" />
        </div>
      </div>
    </div>

    <div style="margin-bottom:var(--space-6)">
      <h3 style="font-size:var(--text-base);font-weight:600;margin-bottom:var(--space-4)">Primary Contact</h3>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="ob-contact-name">Contact Name <span class="required">*</span></label>
          <input type="text" class="form-input" id="ob-contact-name" placeholder="Full name" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-contact-email">Email <span class="required">*</span></label>
          <input type="email" class="form-input" id="ob-contact-email" placeholder="work@example.com" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-contact-phone">Direct Phone</label>
          <input type="text" class="form-input" id="ob-contact-phone" placeholder="+1 555 000 0000" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-company-phone">Company Phone</label>
          <input type="text" class="form-input" id="ob-company-phone" placeholder="+1 555 000 0000" />
        </div>
      </div>
    </div>

    <div style="margin-bottom:var(--space-6)">
      <h3 style="font-size:var(--text-base);font-weight:600;margin-bottom:var(--space-4)">Registered Address</h3>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="ob-address1">Address Line 1</label>
          <input type="text" class="form-input" id="ob-address1" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-address2">Address Line 2</label>
          <input type="text" class="form-input" id="ob-address2" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-city">City</label>
          <input type="text" class="form-input" id="ob-city" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-postcode">Postcode / ZIP</label>
          <input type="text" class="form-input" id="ob-postcode" />
        </div>
      </div>
      <label style="display:flex;gap:var(--space-2);align-items:center;cursor:pointer;font-size:var(--text-sm);margin-top:var(--space-3)">
        <input type="checkbox" id="ob-dispatch-different" style="accent-color:var(--color-accent)"
          onchange="document.getElementById('ob-dispatch-address').style.display=this.checked?'flex':'none'" />
        Dispatch / collection address differs from registered address
      </label>
      <div id="ob-dispatch-address" class="form-grid" style="display:none;margin-top:var(--space-3)">
        <div class="form-group">
          <label class="form-label" for="ob-dispatch-address1">Dispatch Address Line 1</label>
          <input type="text" class="form-input" id="ob-dispatch-address1" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-dispatch-address2">Dispatch Address Line 2</label>
          <input type="text" class="form-input" id="ob-dispatch-address2" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-dispatch-city">City</label>
          <input type="text" class="form-input" id="ob-dispatch-city" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-dispatch-postcode">Postcode / ZIP</label>
          <input type="text" class="form-input" id="ob-dispatch-postcode" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ob-dispatch-country">Country</label>
          <input type="text" class="form-input" id="ob-dispatch-country" />
        </div>
      </div>
    </div>

    <div style="margin-bottom:var(--space-6)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">
        <h3 style="font-size:var(--text-base);font-weight:600;margin:0">Products Offered</h3>
        <button type="button" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)" id="add-product-offered-btn">+ Add Product</button>
      </div>
      <table class="table">
        <thead><tr><th>Family</th><th>Product</th><th>Specification</th><th></th></tr></thead>
        <tbody id="products-offered-body"></tbody>
      </table>
    </div>

    <div class="form-grid" style="margin-bottom:var(--space-6)">
      <div class="form-group">
        <label class="form-label" for="ob-supplier-ref">Supplier Reference</label>
        <input type="text" class="form-input" id="ob-supplier-ref" placeholder="Auto-generated" />
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label" for="ob-notes">Notes</label>
        <textarea class="form-textarea" id="ob-notes" rows="3" placeholder="Any additional context about this supplier…"></textarea>
      </div>
    </div>

    <div id="ob-error" style="display:none;margin-bottom:var(--space-4);padding:var(--space-3) var(--space-4);background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.2);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--color-danger)"></div>
    <div style="display:flex;gap:var(--space-3);justify-content:flex-end;margin-bottom:var(--space-6)">
      <button type="button" class="btn btn-ghost" id="save-exit-btn">Save Progress &amp; Exit</button>
      <button type="button" class="btn btn-primary" id="complete-btn">Submit for Compliance Review</button>
    </div>`;

  document.getElementById('save-exit-btn').addEventListener('click', s1a_submitSaveAndExit);
  document.getElementById('complete-btn').addEventListener('click', s1a_submitForComplianceReview);
  document.getElementById('ob-type').addEventListener('change', s1a_onSupplierTypeChange);
  document.getElementById('ob-qms').addEventListener('change', s1a_toggleQmsFields);
  document.getElementById('add-product-offered-btn').addEventListener('click', s1a_openAddProductModal);

  await s1a_loadProductCatalogue();
  s1a_renderProductsOffered();
  if (enquiryId)   await s1a_loadEnquiry();
  if (supplierId)  await s1a_loadExistingContact();
  if (!document.getElementById('ob-supplier-ref').value) {
    document.getElementById('ob-supplier-ref').value = OnboardingWorkflow.generateSupplierReference();
  }
  s1a_toggleQmsFields();
  s1a_onSupplierTypeChange();
}

// ═══════════════════════════════════════════════════════════
// STAGE 1b — COMPLIANCE REVIEW
// ═══════════════════════════════════════════════════════════

let s1b_existingSanctionsScreen = null;
let s1b_existingComplianceScore = null;
let s1b_existingCommercialScore = null;
let s1b_gate1Approvals          = {};
let s1b_productsReview          = [];

function s1b_summaryItem(label, value) {
  return `<div><div class="summary-label">${esc(label)}</div><div>${esc(value || '—')}</div></div>`;
}

function s1b_renderSupplierSummary() {
  const addr = [contact.address_line_1, contact.address_line_2, contact.city, contact.postcode, contact.country].filter(Boolean).join(', ');
  document.getElementById('s1b-supplier-type-badge').innerHTML =
    `<span class="badge badge-neutral">${esc(SUPPLIER_TYPE_LABELS[contact.supplier_type] || contact.supplier_type || '—')}</span>`;
  document.getElementById('s1b-supplier-summary').innerHTML = [
    s1b_summaryItem('Company Name',        contact.company_name),
    s1b_summaryItem('Supplier Reference',  contact.supplier_reference),
    s1b_summaryItem('Country',             contact.country),
    s1b_summaryItem('Registration Number', contact.company_registration_number),
    s1b_summaryItem('VAT / GST Number',    contact.vat_number),
    s1b_summaryItem('Primary Contact',     contact.primary_contact_name),
    s1b_summaryItem('Email',               contact.email),
    s1b_summaryItem('Phone',               contact.phone),
    s1b_summaryItem('Address',             addr),
  ].join('');
}

async function s1b_loadProductsForReview() {
  const { data, error } = await supabaseClient
    .from('supplier_quotes')
    .select('id, product, specification, onboarding_review_status, onboarding_review_notes, product_line:product_lines(name, metal_family, sub_type)')
    .eq('supplier_id', supplierId)
    .not('onboarding_review_status', 'is', null);
  if (error) {
    document.getElementById('s1b-products-review-body').innerHTML =
      `<tr><td colspan="5" style="text-align:center;color:var(--color-danger);padding:var(--space-6)">${esc(error.message)}</td></tr>`;
    return;
  }
  s1b_productsReview = data || [];
  const tbody = document.getElementById('s1b-products-review-body');
  if (!s1b_productsReview.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:var(--space-6)">No products were offered during registration.</td></tr>';
    return;
  }
  tbody.innerHTML = s1b_productsReview.map(r => {
    const pl     = r.product_line || {};
    const family = pl.metal_family ? `${esc(pl.metal_family)}${pl.sub_type ? ` / ${esc(pl.sub_type)}` : ''}` : '—';
    return `
      <tr>
        <td>${family}</td>
        <td style="font-weight:600">${esc(pl.name || r.product)}</td>
        <td>${esc(r.specification || '—')}</td>
        <td>
          <select class="form-select" id="s1b-review-status-${esc(r.id)}">
            <option value="pending_review" ${r.onboarding_review_status === 'pending_review' ? 'selected' : ''}>Pending Review</option>
            <option value="approved"       ${r.onboarding_review_status === 'approved'       ? 'selected' : ''}>Approved</option>
            <option value="rejected"       ${r.onboarding_review_status === 'rejected'       ? 'selected' : ''}>Rejected</option>
          </select>
        </td>
        <td><input type="text" class="form-input" id="s1b-review-notes-${esc(r.id)}" value="${esc(r.onboarding_review_notes || '')}" placeholder="Notes…" /></td>
      </tr>`;
  }).join('');
}

function s1b_renderSanctionsListLinks() {
  document.getElementById('s1b-sanctions-list-links').innerHTML = SANCTIONS_LISTS.map(l =>
    `<a href="${esc(l.url)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)">${esc(l.name)} →</a>`
  ).join('');
}

async function s1b_loadSanctionsSection() {
  const { data } = await supabaseClient
    .from('sanctions_screens')
    .select('id, screened_at, lists_screened, tool_used, result, match_resolution_notes')
    .eq('subject_id', supplierId)
    .order('screened_at', { ascending: false }).limit(1);
  s1b_existingSanctionsScreen = data?.[0] || null;

  const el      = document.getElementById('s1b-sanctions-section');
  const badgeEl = document.getElementById('s1b-sanctions-status-badge');
  const RC      = { clear:'badge-success', potential_match:'badge-warning', confirmed_match:'badge-danger' };

  if (s1b_existingSanctionsScreen) {
    const s = s1b_existingSanctionsScreen;
    badgeEl.innerHTML = `<span class="badge badge-success">Screen on file</span>`;
    el.innerHTML = `
      <div style="padding:var(--space-4);background:rgba(22,163,74,0.06);border:1px solid rgba(22,163,74,0.2);border-radius:var(--radius-sm);margin-bottom:var(--space-4)">
        <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:var(--space-2)">Sanctions screen on file</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-3);font-size:var(--text-sm)">
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Date</div>${fmtDate(s.screened_at)}</div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Lists</div>${(s.lists_screened||[]).join(', ')||'—'}</div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Result</div><span class="badge ${RC[s.result]||'badge-neutral'}">${esc(s.result?.replace(/_/g,' '))}</span></div>
          ${s.tool_used ? `<div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Tool</div>${esc(s.tool_used)}</div>` : ''}
        </div>
        ${s.match_resolution_notes ? `<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin:var(--space-2) 0 0">${esc(s.match_resolution_notes)}</p>` : ''}
      </div>
      <p style="font-size:var(--text-sm);color:var(--color-text-muted)">A screen is on file and satisfies the Stage 1 requirement.</p>`;
    return;
  }

  badgeEl.innerHTML = `<span class="badge badge-danger">Screen required</span>`;
  const today = new Date().toISOString().split('T')[0];
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-4)">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="s1b-s-name">Subject Name Screened</label>
          <input type="text" class="form-input" id="s1b-s-name" value="${esc(contact.company_name)}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="s1b-s-date">Screening Date</label>
          <input type="date" class="form-input" id="s1b-s-date" value="${today}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Lists Screened</label>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-4)">
          ${SANCTIONS_LISTS.map(l => `<label style="display:flex;gap:var(--space-2);align-items:center;font-size:var(--text-sm);cursor:pointer"><input type="checkbox" class="s1b-list-check" value="${esc(l.name)}" style="accent-color:var(--color-accent)" checked /> ${esc(l.name)}</label>`).join('')}
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="s1b-s-tool">Screening Tool / Source</label>
          <input type="text" class="form-input" id="s1b-s-tool" placeholder="e.g. Dow Jones, ComplyAdvantage, manual" />
        </div>
        <div class="form-group">
          <label class="form-label" for="s1b-s-result">Result <span class="required">*</span></label>
          <select class="form-select" id="s1b-s-result">
            <option value="">Select result…</option>
            <option value="clear">Clear — no matches</option>
            <option value="potential_match">Potential match — investigated and cleared</option>
            <option value="confirmed_match">Confirmed match</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="s1b-s-notes">Notes / Match Resolution</label>
        <textarea class="form-textarea" id="s1b-s-notes" rows="2" placeholder="Any potential matches and how they were resolved…"></textarea>
      </div>
    </div>`;
}

function s1b_renderComplianceFactors() {
  const groups      = OnboardingWorkflow.COMPLIANCE_FACTOR_GROUPS_BY_TYPE[contact.supplier_type] || Object.keys(OnboardingWorkflow.COMPLIANCE_FACTORS);
  const checkedKeys = (s1b_existingComplianceScore?.components || []).map(c => c.factor_key);
  if (s1b_existingComplianceScore?.rating_band === 'Prohibited') checkedKeys.push('sanctions_match');

  document.getElementById('s1b-compliance-factors-container').innerHTML = groups.map(group => {
    const factors = OnboardingWorkflow.COMPLIANCE_FACTORS[group] || [];
    return `
      <div style="border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-4);margin-bottom:var(--space-3)">
        <div style="font-family:var(--font-display);font-weight:600;font-size:var(--text-sm);margin-bottom:var(--space-3)">${esc(COMPLIANCE_GROUP_LABELS[group] || group)}</div>
        ${factors.map(f => {
          const pillClass = f.autoReject ? 'score-pill-danger' : f.score < 0 ? 'score-pill-positive' : f.score === 0 ? 'score-pill-neutral' : 'score-pill-risk';
          const pillLabel = f.autoReject ? 'Prohibited' : (f.score > 0 ? '+' : '') + f.score;
          return `
          <label style="display:flex;gap:var(--space-3);align-items:center;padding:var(--space-2) 0;cursor:pointer;font-size:var(--text-sm)">
            <input type="checkbox" class="s1b-compliance-factor-check"
              data-key="${esc(f.key)}" data-score="${f.autoReject ? 'auto_reject' : f.score}"
              ${checkedKeys.includes(f.key) ? 'checked' : ''}
              onchange="s1b_updateComplianceLiveScore()"
              style="accent-color:var(--color-accent);flex-shrink:0" />
            <span style="flex:1">${esc(f.label)}</span>
            <span class="score-pill ${pillClass}">${pillLabel}</span>
          </label>`;
        }).join('')}
      </div>`;
  }).join('');
  s1b_updateComplianceLiveScore();
}

function s1b_updateComplianceLiveScore() {
  const keys   = Array.from(document.querySelectorAll('.s1b-compliance-factor-check:checked')).map(ch => ch.dataset.key);
  const result = OnboardingWorkflow.computeComplianceScore(keys, contact.supplier_type);
  const totalEl = document.getElementById('s1b-compliance-total');
  const bandEl  = document.getElementById('s1b-compliance-band-badge');
  const liveEl  = document.getElementById('s1b-compliance-live-badge');
  if (result.prohibited) {
    if (totalEl) totalEl.textContent = '—';
    const html = '<span class="badge badge-danger">Prohibited — Hard Reject</span>';
    if (bandEl) bandEl.innerHTML = html;
    if (liveEl) liveEl.innerHTML = html;
  } else {
    if (totalEl) totalEl.textContent = result.total ?? 0;
    const cls  = result.band === 'Low Risk' ? 'badge-success' : result.band === 'Medium Risk' ? 'badge-warning' : 'badge-danger';
    const html = `<span class="badge ${cls}">${esc(result.band)}</span>`;
    if (bandEl) bandEl.innerHTML = html;
    if (liveEl) liveEl.innerHTML = html;
  }
  s1b_updateMatrixRecommendation();
}

function s1b_renderCommercialFactors() {
  const checkedKeys = (s1b_existingCommercialScore?.components || []).map(c => c.factor_key);
  document.getElementById('s1b-commercial-factors-container').innerHTML =
    Object.entries(OnboardingWorkflow.COMMERCIAL_FACTORS).map(([group, factors]) => `
      <div style="border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-4);margin-bottom:var(--space-3)">
        <div style="font-family:var(--font-display);font-weight:600;font-size:var(--text-sm);margin-bottom:var(--space-3)">${esc(COMMERCIAL_GROUP_LABELS[group] || group)}</div>
        ${factors.map(f => {
          const pillClass = f.score >= 20 ? 'score-pill-positive' : f.score >= 10 ? 'score-pill-neutral' : 'score-pill-risk';
          return `
          <label style="display:flex;gap:var(--space-3);align-items:center;padding:var(--space-2) 0;cursor:pointer;font-size:var(--text-sm)">
            <input type="radio" name="s1b-commercial-${esc(group)}" class="s1b-commercial-factor-radio"
              value="${esc(f.key)}" data-score="${f.score}"
              ${checkedKeys.includes(f.key) ? 'checked' : ''}
              onchange="s1b_updateCommercialLiveScore()"
              style="accent-color:var(--color-accent);flex-shrink:0" />
            <span style="flex:1">${esc(f.label)}</span>
            <span class="score-pill ${pillClass}">+${f.score}</span>
          </label>`;
        }).join('')}
      </div>`).join('');
  s1b_updateCommercialLiveScore();
}

function s1b_updateCommercialLiveScore() {
  const keys   = Array.from(document.querySelectorAll('.s1b-commercial-factor-radio:checked')).map(r => r.value);
  const result = OnboardingWorkflow.computeCommercialScore(keys);
  const totalEl = document.getElementById('s1b-commercial-total');
  const bandEl  = document.getElementById('s1b-commercial-band-badge');
  const liveEl  = document.getElementById('s1b-commercial-live-badge');
  if (totalEl) totalEl.textContent = result.total;
  const cls  = (result.band === 'Strategic Supplier' || result.band === 'Strong Fit') ? 'badge-success' : result.band === 'Moderate Fit' ? 'badge-warning' : 'badge-neutral';
  const html = `<span class="badge ${cls}">${esc(result.band)}</span>`;
  if (bandEl) bandEl.innerHTML = html;
  if (liveEl) liveEl.innerHTML = html;
  s1b_updateMatrixRecommendation();
}

function s1b_updateMatrixRecommendation() {
  const compKeys = Array.from(document.querySelectorAll('.s1b-compliance-factor-check:checked')).map(c => c.dataset.key);
  const commKeys = Array.from(document.querySelectorAll('.s1b-commercial-factor-radio:checked')).map(r => r.value);
  const el = document.getElementById('s1b-matrix-recommendation-text');
  if (!el || (!compKeys.length && !commKeys.length)) return;
  const compResult = OnboardingWorkflow.computeComplianceScore(compKeys, contact.supplier_type);
  const commResult = OnboardingWorkflow.computeCommercialScore(commKeys);
  const rec = OnboardingWorkflow.matrixRecommendation(compResult.band, commResult.band);
  const recClass = rec.includes('Reject') || rec.includes('Prohibited') ? 'badge-danger'
    : rec.includes('Excellent') || rec.includes('Good') ? 'badge-success' : 'badge-warning';
  el.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:center;font-size:var(--text-sm)">
      <span>Compliance: <strong>${esc(compResult.band)}</strong></span>
      <span style="color:var(--color-text-muted)">×</span>
      <span>Commercial: <strong>${esc(commResult.band)}</strong></span>
      <span style="color:var(--color-text-muted)">→</span>
      <span class="badge ${recClass}">${esc(rec)}</span>
    </div>`;
}

function s1b_renderGate1SignoffPanel() {
  const compApproval = s1b_gate1Approvals['gate1_compliance'];
  const commApproval = s1b_gate1Approvals['gate1_commercial'];
  document.getElementById('s1b-gate1-compliance-section').innerHTML = compApproval
    ? s1b_buildApprovalReadOnly('Compliance Director (Martyn)', compApproval)
    : s1b_buildApprovalForm('compliance', 'Compliance Director (Martyn)', [
        { value: 'approve',                 label: 'Approve' },
        { value: 'approve_with_conditions', label: 'Approve with Conditions' },
        { value: 'reject',                  label: 'Reject' },
      ]);
  document.getElementById('s1b-gate1-commercial-section').innerHTML = commApproval
    ? s1b_buildApprovalReadOnly('Commercial Director (Jackson)', commApproval)
    : s1b_buildApprovalForm('commercial', 'Commercial Director (Jackson)', [
        { value: 'approve', label: 'Approve' },
        { value: 'reject',  label: 'Reject' },
      ]);
}

function s1b_buildApprovalReadOnly(label, row) {
  const decClass = row.decision === 'reject' ? 'badge-danger' : row.decision === 'approve_with_conditions' ? 'badge-warning' : 'badge-success';
  return `
    <div style="padding:var(--space-4);background:rgba(22,163,74,0.04);border:1px solid rgba(22,163,74,0.2);border-radius:var(--radius-sm)">
      <div style="font-weight:600;font-size:var(--text-sm);margin-bottom:var(--space-2)">${esc(label)}</div>
      <div style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap;font-size:var(--text-sm)">
        <span class="badge ${decClass}">${esc((row.decision || '').replace(/_/g,' '))}</span>
        <span style="color:var(--color-text-muted)">on ${fmtDate(row.decided_at)}</span>
      </div>
      ${row.justification ? `<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin:var(--space-2) 0 0">${esc(row.justification)}</p>` : ''}
      ${row.conditions    ? `<p style="font-size:var(--text-xs);margin:var(--space-1) 0 0"><strong>Conditions:</strong> ${esc(row.conditions)}</p>` : ''}
    </div>`;
}

function s1b_buildApprovalForm(role, label, options) {
  return `
    <div style="padding:var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-sm);margin-top:var(--space-3)">
      <div style="font-weight:600;font-size:var(--text-sm);margin-bottom:var(--space-3)">${esc(label)} — Gate 1 Sign-off</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="s1b-gate1-${role}-decision">Decision</label>
          <select class="form-select" id="s1b-gate1-${role}-decision" onchange="s1b_toggleConditionsField('${esc(role)}')">
            <option value="">— not yet submitted —</option>
            ${options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="s1b-gate1-${role}-justification">Justification</label>
          <textarea class="form-textarea" id="s1b-gate1-${role}-justification" rows="2" placeholder="Basis for this decision…"></textarea>
        </div>
      </div>
      <div class="form-group" id="s1b-gate1-${role}-conditions-group" style="display:none">
        <label class="form-label" for="s1b-gate1-${role}-conditions">Conditions <span class="required">*</span></label>
        <textarea class="form-textarea" id="s1b-gate1-${role}-conditions" rows="2" placeholder="Conditions that must be met before proceeding…"></textarea>
      </div>
    </div>`;
}

function s1b_toggleConditionsField(role) {
  const decision = document.getElementById(`s1b-gate1-${role}-decision`)?.value;
  const grp      = document.getElementById(`s1b-gate1-${role}-conditions-group`);
  if (grp) grp.style.display = decision === 'approve_with_conditions' ? 'block' : 'none';
}

async function s1b_submitSaveAndExit() {
  const errEl = document.getElementById('s1b-error');
  errEl.style.display = 'none';
  const btn = document.getElementById('s1b-save-exit-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const user = await getCurrentUser();

    if (!s1b_existingSanctionsScreen) {
      const result = document.getElementById('s1b-s-result')?.value || null;
      if (result) {
        const lists = Array.from(document.querySelectorAll('.s1b-list-check:checked')).map(el => el.value);
        const { error: sErr } = await supabaseClient.from('sanctions_screens').insert({
          subject_type:           'contact',
          subject_id:             supplierId,
          subject_name_snapshot:  document.getElementById('s1b-s-name')?.value.trim(),
          screened_at:            document.getElementById('s1b-s-date')?.value ? new Date(document.getElementById('s1b-s-date').value).toISOString() : new Date().toISOString(),
          screened_by:            user?.id,
          lists_screened:         lists,
          tool_used:              document.getElementById('s1b-s-tool')?.value.trim() || null,
          result,
          match_resolution_notes: document.getElementById('s1b-s-notes')?.value.trim() || null,
        });
        if (sErr) throw new Error('Failed to save sanctions screen: ' + sErr.message);
        await supabaseClient.from('contacts').update({ last_sanctions_screened_at: new Date().toISOString(), last_sanctions_result: result }).eq('id', supplierId);
      }
    }

    if (!s1b_existingComplianceScore) {
      const compKeys = Array.from(document.querySelectorAll('.s1b-compliance-factor-check:checked')).map(ch => ch.dataset.key);
      if (compKeys.length > 0) {
        const compResult = OnboardingWorkflow.computeComplianceScore(compKeys, contact.supplier_type);
        await supabaseClient.from('supplier_compliance_scores').insert({
          supplier_id: supplierId, onboarding_id: onboardingId, gate: 1,
          total_score: compResult.prohibited ? 0 : compResult.total, rating_band: compResult.band, components: compResult.components, computed_by: user?.id || null,
        });
      }
    }

    if (!s1b_existingCommercialScore) {
      const commKeys = Array.from(document.querySelectorAll('.s1b-commercial-factor-radio:checked')).map(r => r.value);
      if (commKeys.length > 0) {
        const commResult = OnboardingWorkflow.computeCommercialScore(commKeys);
        await supabaseClient.from('supplier_commercial_scores').insert({
          supplier_id: supplierId, onboarding_id: onboardingId, gate: 1,
          total_score: commResult.total, rating_band: commResult.band, components: commResult.components, computed_by: user?.id || null,
        });
      }
    }

    for (const role of ['compliance', 'commercial']) {
      if (s1b_gate1Approvals[`gate1_${role}`]) continue;
      const decision = document.getElementById(`s1b-gate1-${role}-decision`)?.value;
      if (!decision) continue;
      const justification = (document.getElementById(`s1b-gate1-${role}-justification`)?.value || '').trim();
      if (!justification) continue;
      const conditions = (document.getElementById(`s1b-gate1-${role}-conditions`)?.value || '').trim() || null;
      await supabaseClient.from('supplier_approvals').insert({
        supplier_id: supplierId, onboarding_id: onboardingId,
        approval_stage: `gate1_${role}`, approver_id: user?.id,
        approver_role: role === 'compliance' ? 'director_compliance' : 'director_commercial',
        decision, justification,
        conditions: decision === 'approve_with_conditions' ? conditions : null,
        decided_at: new Date().toISOString(),
      });
    }

    for (const r of s1b_productsReview) {
      const status = document.getElementById(`s1b-review-status-${r.id}`)?.value || r.onboarding_review_status;
      const notes  = document.getElementById(`s1b-review-notes-${r.id}`)?.value.trim() || null;
      if (status !== r.onboarding_review_status || notes !== r.onboarding_review_notes) {
        await supabaseClient.from('supplier_quotes').update({ onboarding_review_status: status, onboarding_review_notes: notes }).eq('id', r.id);
      }
    }

    await OnboardingWorkflow.logEvent(supplierId, onboardingId, 'stage_advanced', 'Stage 1b progress saved — pending remaining sign-off.', {});
    location.href = `detail.html?id=${supplierId}`;
  } catch (err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Save Progress & Exit';
  }
}

async function s1b_submitComplianceReview() {
  const errEl = document.getElementById('s1b-error');
  errEl.style.display = 'none';
  const missing = [];

  let sanctionsResult = s1b_existingSanctionsScreen?.result || null;
  if (!s1b_existingSanctionsScreen) {
    sanctionsResult = document.getElementById('s1b-s-result')?.value || null;
    if (!sanctionsResult) missing.push('Sanctions Screening Result');
  }

  const compKeys = Array.from(document.querySelectorAll('.s1b-compliance-factor-check:checked')).map(ch => ch.dataset.key);
  if (!s1b_existingComplianceScore && compKeys.length === 0) missing.push('Compliance Risk Score (select at least one factor)');

  for (const role of ['compliance', 'commercial']) {
    if (s1b_gate1Approvals[`gate1_${role}`]) continue;
    const dec  = document.getElementById(`s1b-gate1-${role}-decision`)?.value;
    const just = (document.getElementById(`s1b-gate1-${role}-justification`)?.value || '').trim();
    if (dec && !just) missing.push(`${role.charAt(0).toUpperCase() + role.slice(1)} director sign-off justification`);
    if (dec === 'approve_with_conditions') {
      const cond = (document.getElementById(`s1b-gate1-${role}-conditions`)?.value || '').trim();
      if (!cond) missing.push(`${role.charAt(0).toUpperCase() + role.slice(1)} director conditions`);
    }
  }

  if (missing.length) {
    errEl.textContent = `Please complete: ${missing.join(', ')}.`;
    errEl.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (sanctionsResult === 'confirmed_match') {
    if (!confirm('A confirmed sanctions match will result in this onboarding being rejected. Proceed?')) return;
  }

  const btn = document.getElementById('s1b-complete-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const user = await getCurrentUser();

    if (!s1b_existingSanctionsScreen) {
      const lists = Array.from(document.querySelectorAll('.s1b-list-check:checked')).map(el => el.value);
      const { data: screen, error: sErr } = await supabaseClient.from('sanctions_screens').insert({
        subject_type:           'contact',
        subject_id:             supplierId,
        subject_name_snapshot:  document.getElementById('s1b-s-name')?.value.trim(),
        screened_at:            document.getElementById('s1b-s-date')?.value ? new Date(document.getElementById('s1b-s-date').value).toISOString() : new Date().toISOString(),
        screened_by:            user?.id,
        lists_screened:         lists,
        tool_used:              document.getElementById('s1b-s-tool')?.value.trim() || null,
        result:                 sanctionsResult,
        match_resolution_notes: document.getElementById('s1b-s-notes')?.value.trim() || null,
      }).select('id').single();
      if (sErr) throw new Error('Failed to save sanctions screen: ' + sErr.message);
      await supabaseClient.from('contacts').update({
        last_sanctions_screened_at: new Date().toISOString(),
        last_sanctions_result:      sanctionsResult,
      }).eq('id', supplierId);
      await OnboardingWorkflow.logEvent(supplierId, onboardingId, 'sanctions_linked', `Sanctions screen recorded: result = ${sanctionsResult}.`, { screen_id: screen.id });
    }

    if (compKeys.length > 0) {
      const compResult = OnboardingWorkflow.computeComplianceScore(compKeys, contact.supplier_type);
      if (compResult.prohibited) {
        await supabaseClient.from('supplier_compliance_scores').insert({
          supplier_id: supplierId, onboarding_id: onboardingId, gate: 1,
          total_score: 0, rating_band: 'Prohibited', components: compResult.components, computed_by: user?.id || null,
        });
        await OnboardingWorkflow.rejectOnboarding(onboardingId, 'stage1_complete', 'Prohibited compliance risk factor selected (sanctions match confirmed).');
        location.href = `detail.html?id=${supplierId}`;
        return;
      }
      const { error: csErr } = await supabaseClient.from('supplier_compliance_scores').insert({
        supplier_id: supplierId, onboarding_id: onboardingId, gate: 1,
        total_score: compResult.total, rating_band: compResult.band, components: compResult.components, computed_by: user?.id || null,
      });
      if (csErr) throw new Error('Failed to save compliance score: ' + csErr.message);
      const legacyLevel = compResult.band === 'Low Risk' ? 'low' : compResult.band === 'Medium Risk' ? 'medium' : 'high';
      await supabaseClient.from('supplier_onboarding').update({ risk_level: legacyLevel, updated_at: new Date().toISOString() }).eq('id', onboardingId);
      await OnboardingWorkflow.logEvent(supplierId, onboardingId, 'risk_assessment_saved', `Gate 1 compliance risk score: ${compResult.total} → ${compResult.band}.`, { total: compResult.total, band: compResult.band, gate: 1 });
    }

    const commKeys = Array.from(document.querySelectorAll('.s1b-commercial-factor-radio:checked')).map(r => r.value);
    if (commKeys.length > 0) {
      const commResult = OnboardingWorkflow.computeCommercialScore(commKeys);
      const { error: cmsErr } = await supabaseClient.from('supplier_commercial_scores').insert({
        supplier_id: supplierId, onboarding_id: onboardingId, gate: 1,
        total_score: commResult.total, rating_band: commResult.band, components: commResult.components, computed_by: user?.id || null,
      });
      if (cmsErr) throw new Error('Failed to save commercial score: ' + cmsErr.message);
    }

    for (const role of ['compliance', 'commercial']) {
      if (s1b_gate1Approvals[`gate1_${role}`]) continue;
      const decision      = document.getElementById(`s1b-gate1-${role}-decision`)?.value;
      if (!decision) continue;
      const justification = (document.getElementById(`s1b-gate1-${role}-justification`)?.value || '').trim();
      const conditions    = (document.getElementById(`s1b-gate1-${role}-conditions`)?.value    || '').trim() || null;
      const { error: apErr } = await supabaseClient.from('supplier_approvals').insert({
        supplier_id: supplierId, onboarding_id: onboardingId,
        approval_stage: `gate1_${role}`, approver_id: user?.id,
        approver_role: role === 'compliance' ? 'director_compliance' : 'director_commercial',
        decision, justification,
        conditions: decision === 'approve_with_conditions' ? conditions : null,
        decided_at: new Date().toISOString(),
      });
      if (apErr) throw new Error(`Failed to save Gate 1 ${role} sign-off: ${apErr.message}`);
    }

    for (const r of s1b_productsReview) {
      const status = document.getElementById(`s1b-review-status-${r.id}`)?.value || r.onboarding_review_status;
      const notes  = document.getElementById(`s1b-review-notes-${r.id}`)?.value.trim() || null;
      if (status !== r.onboarding_review_status || notes !== r.onboarding_review_notes) {
        await supabaseClient.from('supplier_quotes').update({ onboarding_review_status: status, onboarding_review_notes: notes }).eq('id', r.id);
      }
    }

    if (sanctionsResult === 'confirmed_match') {
      await OnboardingWorkflow.rejectOnboarding(onboardingId, 'stage1_complete', 'Confirmed sanctions match identified during Stage 1 screening.');
      location.href = `detail.html?id=${supplierId}`;
      return;
    }

    const result = await OnboardingWorkflow.advanceStage(onboardingId, 'stage1_complete');
    if (!result.ok) {
      errEl.innerHTML = '<strong>Saved, but Stage 1 cannot be marked complete yet:</strong>' + OnboardingWorkflow.renderBlockers(result.blockers);
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Complete Stage 1 — Ready to Quote';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    location.href = `detail.html?id=${supplierId}&onboarding_new=1`;
  } catch (err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Complete Stage 1 — Ready to Quote';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

async function s1b_renderForm() {
  document.getElementById('acc-s1b-body').innerHTML = `
    <div class="panel" style="margin-bottom:var(--space-5)">
      <div class="panel-header">
        <h3>Supplier Summary</h3>
        <span id="s1b-supplier-type-badge"></span>
      </div>
      <div class="panel-body">
        <div class="summary-grid" id="s1b-supplier-summary"></div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:var(--space-5)">
      <div class="panel-header">
        <h3>Products for Review</h3>
      </div>
      <div class="panel-body">
        <table class="table">
          <thead><tr><th>Family</th><th>Product</th><th>Specification</th><th>Review Status</th><th>Notes</th></tr></thead>
          <tbody id="s1b-products-review-body"></tbody>
        </table>
      </div>
    </div>

    <div class="panel" style="margin-bottom:var(--space-5)">
      <div class="panel-header">
        <h3>Sanctions Screening</h3>
        <span id="s1b-sanctions-status-badge"></span>
      </div>
      <div class="panel-body" style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div style="display:flex;gap:var(--space-3);flex-wrap:wrap" id="s1b-sanctions-list-links"></div>
        <div id="s1b-sanctions-section"><div style="color:var(--color-text-muted)">Loading…</div></div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:var(--space-5)">
      <div class="panel-header">
        <h3>Compliance Risk Score</h3>
        <span id="s1b-compliance-live-badge"></span>
      </div>
      <div class="panel-body" style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div id="s1b-compliance-factors-container"></div>
        <div class="overall-score-box">
          <div style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:var(--space-2)">Total Compliance Risk Score</div>
          <div style="font-size:var(--text-4xl);font-weight:700;color:#fff;margin-bottom:var(--space-2)" id="s1b-compliance-total">0</div>
          <div id="s1b-compliance-band-badge"></div>
          <div style="font-size:var(--text-xs);color:rgba(255,255,255,0.4);margin-top:var(--space-2)">≤20 = Low Risk · 21–40 = Medium · 41–60 = High · >60 = Very High</div>
        </div>
        <div style="border-top:1px solid var(--color-border);padding-top:var(--space-4)">
          <div style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-muted);margin-bottom:var(--space-3)">Compliance Director Sign-off</div>
          <div id="s1b-gate1-compliance-section"></div>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:var(--space-5)">
      <div class="panel-header">
        <h3>Commercial Suitability Score</h3>
        <span id="s1b-commercial-live-badge"></span>
      </div>
      <div class="panel-body" style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div id="s1b-commercial-factors-container"></div>
        <div class="overall-score-box">
          <div style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:var(--space-2)">Total Commercial Score</div>
          <div style="font-size:var(--text-4xl);font-weight:700;color:#fff;margin-bottom:var(--space-2)" id="s1b-commercial-total">0</div>
          <div id="s1b-commercial-band-badge"></div>
          <div style="font-size:var(--text-xs);color:rgba(255,255,255,0.4);margin-top:var(--space-2)">≤30 = Poor Fit · 31–60 = Moderate Fit · 61–80 = Strong Fit · >80 = Strategic</div>
        </div>
        <div id="s1b-matrix-recommendation-text"></div>
        <div style="border-top:1px solid var(--color-border);padding-top:var(--space-4)">
          <div style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-muted);margin-bottom:var(--space-3)">Commercial Director Sign-off</div>
          <div id="s1b-gate1-commercial-section"></div>
        </div>
      </div>
    </div>

    <div id="s1b-error" style="display:none;margin-bottom:var(--space-4);padding:var(--space-3) var(--space-4);background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.2);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--color-danger)"></div>
    <div style="display:flex;gap:var(--space-3);justify-content:flex-end;margin-bottom:var(--space-6)">
      <a href="${supplierId ? `detail.html?id=${esc(supplierId)}` : 'index.html'}" class="btn btn-ghost">Cancel</a>
      <button type="button" class="btn btn-ghost" id="s1b-save-exit-btn">Save Progress &amp; Exit</button>
      <button type="button" class="btn btn-primary" id="s1b-complete-btn">Complete Stage 1 — Ready to Quote</button>
    </div>`;

  document.getElementById('s1b-save-exit-btn').addEventListener('click', s1b_submitSaveAndExit);
  document.getElementById('s1b-complete-btn').addEventListener('click', s1b_submitComplianceReview);

  const [compScoreRes, commScoreRes, gate1Res] = await Promise.all([
    supabaseClient.from('supplier_compliance_scores').select('*').eq('onboarding_id', onboardingId).eq('gate', 1).order('computed_at', { ascending: false }).limit(1),
    supabaseClient.from('supplier_commercial_scores').select('*').eq('onboarding_id', onboardingId).eq('gate', 1).order('computed_at', { ascending: false }).limit(1),
    supabaseClient.from('supplier_approvals').select('*').eq('onboarding_id', onboardingId).in('approval_stage', ['gate1_compliance', 'gate1_commercial']),
  ]);
  s1b_existingComplianceScore = compScoreRes.data?.[0] || null;
  s1b_existingCommercialScore = commScoreRes.data?.[0] || null;
  (gate1Res.data || []).forEach(row => { s1b_gate1Approvals[row.approval_stage] = row; });

  s1b_renderSupplierSummary();
  await s1b_loadProductsForReview();
  s1b_renderSanctionsListLinks();
  await s1b_loadSanctionsSection();
  s1b_renderComplianceFactors();
  s1b_renderCommercialFactors();
  s1b_renderGate1SignoffPanel();
  s1b_updateMatrixRecommendation();

  const compBand = s1b_existingComplianceScore?.rating_band || '—';
  const commBand = s1b_existingCommercialScore?.rating_band || '—';
  const subEl = document.getElementById('acc-s1b-sub');
  if (subEl) subEl.textContent = s1b_existingComplianceScore ? `${compBand} compliance · ${commBand} commercial` : 'Pending compliance review';
}

// ═══════════════════════════════════════════════════════════
// STAGE 2 — PRE-TRADE VETTING
// ═══════════════════════════════════════════════════════════

let s2_isFullDiligence     = false;
let s2_bankEditMode        = false;
let s2_gate1ComplianceScore = null;
let s2_gate1CommercialScore = null;
let s2_gate2Approvals      = {};

async function s2_loadSanctionsReview() {
  const el      = document.getElementById('s2-sanctions-review-section');
  const badgeEl = document.getElementById('s2-sanctions-review-badge');
  const cutoff  = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1);

  const { data } = await supabaseClient.from('sanctions_screens')
    .select('id, screened_at, lists_screened, tool_used, result, match_resolution_notes')
    .eq('subject_id', contact.id).order('screened_at', { ascending: false }).limit(1);

  const latest   = data?.[0] || null;
  const isCurrent = latest && new Date(latest.screened_at) >= cutoff;
  const RC        = { clear:'badge-success', potential_match:'badge-warning', confirmed_match:'badge-danger' };

  if (!latest) {
    badgeEl.innerHTML = '<span class="badge badge-danger">No screen on file</span>';
    el.innerHTML = `<div class="check-item">${failIcon()}<div style="flex:1"><p style="font-size:var(--text-sm);margin:0">No sanctions screening record exists for this supplier.</p></div></div>` + s2_buildRescreenForm();
    s2_wireRescreenForm();
    return;
  }

  const age    = Math.floor((Date.now() - new Date(latest.screened_at)) / 86400000);
  const gateOk = isCurrent && latest.result !== 'confirmed_match';

  if (!isCurrent) badgeEl.innerHTML = '<span class="badge badge-warning">Screen overdue</span>';
  else if (latest.result === 'confirmed_match') badgeEl.innerHTML = '<span class="badge badge-danger">Confirmed match</span>';
  else badgeEl.innerHTML = '<span class="badge badge-success">Current</span>';

  el.innerHTML = `
    <div class="check-item" style="background:${gateOk ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)'}">
      ${gateOk ? passIcon() : warnIcon()}
      <div style="flex:1">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-3);font-size:var(--text-sm)">
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Date</div>${fmtDate(latest.screened_at)} (${age}d ago)</div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Result</div><span class="badge ${RC[latest.result]||'badge-neutral'}">${esc(latest.result?.replace('_',' '))}</span></div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Lists</div>${(latest.lists_screened||[]).join(', ')||'—'}</div>
          ${latest.tool_used ? `<div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Tool</div>${esc(latest.tool_used)}</div>` : ''}
        </div>
        ${latest.match_resolution_notes ? `<p style="font-size:var(--text-sm);color:var(--color-text-muted);margin:var(--space-2) 0 0">${esc(latest.match_resolution_notes)}</p>` : ''}
      </div>
    </div>
    ${!isCurrent ? `<p style="font-size:var(--text-sm);color:#d97706;margin:var(--space-3) 0 0">This screen is more than 12 months old. A new screen is required before Stage 2 can be completed.</p>${s2_buildRescreenForm()}` : ''}
    ${latest.result === 'confirmed_match' ? `<p style="font-size:var(--text-sm);color:var(--color-danger);margin:var(--space-3) 0 0">A confirmed sanctions match was recorded. This onboarding cannot proceed without re-screening and documented resolution.</p>${isCurrent ? s2_buildRescreenForm() : ''}` : ''}`;
  s2_wireRescreenForm();
}

function s2_buildRescreenForm() {
  const today = new Date().toISOString().split('T')[0];
  return `
    <div id="s2-rescreen-form" style="margin-top:var(--space-4);padding:var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-sm);display:flex;flex-direction:column;gap:var(--space-4)">
      <div style="font-size:var(--text-sm);font-weight:600">Record New Sanctions Screen</div>
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-3)">
        ${SANCTIONS_LISTS.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)">${esc(l.name)} →</a>`).join('')}
      </div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label" for="s2-rs-name">Subject Name Screened</label><input type="text" class="form-input" id="s2-rs-name" value="${esc(contact.company_name)}" /></div>
        <div class="form-group"><label class="form-label" for="s2-rs-date">Screening Date</label><input type="date" class="form-input" id="s2-rs-date" value="${today}" /></div>
      </div>
      <div class="form-group">
        <label class="form-label">Lists Screened</label>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-4)">
          ${SANCTIONS_LISTS.map(l => `<label style="display:flex;gap:var(--space-2);align-items:center;font-size:var(--text-sm);cursor:pointer"><input type="checkbox" class="s2-rs-list-check" value="${esc(l.name)}" style="accent-color:var(--color-accent)" checked /> ${esc(l.name)}</label>`).join('')}
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label" for="s2-rs-tool">Screening Tool / Source</label><input type="text" class="form-input" id="s2-rs-tool" placeholder="e.g. Dow Jones, ComplyAdvantage, manual" /></div>
        <div class="form-group">
          <label class="form-label" for="s2-rs-result">Result <span class="required">*</span></label>
          <select class="form-select" id="s2-rs-result">
            <option value="">Select result…</option>
            <option value="clear">Clear — no matches</option>
            <option value="potential_match">Potential match — investigated and cleared</option>
            <option value="confirmed_match">Confirmed match</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label class="form-label" for="s2-rs-notes">Notes / Match Resolution</label><textarea class="form-textarea" id="s2-rs-notes" rows="2" placeholder="Any potential matches and how they were resolved…"></textarea></div>
      <div id="s2-rs-error" style="display:none;color:var(--color-danger);font-size:var(--text-sm)"></div>
      <div><button type="button" class="btn btn-primary btn-sm" id="s2-rs-submit-btn">Save Sanctions Screen</button></div>
    </div>`;
}

function s2_wireRescreenForm() {
  document.getElementById('s2-rs-submit-btn')?.addEventListener('click', s2_submitRescreen);
}

async function s2_submitRescreen() {
  const errEl = document.getElementById('s2-rs-error');
  errEl.style.display = 'none';
  const result = document.getElementById('s2-rs-result')?.value;
  if (!result) { errEl.textContent = 'Please select a result.'; errEl.style.display = 'block'; return; }
  const btn = document.getElementById('s2-rs-submit-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  const user  = await getCurrentUser();
  const lists = Array.from(document.querySelectorAll('.s2-rs-list-check:checked')).map(el => el.value);
  const { data: screen, error } = await supabaseClient.from('sanctions_screens').insert({
    subject_type: 'contact', subject_id: contact.id,
    subject_name_snapshot: document.getElementById('s2-rs-name')?.value.trim(),
    screened_at: document.getElementById('s2-rs-date')?.value ? new Date(document.getElementById('s2-rs-date').value).toISOString() : new Date().toISOString(),
    screened_by: user?.id, lists_screened: lists,
    tool_used: document.getElementById('s2-rs-tool')?.value.trim() || null,
    result, match_resolution_notes: document.getElementById('s2-rs-notes')?.value.trim() || null,
  }).select('id').single();
  if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; btn.disabled = false; btn.textContent = 'Save Sanctions Screen'; return; }
  await supabaseClient.from('contacts').update({ last_sanctions_screened_at: new Date().toISOString(), last_sanctions_result: result }).eq('id', contact.id);
  await OnboardingWorkflow.logEvent(contact.id, onboardingId, 'sanctions_linked', `Sanctions re-screen recorded during Stage 2: result = ${result}.`, { screen_id: screen.id });
  if (result === 'confirmed_match') {
    if (confirm('A confirmed sanctions match will result in this onboarding being rejected. Proceed?')) {
      await OnboardingWorkflow.rejectOnboarding(onboardingId, onboarding.workflow_stage, 'Confirmed sanctions match identified during Stage 2 re-screening.');
      location.href = `detail.html?id=${contact.id}`;
      return;
    }
  }
  await s2_loadSanctionsReview();
}

async function s2_loadScoresPanel() {
  const [compRes, commRes] = await Promise.all([
    supabaseClient.from('supplier_compliance_scores').select('*').eq('onboarding_id', onboardingId).eq('gate', 1).order('computed_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseClient.from('supplier_commercial_scores').select('*').eq('onboarding_id', onboardingId).eq('gate', 1).order('computed_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  s2_gate1ComplianceScore = compRes.data || null;
  s2_gate1CommercialScore = commRes.data || null;
  s2_renderScoresSummary();

  if (s2_gate1ComplianceScore || s2_gate1CommercialScore) {
    document.getElementById('s2-scores-update-toggle').style.display = 'block';
    document.getElementById('s2-toggle-score-update-btn').addEventListener('click', () => {
      const form    = document.getElementById('s2-scores-update-form');
      const opening = form.style.display === 'none' || form.style.display === '';
      form.style.display = opening ? 'block' : 'none';
      document.getElementById('s2-toggle-score-update-btn').textContent = opening ? 'Hide Score Update Form' : 'Update Scores for Gate 2';
      if (opening) { s2_renderComplianceUpdateForm(); s2_renderCommercialUpdateForm(); s2_updateComplianceLiveScore(); s2_updateCommercialLiveScore(); }
    });
  }

  const { data: gate2Rows } = await supabaseClient.from('supplier_approvals').select('*').eq('onboarding_id', onboardingId).in('approval_stage', ['gate2_compliance', 'gate2_commercial']);
  s2_gate2Approvals = {};
  for (const row of (gate2Rows || [])) s2_gate2Approvals[row.approval_stage] = row;
  s2_renderGate2SignoffPanel();
  s2_updateGate2MatrixRec();
}

function s2_renderScoresSummary() {
  const el = document.getElementById('s2-scores-summary-cards');
  const cs = s2_gate1ComplianceScore;
  const cm = s2_gate1CommercialScore;
  if (!cs && !cm) {
    el.innerHTML = '<p style="font-size:var(--text-sm);color:var(--color-text-muted)">No additive scores recorded at Gate 1.</p>';
    return;
  }
  const compBandClass = !cs ? 'badge-neutral' : cs.rating_band === 'Low Risk' ? 'badge-success' : cs.rating_band === 'Medium Risk' ? 'badge-warning' : 'badge-danger';
  const commBandClass = !cm ? 'badge-neutral' : (cm.rating_band === 'Strategic Supplier' || cm.rating_band === 'Strong Fit') ? 'badge-success' : cm.rating_band === 'Moderate Fit' ? 'badge-warning' : 'badge-neutral';
  function compPills(components) {
    if (!components?.length) return '';
    return components.map(c => {
      const cls = c.score < 0 ? 'score-pill score-pill-positive' : c.score > 0 ? 'score-pill score-pill-risk' : 'score-pill score-pill-neutral';
      return `<span class="${cls}">${esc(c.label)} ${c.score > 0 ? '+' : ''}${c.score}</span>`;
    }).join(' ');
  }
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-bottom:var(--space-2)">
      <div style="padding:var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-sm)">
        <div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-2)">Compliance Risk (Gate 1)</div>
        ${cs ? `<div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)"><span class="badge ${compBandClass}">${esc(cs.rating_band)}</span><span style="font-size:var(--text-sm);color:var(--color-text-muted)">Score: ${cs.total_score !== null ? cs.total_score : '—'}</span></div><div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-2)">${fmtDate(cs.computed_at)}</div><div style="display:flex;flex-wrap:wrap;gap:4px">${compPills(cs.components)}</div>` : '<span class="badge badge-neutral">Not scored</span>'}
      </div>
      <div style="padding:var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-sm)">
        <div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-2)">Commercial Suitability (Gate 1)</div>
        ${cm ? `<div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)"><span class="badge ${commBandClass}">${esc(cm.rating_band)}</span><span style="font-size:var(--text-sm);color:var(--color-text-muted)">Score: ${cm.total_score}</span></div><div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-2)">${fmtDate(cm.computed_at)}</div><div style="display:flex;flex-wrap:wrap;gap:4px">${compPills(cm.components)}</div>` : '<span class="badge badge-neutral">Not scored</span>'}
      </div>
    </div>`;
}

function s2_updateGate2MatrixRec() {
  const el = document.getElementById('s2-gate2-matrix-rec');
  if (!el) return;
  const cs = s2_gate1ComplianceScore; const cm = s2_gate1CommercialScore;
  if (!cs || !cm) { el.textContent = 'Gate 1 scores required to derive a matrix recommendation.'; return; }
  const rec      = OnboardingWorkflow.matrixRecommendation(cs.rating_band, cm.rating_band);
  const recClass = rec.includes('Reject') || rec.includes('Prohibited') ? 'badge-danger' : (rec.includes('Excellent') || rec.includes('Good')) ? 'badge-success' : 'badge-warning';
  el.innerHTML   = `Gate 1 matrix recommendation: <span class="badge ${recClass}">${esc(rec)}</span>`;
}

function s2_renderComplianceUpdateForm() {
  const groups = OnboardingWorkflow.COMPLIANCE_FACTOR_GROUPS_BY_TYPE[contact.supplier_type] || Object.keys(OnboardingWorkflow.COMPLIANCE_FACTORS);
  const factors = OnboardingWorkflow.COMPLIANCE_FACTORS;
  const existingKeys = new Set((s2_gate1ComplianceScore?.components || []).map(c => c.factor_key));
  if (s2_gate1ComplianceScore?.rating_band === 'Prohibited') existingKeys.add('sanctions_match');
  let html = '';
  for (const group of groups) {
    html += `<div style="margin-bottom:var(--space-4)"><div style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-muted);margin-bottom:var(--space-2)">${esc(COMPLIANCE_GROUP_LABELS[group] || group)}</div><div style="display:flex;flex-direction:column;gap:var(--space-2)">`;
    for (const factor of (factors[group] || [])) {
      const isChecked = existingKeys.has(factor.key);
      const pill = factor.autoReject ? `<span class="score-pill score-pill-danger">Hard reject</span>` : (() => { const cls = factor.score < 0 ? 'score-pill score-pill-positive' : factor.score > 0 ? 'score-pill score-pill-risk' : 'score-pill score-pill-neutral'; return `<span class="${cls}">${factor.score > 0 ? '+' : ''}${factor.score}</span>`; })();
      html += `<label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer;font-size:var(--text-sm)"><input type="checkbox" class="s2-compliance-factor-check" data-key="${esc(factor.key)}" style="accent-color:var(--color-accent)" ${isChecked ? 'checked' : ''} onchange="s2_updateComplianceLiveScore()" /><span style="flex:1">${esc(factor.label)}</span>${pill}</label>`;
    }
    html += `</div></div>`;
  }
  document.getElementById('s2-compliance-factors-container').innerHTML = html;
}

function s2_updateComplianceLiveScore() {
  const keys   = Array.from(document.querySelectorAll('.s2-compliance-factor-check:checked')).map(c => c.dataset.key);
  const result = OnboardingWorkflow.computeComplianceScore(keys, contact.supplier_type);
  const totalEl = document.getElementById('s2-compliance-total');
  const bandEl  = document.getElementById('s2-compliance-band-badge');
  if (totalEl) totalEl.textContent = result.prohibited ? '—' : (result.total ?? 0);
  if (bandEl) { const cls = result.band === 'Low Risk' ? 'badge-success' : result.band === 'Medium Risk' ? 'badge-warning' : 'badge-danger'; bandEl.innerHTML = `<span class="badge ${cls}">${esc(result.band)}</span>`; }
}

function s2_renderCommercialUpdateForm() {
  const factors = OnboardingWorkflow.COMMERCIAL_FACTORS;
  const existingKeys = new Set((s2_gate1CommercialScore?.components || []).map(c => c.factor_key));
  let html = '';
  for (const [group, flist] of Object.entries(factors)) {
    html += `<div style="margin-bottom:var(--space-4)"><div style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-muted);margin-bottom:var(--space-2)">${esc(COMMERCIAL_GROUP_LABELS[group] || group)}</div><div style="display:flex;flex-direction:column;gap:var(--space-2)">`;
    for (const factor of flist) {
      html += `<label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer;font-size:var(--text-sm)"><input type="radio" class="s2-commercial-factor-radio" name="s2-commercial-${esc(group)}" value="${esc(factor.key)}" style="accent-color:var(--color-accent)" ${existingKeys.has(factor.key) ? 'checked' : ''} onchange="s2_updateCommercialLiveScore()" /><span style="flex:1">${esc(factor.label)}</span><span class="score-pill score-pill-positive">+${factor.score}</span></label>`;
    }
    html += `</div></div>`;
  }
  document.getElementById('s2-commercial-factors-container').innerHTML = html;
}

function s2_updateCommercialLiveScore() {
  const keys   = Array.from(document.querySelectorAll('.s2-commercial-factor-radio:checked')).map(r => r.value);
  const result = OnboardingWorkflow.computeCommercialScore(keys);
  const totalEl = document.getElementById('s2-commercial-total');
  const bandEl  = document.getElementById('s2-commercial-band-badge');
  if (totalEl) totalEl.textContent = result.total ?? 0;
  if (bandEl) { const cls = (result.band === 'Strategic Supplier' || result.band === 'Strong Fit') ? 'badge-success' : result.band === 'Moderate Fit' ? 'badge-warning' : 'badge-neutral'; bandEl.innerHTML = `<span class="badge ${cls}">${esc(result.band)}</span>`; }
}

function s2_renderGate2SignoffPanel() {
  const compRow = s2_gate2Approvals['gate2_compliance'];
  const commRow = s2_gate2Approvals['gate2_commercial'];
  document.getElementById('s2-gate2-compliance-section').innerHTML = compRow
    ? s2_buildGate2ApprovalReadOnly(compRow, 'Compliance Director (Martyn)')
    : s2_buildGate2ApprovalForm('compliance', 'Compliance Director (Martyn)', [
        { value: 'approve', label: 'Approve' },
        { value: 'approve_with_conditions', label: 'Approve with Conditions' },
        { value: 'reject', label: 'Reject' },
      ]);
  document.getElementById('s2-gate2-commercial-section').innerHTML = commRow
    ? s2_buildGate2ApprovalReadOnly(commRow, 'Commercial Director (Jackson)')
    : s2_buildGate2ApprovalForm('commercial', 'Commercial Director (Jackson)', [
        { value: 'approve', label: 'Approve' },
        { value: 'reject',  label: 'Reject' },
      ]);
}

function s2_buildGate2ApprovalReadOnly(row, label) {
  const decClass = row.decision === 'reject' ? 'badge-danger' : row.decision === 'approve_with_conditions' ? 'badge-warning' : 'badge-success';
  return `
    <div style="padding:var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-sm)">
      <div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-2)">${esc(label)}</div>
      <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-bottom:${row.justification ? 'var(--space-2)' : '0'}">
        <span class="badge ${decClass}">${esc(row.decision.replace(/_/g,' '))}</span>
        <span style="font-size:var(--text-xs);color:var(--color-text-muted)">${fmtDate(row.decided_at)}</span>
      </div>
      ${row.justification ? `<p style="font-size:var(--text-sm);margin:0">${esc(row.justification)}</p>` : ''}
      ${row.conditions ? `<p style="font-size:var(--text-xs);color:var(--color-text-muted);white-space:pre-line;margin:var(--space-1) 0 0">${esc(row.conditions)}</p>` : ''}
    </div>`;
}

function s2_buildGate2ApprovalForm(role, label, options) {
  return `
    <div style="padding:var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-sm)">
      <div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-3)">${esc(label)}</div>
      <div class="form-group">
        <label class="form-label" for="s2-gate2-${esc(role)}-decision">Decision <span class="required">*</span></label>
        <select class="form-select" id="s2-gate2-${esc(role)}-decision" onchange="s2_toggleGate2ConditionsField('${esc(role)}')">
          <option value="">Select…</option>
          ${options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="s2-gate2-${esc(role)}-justification">Justification <span class="required">*</span></label>
        <textarea class="form-textarea" id="s2-gate2-${esc(role)}-justification" rows="3" placeholder="Summarise your assessment and the basis for your decision…"></textarea>
      </div>
      <div class="form-group" id="s2-gate2-${esc(role)}-conditions-group" style="display:none">
        <label class="form-label" for="s2-gate2-${esc(role)}-conditions">Conditions (one per line) <span class="required">*</span></label>
        <textarea class="form-textarea" id="s2-gate2-${esc(role)}-conditions" rows="3" placeholder="List any conditions that must be satisfied before trading begins…"></textarea>
      </div>
    </div>`;
}

function s2_toggleGate2ConditionsField(role) {
  const dec = document.getElementById(`s2-gate2-${role}-decision`)?.value;
  const grp = document.getElementById(`s2-gate2-${role}-conditions-group`);
  if (grp) grp.style.display = dec === 'approve_with_conditions' ? 'block' : 'none';
}

function s2_loadEsg() {
  document.getElementById('s2-esg-policy').checked         = !!contact.esg_policy_in_place;
  document.getElementById('s2-esg-carbon-reporting').checked = !!contact.carbon_reporting_available;
  if (contact.esg_notes)                   document.getElementById('s2-esg-notes').value         = contact.esg_notes;
  if (contact.environmental_permit_ref)    document.getElementById('s2-esg-permit-ref').value    = contact.environmental_permit_ref;
  if (contact.environmental_permit_expiry) document.getElementById('s2-esg-permit-expiry').value = contact.environmental_permit_expiry;
}

async function s2_submitEsg() {
  const btn      = document.getElementById('s2-esg-save-btn');
  const statusEl = document.getElementById('s2-esg-status');
  btn.disabled = true; btn.textContent = 'Saving…';
  const payload = {
    esg_policy_in_place:         document.getElementById('s2-esg-policy').checked,
    carbon_reporting_available:  document.getElementById('s2-esg-carbon-reporting').checked,
    esg_notes:                   document.getElementById('s2-esg-notes').value.trim() || null,
    environmental_permit_ref:    document.getElementById('s2-esg-permit-ref').value.trim() || null,
    environmental_permit_expiry: document.getElementById('s2-esg-permit-expiry').value || null,
  };
  const { error } = await supabaseClient.from('contacts').update(payload).eq('id', contact.id);
  if (error) { statusEl.style.color = 'var(--color-danger)'; statusEl.textContent = error.message; }
  else { Object.assign(contact, payload); statusEl.style.color = 'var(--color-success)'; statusEl.textContent = 'Saved.'; setTimeout(() => { statusEl.textContent = ''; }, 3000); }
  btn.disabled = false; btn.textContent = 'Save ESG Details';
}

function s2_maskAccountNumber(v) {
  if (!v) return '—';
  const clean = v.replace(/\s+/g, '');
  return clean.length <= 4 ? clean : '**** '.repeat(Math.floor((clean.length - 4) / 4)) + clean.slice(-4);
}

function s2_renderBankSection() {
  const el      = document.getElementById('s2-bank-section');
  const badgeEl = document.getElementById('s2-bank-status-badge');
  const hasBank = contact.bank_account_number || contact.bank_iban;
  if (hasBank && !s2_bankEditMode) {
    badgeEl.innerHTML = contact.bank_account_verified_in_name ? '<span class="badge badge-success">On file, verified</span>' : '<span class="badge badge-warning">On file, unverified</span>';
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--space-4);font-size:var(--text-sm)">
        <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Account Name</div>${esc(contact.bank_account_name || '—')}</div>
        <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Bank Name</div>${esc(contact.bank_name || '—')}</div>
        <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Account Number</div><span id="s2-bank-acct-display" data-revealed="0">${esc(s2_maskAccountNumber(contact.bank_account_number))}</span>${contact.bank_account_number ? `<button type="button" class="btn btn-ghost btn-sm" id="s2-bank-acct-toggle" style="border:none;padding:0 0 0 4px">Show</button>` : ''}</div>
        <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">IBAN</div><span id="s2-bank-iban-display" data-revealed="0">${esc(s2_maskAccountNumber(contact.bank_iban))}</span>${contact.bank_iban ? `<button type="button" class="btn btn-ghost btn-sm" id="s2-bank-iban-toggle" style="border:none;padding:0 0 0 4px">Show</button>` : ''}</div>
        <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Sort Code / Routing</div>${esc(contact.bank_sort_code || '—')}</div>
        <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">SWIFT / BIC</div>${esc(contact.bank_swift_bic || '—')}</div>
      </div>
      <div style="margin-top:var(--space-4);font-size:var(--text-sm)">${contact.bank_account_verified_in_name ? '<span style="color:var(--color-success)">✓ Confirmed held in registered company name</span>' : '<span style="color:var(--color-danger)">Not yet confirmed as held in registered company name</span>'}</div>
      <div style="margin-top:var(--space-4)"><button type="button" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)" id="s2-bank-edit-btn">Edit Bank Details</button></div>`;
    document.getElementById('s2-bank-edit-btn')?.addEventListener('click', () => { s2_bankEditMode = true; s2_renderBankSection(); });
    document.getElementById('s2-bank-acct-toggle')?.addEventListener('click', e => {
      const span = document.getElementById('s2-bank-acct-display'); const rev = span.dataset.revealed === '1';
      span.textContent = rev ? s2_maskAccountNumber(contact.bank_account_number) : contact.bank_account_number;
      span.dataset.revealed = rev ? '0' : '1'; e.target.textContent = rev ? 'Show' : 'Hide';
    });
    document.getElementById('s2-bank-iban-toggle')?.addEventListener('click', e => {
      const span = document.getElementById('s2-bank-iban-display'); const rev = span.dataset.revealed === '1';
      span.textContent = rev ? s2_maskAccountNumber(contact.bank_iban) : contact.bank_iban;
      span.dataset.revealed = rev ? '0' : '1'; e.target.textContent = rev ? 'Show' : 'Hide';
    });
    return;
  }
  badgeEl.innerHTML = '<span class="badge badge-danger">Required</span>';
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-4)">
      <div class="form-grid">
        <div class="form-group"><label class="form-label" for="s2-bank-account-name">Account Name</label><input type="text" class="form-input" id="s2-bank-account-name" value="${esc(contact.bank_account_name || '')}" /></div>
        <div class="form-group"><label class="form-label" for="s2-bank-name">Bank Name</label><input type="text" class="form-input" id="s2-bank-name" value="${esc(contact.bank_name || '')}" /></div>
        <div class="form-group"><label class="form-label" for="s2-bank-account-number">Account Number</label><input type="text" class="form-input" id="s2-bank-account-number" value="${esc(contact.bank_account_number || '')}" /></div>
        <div class="form-group"><label class="form-label" for="s2-bank-sort-code">Sort Code / Routing Number</label><input type="text" class="form-input" id="s2-bank-sort-code" value="${esc(contact.bank_sort_code || '')}" /></div>
        <div class="form-group"><label class="form-label" for="s2-bank-iban">IBAN</label><input type="text" class="form-input" id="s2-bank-iban" value="${esc(contact.bank_iban || '')}" /></div>
        <div class="form-group"><label class="form-label" for="s2-bank-swift-bic">SWIFT / BIC</label><input type="text" class="form-input" id="s2-bank-swift-bic" value="${esc(contact.bank_swift_bic || '')}" /></div>
      </div>
      <label style="display:flex;gap:var(--space-2);align-items:center;cursor:pointer;font-size:var(--text-sm)">
        <input type="checkbox" id="s2-bank-verified" style="accent-color:var(--color-accent)" ${contact.bank_account_verified_in_name ? 'checked' : ''} />
        I confirm this bank account is held in the exact name of the registered company above.
      </label>
      <div id="s2-bank-status" style="font-size:var(--text-sm)"></div>
      <div style="display:flex;gap:var(--space-3)">
        <button type="button" class="btn btn-primary btn-sm" id="s2-bank-save-btn">Save Bank Details</button>
        ${hasBank ? '<button type="button" class="btn btn-ghost btn-sm" id="s2-bank-cancel-btn">Cancel</button>' : ''}
      </div>
    </div>`;
  document.getElementById('s2-bank-save-btn')?.addEventListener('click', s2_submitBank);
  document.getElementById('s2-bank-cancel-btn')?.addEventListener('click', () => { s2_bankEditMode = false; s2_renderBankSection(); });
}

async function s2_submitBank() {
  const btn      = document.getElementById('s2-bank-save-btn');
  const statusEl = document.getElementById('s2-bank-status');
  const payload  = {
    bank_account_name:            document.getElementById('s2-bank-account-name').value.trim() || null,
    bank_name:                    document.getElementById('s2-bank-name').value.trim()          || null,
    bank_account_number:          document.getElementById('s2-bank-account-number').value.trim() || null,
    bank_sort_code:               document.getElementById('s2-bank-sort-code').value.trim()     || null,
    bank_iban:                    document.getElementById('s2-bank-iban').value.trim()           || null,
    bank_swift_bic:               document.getElementById('s2-bank-swift-bic').value.trim()     || null,
    bank_account_verified_in_name: document.getElementById('s2-bank-verified').checked,
  };
  if (!payload.bank_account_number && !payload.bank_iban) {
    statusEl.style.color = 'var(--color-danger)'; statusEl.textContent = 'Either an account number or IBAN is required.'; return;
  }
  btn.disabled = true; btn.textContent = 'Saving…';
  const { error } = await supabaseClient.from('contacts').update(payload).eq('id', contact.id);
  if (error) { statusEl.style.color = 'var(--color-danger)'; statusEl.textContent = error.message; btn.disabled = false; btn.textContent = 'Save Bank Details'; return; }
  Object.assign(contact, payload); s2_bankEditMode = false; s2_renderBankSection();
}

function s2_renderTobSection() {
  const badgeEl = document.getElementById('s2-tob-status-badge');
  const SC      = { not_generated:'badge-neutral', generated:'badge-info', sent:'badge-warning', confirmed:'badge-success' };
  badgeEl.innerHTML = `<span class="badge ${SC[onboarding.tob_status]||'badge-neutral'}">${esc(onboarding.tob_status?.replace('_',' '))}</span>`;
  document.getElementById('s2-tob-sent-btn').disabled      = onboarding.tob_status === 'not_generated';
  document.getElementById('s2-tob-confirmed-btn').disabled = !(onboarding.tob_status === 'sent' || onboarding.tob_status === 'confirmed');
  const parts = [];
  if (onboarding.tob_generated_at) parts.push(`Generated ${fmtDate(onboarding.tob_generated_at)}`);
  if (onboarding.tob_sent_at)      parts.push(`Sent ${fmtDate(onboarding.tob_sent_at)}`);
  if (onboarding.tob_confirmed_at) parts.push(`Confirmed ${fmtDate(onboarding.tob_confirmed_at)}`);
  document.getElementById('s2-tob-timestamps').textContent = parts.join(' · ');
}

async function s2_generateTob() {
  const html = OnboardingWorkflow.buildTobHtml(contact, onboarding);
  const win  = window.open('', '_blank'); win.document.write(html); win.document.close();
  if (onboarding.tob_status === 'not_generated') {
    const result = await OnboardingWorkflow.markTobGenerated(onboardingId, contact.id);
    if (result.ok) { onboarding.tob_status = 'generated'; onboarding.tob_generated_at = new Date().toISOString(); s2_renderTobSection(); }
  }
}

async function s2_markTobSent() {
  const result = await OnboardingWorkflow.markTobSent(onboardingId, contact.id);
  if (result.ok) { onboarding.tob_status = 'sent'; onboarding.tob_sent_at = new Date().toISOString(); s2_renderTobSection(); }
}

async function s2_markTobConfirmed() {
  const result = await OnboardingWorkflow.markTobConfirmed(onboardingId, contact.id);
  if (result.ok) { onboarding.tob_status = 'confirmed'; onboarding.tob_confirmed_at = new Date().toISOString(); s2_renderTobSection(); }
}

async function s2_submitSaveAndExit() {
  const errEl = document.getElementById('s2-error');
  errEl.style.display = 'none';
  const btn   = document.getElementById('s2-save-exit-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  const reason = prompt('Optional: note why Stage 2 is being paused. Leave blank to skip.');
  const { error } = await supabaseClient.from('supplier_onboarding')
    .update({ workflow_stage: 'awaiting_supplier_info', updated_at: new Date().toISOString() }).eq('id', onboardingId);
  if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; btn.disabled = false; btn.textContent = 'Save Progress & Exit'; return; }
  await OnboardingWorkflow.logEvent(contact.id, onboardingId, 'stage_advanced', `Stage 2 paused — awaiting supplier information.${reason ? ' ' + reason : ''}`, { to_stage: 'awaiting_supplier_info' });
  location.href = `detail.html?id=${contact.id}`;
}

async function s2_submitCompleteStage2() {
  const errEl = document.getElementById('s2-error');
  errEl.style.display = 'none';
  const missing = [];
  for (const role of ['compliance', 'commercial']) {
    if (s2_gate2Approvals[`gate2_${role}`]) continue;
    const dec  = document.getElementById(`s2-gate2-${role}-decision`)?.value;
    const just = (document.getElementById(`s2-gate2-${role}-justification`)?.value || '').trim();
    if (dec && !just) missing.push(`${role} director Gate 2 justification`);
    if (dec === 'approve_with_conditions') {
      const cond = (document.getElementById(`s2-gate2-${role}-conditions`)?.value || '').trim();
      if (!cond) missing.push(`${role} director Gate 2 conditions`);
    }
  }
  if (missing.length) { errEl.textContent = `Please complete: ${missing.join('; ')}.`; errEl.style.display = 'block'; window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

  const btn = document.getElementById('s2-complete-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const user = await getCurrentUser();
    const scoresFormEl = document.getElementById('s2-scores-update-form');
    if (scoresFormEl && scoresFormEl.style.display !== 'none') {
      const compKeys = Array.from(document.querySelectorAll('.s2-compliance-factor-check:checked')).map(c => c.dataset.key);
      if (compKeys.length > 0) {
        const compResult = OnboardingWorkflow.computeComplianceScore(compKeys, contact.supplier_type);
        await supabaseClient.from('supplier_compliance_scores').insert({
          supplier_id: contact.id, onboarding_id: onboardingId, gate: 2,
          total_score: compResult.prohibited ? 0 : compResult.total, rating_band: compResult.band, components: compResult.components, computed_by: user?.id || null,
        });
        if (!compResult.prohibited) {
          const leg = compResult.band === 'Low Risk' ? 'low' : compResult.band === 'Medium Risk' ? 'medium' : 'high';
          await supabaseClient.from('supplier_onboarding').update({ risk_level: leg, updated_at: new Date().toISOString() }).eq('id', onboardingId);
        }
      }
      const commKeys = Array.from(document.querySelectorAll('.s2-commercial-factor-radio:checked')).map(r => r.value);
      if (commKeys.length > 0) {
        const commResult = OnboardingWorkflow.computeCommercialScore(commKeys);
        await supabaseClient.from('supplier_commercial_scores').insert({
          supplier_id: contact.id, onboarding_id: onboardingId, gate: 2,
          total_score: commResult.total, rating_band: commResult.band, components: commResult.components, computed_by: user?.id || null,
        });
      }
    }
    for (const role of ['compliance', 'commercial']) {
      if (s2_gate2Approvals[`gate2_${role}`]) continue;
      const decision      = document.getElementById(`s2-gate2-${role}-decision`)?.value;
      if (!decision) continue;
      const justification = (document.getElementById(`s2-gate2-${role}-justification`)?.value || '').trim();
      const conditions    = (document.getElementById(`s2-gate2-${role}-conditions`)?.value    || '').trim() || null;
      await supabaseClient.from('supplier_approvals').insert({
        supplier_id: contact.id, onboarding_id: onboardingId, approval_stage: `gate2_${role}`,
        approver_id: user?.id, approver_role: role === 'compliance' ? 'director_compliance' : 'director_commercial',
        decision, justification, conditions: decision === 'approve_with_conditions' ? conditions : null, decided_at: new Date().toISOString(),
      });
      s2_gate2Approvals[`gate2_${role}`] = { decision, justification, decided_at: new Date().toISOString() };
    }
    const result = await OnboardingWorkflow.advanceStage(onboardingId, 'stage2_complete');
    if (!result.ok) {
      errEl.innerHTML = '<strong>Cannot complete Stage 2 yet:</strong>' + OnboardingWorkflow.renderBlockers(result.blockers);
      errEl.style.display = 'block'; btn.disabled = false; btn.textContent = 'Complete Stage 2 →';
      window.scrollTo({ top: 0, behavior: 'smooth' }); s2_renderGate2SignoffPanel(); return;
    }
    location.href = `detail.html?id=${contact.id}`;
  } catch (err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Complete Stage 2 →';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

async function s2_renderForm() {
  s2_isFullDiligence = OnboardingWorkflow.requiresFullDiligence(contact.supplier_type);

  if (onboarding.workflow_stage === 'stage1_complete') {
    const adv = await OnboardingWorkflow.advanceStage(onboardingId, 'pending_stage2');
    if (adv.ok) onboarding.workflow_stage = 'pending_stage2';
  }

  const prereqItems = OnboardingWorkflow.buildStage2Prerequisites(contact.supplier_type);
  const awaitingBanner = onboarding.workflow_stage === 'awaiting_supplier_info' ? `
    <div style="margin-bottom:var(--space-5);padding:var(--space-4) var(--space-5);background:rgba(217,119,6,0.08);border:1px solid rgba(217,119,6,0.25);border-radius:var(--radius);font-size:var(--text-sm)">
      <strong>Stage 2 is paused — awaiting supplier information.</strong>
      <button type="button" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border);margin-left:var(--space-3)" id="s2-resume-btn">Resume Vetting</button>
    </div>` : '';

  document.getElementById('acc-s2-body').innerHTML = `
    ${prereqItems.length ? `<div style="margin-bottom:var(--space-5);padding:var(--space-4) var(--space-5);background:rgba(122,184,212,0.08);border:1px solid rgba(122,184,212,0.25);border-radius:var(--radius);font-size:var(--text-sm)">
      <strong style="display:block;margin-bottom:var(--space-2)">Before you begin — Stage 2 needs:</strong>
      <ul style="margin:0;padding-left:var(--space-5);display:flex;flex-direction:column;gap:var(--space-1)">${prereqItems.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
    </div>` : ''}
    ${awaitingBanner}

    <div class="panel" id="s2-sanctions-review-panel" style="margin-bottom:var(--space-5);${s2_isFullDiligence ? '' : 'display:none'}">
      <div class="panel-header"><h3>Sanctions Screening Review</h3><span id="s2-sanctions-review-badge"></span></div>
      <div class="panel-body"><div id="s2-sanctions-review-section"><div style="color:var(--color-text-muted)">Loading…</div></div></div>
    </div>

    <div class="panel" style="margin-bottom:var(--space-5)">
      <div class="panel-header"><h3>Compliance &amp; Commercial Scores</h3></div>
      <div class="panel-body" style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div id="s2-scores-summary-cards"><div style="color:var(--color-text-muted)">Loading…</div></div>
        <div id="s2-scores-update-toggle" style="display:none">
          <button type="button" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)" id="s2-toggle-score-update-btn">Update Scores for Gate 2</button>
        </div>
        <div id="s2-scores-update-form" style="display:none">
          <hr style="border:none;border-top:1px solid var(--color-border);margin:var(--space-2) 0 var(--space-4)" />
          <div style="font-weight:600;font-size:var(--text-sm);margin-bottom:var(--space-3)">Update Compliance Risk Score (Gate 2)</div>
          <div id="s2-compliance-factors-container"></div>
          <div class="overall-score-box" style="margin-bottom:var(--space-5)">
            <div style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:var(--space-2)">Total Compliance Risk Score</div>
            <div style="font-size:var(--text-4xl);font-weight:700;color:#fff;margin-bottom:var(--space-2)" id="s2-compliance-total">0</div>
            <div id="s2-compliance-band-badge"></div>
            <div style="font-size:var(--text-xs);color:rgba(255,255,255,0.4);margin-top:var(--space-2)">≤20 = Low Risk · 21–40 = Medium · 41–60 = High · >60 = Very High</div>
          </div>
          <div style="font-weight:600;font-size:var(--text-sm);margin-bottom:var(--space-3)">Update Commercial Suitability Score (Gate 2)</div>
          <div id="s2-commercial-factors-container"></div>
          <div class="overall-score-box">
            <div style="font-family:var(--font-display);font-size:var(--text-xs);font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:var(--space-2)">Total Commercial Score</div>
            <div style="font-size:var(--text-4xl);font-weight:700;color:#fff;margin-bottom:var(--space-2)" id="s2-commercial-total">0</div>
            <div id="s2-commercial-band-badge"></div>
            <div style="font-size:var(--text-xs);color:rgba(255,255,255,0.4);margin-top:var(--space-2)">≤30 = Poor Fit · 31–60 = Moderate Fit · 61–80 = Strong Fit · >80 = Strategic</div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:var(--space-5)">
      <div class="panel-header"><h3>ESG &amp; Environmental</h3></div>
      <div class="panel-body" style="display:flex;flex-direction:column;gap:var(--space-4)">
        <label style="display:flex;gap:var(--space-2);align-items:center;cursor:pointer;font-size:var(--text-sm)"><input type="checkbox" id="s2-esg-policy" style="accent-color:var(--color-accent)" /> Supplier has a documented ESG / sustainability policy</label>
        <label style="display:flex;gap:var(--space-2);align-items:center;cursor:pointer;font-size:var(--text-sm)"><input type="checkbox" id="s2-esg-carbon-reporting" style="accent-color:var(--color-accent)" /> Carbon reporting data available (e.g. for CBAM purposes)</label>
        <div class="form-grid">
          <div class="form-group"><label class="form-label" for="s2-esg-permit-ref">Environmental Permit Reference</label><input type="text" class="form-input" id="s2-esg-permit-ref" placeholder="Permit / licence number, if applicable" /></div>
          <div class="form-group"><label class="form-label" for="s2-esg-permit-expiry">Environmental Permit Expiry</label><input type="date" class="form-input" id="s2-esg-permit-expiry" /></div>
        </div>
        <div class="form-group"><label class="form-label" for="s2-esg-notes">ESG Notes</label><textarea class="form-textarea" id="s2-esg-notes" rows="3" placeholder="Any relevant ESG context — certifications, audits, sustainability commitments…"></textarea></div>
        <div id="s2-esg-status" style="font-size:var(--text-sm)"></div>
        <div><button type="button" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)" id="s2-esg-save-btn">Save ESG Details</button></div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:var(--space-5)">
      <div class="panel-header"><h3>Bank Details</h3><span id="s2-bank-status-badge"></span></div>
      <div class="panel-body" id="s2-bank-section"><div style="color:var(--color-text-muted)">Loading…</div></div>
    </div>

    <div class="panel" style="margin-bottom:var(--space-5)">
      <div class="panel-header"><h3>Terms of Business</h3><span id="s2-tob-status-badge"></span></div>
      <div class="panel-body" style="display:flex;flex-direction:column;gap:var(--space-4)">
        <p style="font-size:var(--text-sm);color:var(--color-text-muted)">Generate the Terms of Business document, send it to the supplier, and confirm their agreement before Stage 2 can be completed.</p>
        <div style="display:flex;gap:var(--space-3);flex-wrap:wrap">
          <button type="button" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)" id="s2-tob-generate-btn">Generate / Preview TOB</button>
          <button type="button" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)" id="s2-tob-sent-btn" disabled>Mark as Sent to Supplier</button>
          <button type="button" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)" id="s2-tob-confirmed-btn" disabled>Mark Agreement Confirmed</button>
        </div>
        <div id="s2-tob-timestamps" style="font-size:var(--text-xs);color:var(--color-text-muted)"></div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:var(--space-5)">
      <div class="panel-header"><h3>Gate 2 — Director Sign-off</h3></div>
      <div class="panel-body" style="display:flex;flex-direction:column;gap:var(--space-4)">
        <p style="font-size:var(--text-sm);color:var(--color-text-muted)">Both directors must approve at Gate 2 before Stage 2 can be completed.</p>
        <div id="s2-gate2-matrix-rec" style="padding:var(--space-3);background:var(--color-surface);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--color-text-muted)">Loading scores…</div>
        <div id="s2-gate2-compliance-section"></div>
        <div id="s2-gate2-commercial-section"></div>
      </div>
    </div>

    <div id="s2-error" style="display:none;margin-bottom:var(--space-4);padding:var(--space-3) var(--space-4);background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.2);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--color-danger)"></div>
    <div style="display:flex;gap:var(--space-3);justify-content:flex-end;margin-bottom:var(--space-6)">
      <a href="detail.html?id=${esc(supplierId)}" class="btn btn-ghost">Cancel</a>
      <button type="button" class="btn btn-ghost" id="s2-save-exit-btn">Save Progress &amp; Exit</button>
      <button type="button" class="btn btn-primary" id="s2-complete-btn">Complete Stage 2 →</button>
    </div>`;

  document.getElementById('s2-resume-btn')?.addEventListener('click', async () => {
    const result = await OnboardingWorkflow.resumeFromAwaitingInfo(onboardingId);
    if (result.ok) { onboarding.workflow_stage = 'pending_stage2'; document.querySelector('#s2-resume-btn')?.closest('div')?.remove(); }
  });
  document.getElementById('s2-esg-save-btn').addEventListener('click', s2_submitEsg);
  document.getElementById('s2-tob-generate-btn').addEventListener('click', s2_generateTob);
  document.getElementById('s2-tob-sent-btn').addEventListener('click', s2_markTobSent);
  document.getElementById('s2-tob-confirmed-btn').addEventListener('click', s2_markTobConfirmed);
  document.getElementById('s2-save-exit-btn').addEventListener('click', s2_submitSaveAndExit);
  document.getElementById('s2-complete-btn').addEventListener('click', s2_submitCompleteStage2);

  if (s2_isFullDiligence) await s2_loadSanctionsReview();
  await s2_loadScoresPanel();
  s2_loadEsg();
  s2_renderBankSection();
  s2_renderTobSection();

  const tobStatus = onboarding.tob_status === 'confirmed' ? 'TOB confirmed' : onboarding.tob_status === 'sent' ? 'TOB sent' : 'TOB pending';
  const subEl = document.getElementById('acc-s2-sub');
  if (subEl) subEl.textContent = tobStatus;
}

// ═══════════════════════════════════════════════════════════
// STAGE 3 — TRADE READY SIGN-OFF
// ═══════════════════════════════════════════════════════════

let s3_dpaOnFile = false;

function s3_renderCurrencies() {
  const el = document.getElementById('s3-currencies');
  el.innerHTML = CURRENCIES.map(c => `
    <label class="currency-chip">
      <input type="checkbox" class="s3-currency-check" value="${c}" style="accent-color:var(--color-accent)" ${contact.accepted_currencies?.includes(c) ? 'checked' : ''} /> ${c}
    </label>`).join('');
  el.querySelectorAll('.s3-currency-check').forEach(cb => cb.addEventListener('change', s3_updateDefaultCurrencyOptions));
  s3_updateDefaultCurrencyOptions();
}

function s3_updateDefaultCurrencyOptions() {
  const checked  = Array.from(document.querySelectorAll('.s3-currency-check:checked')).map(cb => cb.value);
  const sel      = document.getElementById('s3-default-currency');
  const current  = sel.value || contact.default_currency || '';
  sel.innerHTML  = checked.length
    ? checked.map(c => `<option value="${c}">${c}</option>`).join('')
    : '<option value="">Select an accepted currency first…</option>';
  if (checked.includes(current)) sel.value = current;
}

function s3_loadCommercialTerms() {
  if (contact.payment_terms_initial)    document.getElementById('s3-payment-initial').value    = contact.payment_terms_initial;
  if (contact.payment_terms_subsequent) document.getElementById('s3-payment-subsequent').value = contact.payment_terms_subsequent;
  if (contact.standard_incoterm)        document.getElementById('s3-incoterm').value           = contact.standard_incoterm;
}

async function s3_submitCommercialTerms() {
  const btn      = document.getElementById('s3-commercial-save-btn');
  const statusEl = document.getElementById('s3-commercial-status');
  btn.disabled = true; btn.textContent = 'Saving…';
  const accepted = Array.from(document.querySelectorAll('.s3-currency-check:checked')).map(cb => cb.value);
  const payload  = {
    accepted_currencies:      accepted.length ? accepted : null,
    default_currency:         document.getElementById('s3-default-currency').value || null,
    payment_terms_initial:    document.getElementById('s3-payment-initial').value.trim() || null,
    payment_terms_subsequent: document.getElementById('s3-payment-subsequent').value.trim() || null,
    standard_incoterm:        document.getElementById('s3-incoterm').value || null,
  };
  const { error } = await supabaseClient.from('contacts').update(payload).eq('id', contact.id);
  if (error) {
    statusEl.style.color = 'var(--color-danger)'; statusEl.textContent = error.message;
  } else {
    Object.assign(contact, payload);
    statusEl.style.color = 'var(--color-success)'; statusEl.textContent = 'Saved.';
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
    s3_renderSignoff();
  }
  btn.disabled = false; btn.textContent = 'Save Commercial Terms';
}

async function s3_loadDpa() {
  const { data } = await supabaseClient.from('supplier_documents').select('*')
    .eq('onboarding_id', onboardingId).eq('document_type', 'dpa').order('uploaded_at', { ascending: false });
  const latest   = data?.[0] || null;
  s3_dpaOnFile   = !!data?.some(d => d.is_current);
  s3_renderDpaSection(latest);
}

function s3_renderDpaSection(latest) {
  const badgeEl  = document.getElementById('s3-dpa-status-badge');
  const el       = document.getElementById('s3-dpa-section');
  const docsLink = `documents.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(onboardingId)}`;
  badgeEl.innerHTML = s3_dpaOnFile
    ? '<span class="badge badge-success">On file</span>'
    : '<span class="badge badge-danger">Required</span>';
  if (!latest) {
    el.innerHTML = `
      <div class="check-item" style="background:rgba(220,38,38,0.04)">
        ${failIcon()}
        <div style="flex:1">
          <p style="font-size:var(--text-sm);margin:0">No Data Processing Agreement has been uploaded for this supplier.</p>
          <a href="${docsLink}" class="btn btn-ghost btn-sm" style="margin-top:var(--space-3);border:1px solid var(--color-border)">Upload DPA →</a>
        </div>
      </div>`;
    return;
  }
  el.innerHTML = `
    <div class="check-item" style="background:${s3_dpaOnFile ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)'}">
      ${s3_dpaOnFile ? passIcon() : failIcon()}
      <div style="flex:1">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-3);font-size:var(--text-sm)">
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">File</div>${esc(latest.file_name || '—')}</div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Uploaded</div>${fmtDate(latest.uploaded_at)}</div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Expiry</div>${fmtDate(latest.expiry_date)}</div>
          <div><div style="color:var(--color-text-muted);font-size:var(--text-xs)">Status</div>${latest.is_current ? '<span class="badge badge-success">Current</span>' : '<span class="badge badge-neutral">Superseded</span>'}</div>
        </div>
      </div>
    </div>
    <div style="margin-top:var(--space-4)">
      <a href="${docsLink}" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)">${s3_dpaOnFile ? 'Manage Documents →' : 'Upload DPA →'}</a>
    </div>`;
}

function s3_renderSignoff() {
  const items = [
    { ok: onboarding.workflow_stage === 'stage2_complete', label: 'Stage 2 must be complete before final sign-off' },
    { ok: !!contact.accepted_currencies?.length,           label: 'At least one accepted currency selected' },
    { ok: !!contact.default_currency,                      label: 'A default currency selected' },
    { ok: !!contact.payment_terms_initial?.trim(),         label: 'Initial payment terms recorded' },
    { ok: !!contact.payment_terms_subsequent?.trim(),      label: 'Subsequent payment terms recorded' },
    { ok: !!contact.standard_incoterm,                     label: 'A standard incoterm selected' },
    { ok: s3_dpaOnFile,                                    label: 'A current Data Processing Agreement (DPA) is on file' },
  ];
  document.getElementById('s3-signoff-checklist').innerHTML = items.map(item => `
    <div class="check-item" style="background:${item.ok ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)'}">
      ${item.ok ? passIcon() : failIcon()}
      <div style="flex:1;font-size:var(--text-sm);padding-top:2px">${esc(item.label)}</div>
    </div>`).join('');
  document.getElementById('s3-trade-ready-btn').disabled = !items.every(i => i.ok);
}

async function s3_submitMarkTradeReady() {
  const errEl = document.getElementById('s3-error');
  errEl.style.display = 'none';
  const btn   = document.getElementById('s3-trade-ready-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  const result = await OnboardingWorkflow.advanceStage(onboardingId, 'trade_ready');
  if (!result.ok) {
    errEl.innerHTML = '<strong>Cannot mark Trade Ready yet:</strong>' + OnboardingWorkflow.renderBlockers(result.blockers);
    errEl.style.display = 'block'; btn.disabled = false; btn.textContent = 'Mark Trade Ready →';
    window.scrollTo({ top: 0, behavior: 'smooth' }); return;
  }
  location.href = `detail.html?id=${contact.id}`;
}

async function s3_renderForm() {
  document.getElementById('acc-s3-body').innerHTML = `
    <div class="panel" style="margin-bottom:var(--space-5)">
      <div class="panel-header"><h3>Commercial Terms</h3></div>
      <div class="panel-body" style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div class="form-group">
          <label class="form-label">Accepted Currencies</label>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)" id="s3-currencies"></div>
        </div>
        <div class="form-grid">
          <div class="form-group"><label class="form-label" for="s3-default-currency">Default Currency</label><select class="form-select" id="s3-default-currency"><option value="">Select…</option></select></div>
          <div class="form-group"><label class="form-label" for="s3-payment-initial">Initial Payment Terms</label><input type="text" class="form-input" id="s3-payment-initial" placeholder="e.g. 50% in advance, 50% on shipment" /></div>
          <div class="form-group"><label class="form-label" for="s3-payment-subsequent">Subsequent Payment Terms</label><input type="text" class="form-input" id="s3-payment-subsequent" placeholder="e.g. 30 days net" /></div>
          <div class="form-group">
            <label class="form-label" for="s3-incoterm">Standard Incoterm</label>
            <select class="form-select" id="s3-incoterm">
              <option value="">Select…</option>
              <option value="EXW">EXW</option><option value="FCA">FCA</option><option value="CPT">CPT</option><option value="CIP">CIP</option>
              <option value="DAP">DAP</option><option value="DPU">DPU</option><option value="DDP">DDP</option>
              <option value="FAS">FAS</option><option value="FOB">FOB</option><option value="CFR">CFR</option><option value="CIF">CIF</option>
            </select>
          </div>
        </div>
        <div id="s3-commercial-status" style="font-size:var(--text-sm)"></div>
        <div><button type="button" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)" id="s3-commercial-save-btn">Save Commercial Terms</button></div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:var(--space-5)">
      <div class="panel-header"><h3>Data Processing Agreement</h3><span id="s3-dpa-status-badge"></span></div>
      <div class="panel-body" id="s3-dpa-section"><div style="color:var(--color-text-muted)">Loading…</div></div>
    </div>

    <div class="panel" style="margin-bottom:var(--space-5)">
      <div class="panel-header"><h3>Final Sign-off Checklist</h3></div>
      <div class="panel-body" style="display:flex;flex-direction:column;gap:var(--space-2)"><div id="s3-signoff-checklist"></div></div>
    </div>

    <div id="s3-error" style="display:none;margin-bottom:var(--space-4);padding:var(--space-3) var(--space-4);background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.2);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--color-danger)"></div>
    <div style="display:flex;gap:var(--space-3);justify-content:flex-end;margin-bottom:var(--space-6)">
      <a href="detail.html?id=${esc(supplierId)}" class="btn btn-ghost">Cancel</a>
      <button type="button" class="btn btn-primary" id="s3-trade-ready-btn" disabled>Mark Trade Ready →</button>
    </div>`;

  document.getElementById('s3-commercial-save-btn').addEventListener('click', s3_submitCommercialTerms);
  document.getElementById('s3-trade-ready-btn').addEventListener('click', s3_submitMarkTradeReady);

  s3_renderCurrencies();
  s3_loadCommercialTerms();
  await s3_loadDpa();
  s3_renderSignoff();

  const subEl = document.getElementById('acc-s3-sub');
  if (subEl) subEl.textContent = 'Commercial terms, DPA & final sign-off';
}

// ═══════════════════════════════════════════════════════════
// ACCORDION CONTROL
// ═══════════════════════════════════════════════════════════

const STAGE_ORDER = ['s1a', 's1b', 's2', 's3'];

const CHECK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
const LOCK_SVG  = '<svg width="11" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

function getActiveStage(workflowStage) {
  if (!workflowStage || workflowStage === 'draft')                                                          return 's1a';
  if (workflowStage === 'pending_compliance')                                                               return 's1b';
  if (['stage1_complete', 'pending_stage2', 'awaiting_supplier_info'].includes(workflowStage))              return 's2';
  if (workflowStage === 'stage2_complete')                                                                   return 's3';
  return null;
}

function accToggle(stageId) {
  const s = document.getElementById('acc-' + stageId);
  if (!s || s.classList.contains('acc-locked')) return;
  s.classList.toggle('acc-open');
}

function applyAccordionState(activeStage) {
  const activeIdx = activeStage ? STAGE_ORDER.indexOf(activeStage) : STAGE_ORDER.length;
  for (const [i, stage] of STAGE_ORDER.entries()) {
    const section = document.getElementById('acc-' + stage);
    const iconEl  = document.getElementById('acc-' + stage + '-icon');
    section.classList.remove('acc-open', 'acc-locked');
    if (stage === activeStage) {
      section.classList.add('acc-open');
      iconEl.className = 'acc-status active'; iconEl.textContent = String(i + 1);
    } else if (i < activeIdx) {
      iconEl.className = 'acc-status complete'; iconEl.innerHTML = CHECK_SVG;
    } else {
      section.classList.add('acc-locked');
      iconEl.className = 'acc-status locked'; iconEl.innerHTML = LOCK_SVG;
    }
  }
}

async function renderCompletedSummary(stage) {
  function decBadge(dec) {
    if (!dec) return '—';
    const cls = dec === 'reject' ? 'badge-danger' : dec === 'approve_with_conditions' ? 'badge-warning' : 'badge-success';
    return '<span class="badge ' + cls + '">' + esc(dec.replace(/_/g, ' ')) + '</span>';
  }

  if (stage === 's1a') {
    const typeLabel = SUPPLIER_TYPE_LABELS[contact.supplier_type] || contact.supplier_type || '—';
    document.getElementById('acc-s1a-sub').textContent = [contact.company_name, typeLabel, contact.country].filter(Boolean).join(' · ');
    document.getElementById('acc-s1a-body').innerHTML =
      '<div class="summary-grid" style="padding:var(--space-4) var(--space-6)">' +
        '<div class="summary-label">Company</div><div>' + esc(contact.company_name || '—') + '</div>' +
        '<div class="summary-label">Type</div><div>' + esc(typeLabel) + '</div>' +
        '<div class="summary-label">Country</div><div>' + esc(contact.country || '—') + '</div>' +
        (contact.registration_number ? '<div class="summary-label">Reg No.</div><div>' + esc(contact.registration_number) + '</div>' : '') +
        (contact.primary_contact_name ? '<div class="summary-label">Contact</div><div>' + esc(contact.primary_contact_name) + '</div>' : '') +
      '</div>';
    return;
  }

  if (stage === 's1b') {
    const [csRes, cmRes, g1aRes] = await Promise.all([
      supabaseClient.from('supplier_compliance_scores').select('rating_band').eq('onboarding_id', onboardingId).eq('gate', 1).order('computed_at', { ascending: false }).limit(1).maybeSingle(),
      supabaseClient.from('supplier_commercial_scores').select('rating_band').eq('onboarding_id', onboardingId).eq('gate', 1).order('computed_at', { ascending: false }).limit(1).maybeSingle(),
      supabaseClient.from('supplier_approvals').select('decision,approval_stage').eq('onboarding_id', onboardingId).in('approval_stage', ['gate1_compliance', 'gate1_commercial']),
    ]);
    const cs  = csRes.data; const cm = cmRes.data;
    const g1m = Object.fromEntries((g1aRes.data || []).map(r => [r.approval_stage, r.decision]));
    const compB = cs?.rating_band; const commB = cm?.rating_band;
    const compBClass = !compB ? 'badge-neutral' : compB === 'Low Risk' ? 'badge-success' : compB === 'Medium Risk' ? 'badge-warning' : 'badge-danger';
    const commBClass = !commB ? 'badge-neutral' : (commB === 'Strategic Supplier' || commB === 'Strong Fit') ? 'badge-success' : commB === 'Moderate Fit' ? 'badge-warning' : 'badge-neutral';
    document.getElementById('acc-s1b-sub').textContent = [compB, commB].filter(Boolean).join(' · ') || 'Gate 1 complete';
    document.getElementById('acc-s1b-body').innerHTML =
      '<div class="summary-grid" style="padding:var(--space-4) var(--space-6)">' +
        '<div class="summary-label">Compliance Risk</div><div>' + (compB ? '<span class="badge ' + compBClass + '">' + esc(compB) + '</span>' : '—') + '</div>' +
        '<div class="summary-label">Commercial Fit</div><div>' + (commB ? '<span class="badge ' + commBClass + '">' + esc(commB) + '</span>' : '—') + '</div>' +
        '<div class="summary-label">Compliance Dir.</div><div>' + decBadge(g1m['gate1_compliance']) + '</div>' +
        '<div class="summary-label">Commercial Dir.</div><div>' + decBadge(g1m['gate1_commercial']) + '</div>' +
      '</div>';
    return;
  }

  if (stage === 's2') {
    const { data: g2a } = await supabaseClient.from('supplier_approvals').select('decision,approval_stage').eq('onboarding_id', onboardingId).in('approval_stage', ['gate2_compliance', 'gate2_commercial']);
    const g2m      = Object.fromEntries((g2a || []).map(r => [r.approval_stage, r.decision]));
    const tobSt    = onboarding.tob_status || 'not_generated';
    const tobLabel = { not_generated: 'TOB not generated', generated: 'TOB generated', sent: 'TOB sent', confirmed: 'TOB confirmed' }[tobSt] || tobSt;
    const tobClass = tobSt === 'confirmed' ? 'badge-success' : tobSt === 'sent' ? 'badge-warning' : 'badge-neutral';
    document.getElementById('acc-s2-sub').textContent = 'Gate 2 · ' + tobLabel;
    document.getElementById('acc-s2-body').innerHTML =
      '<div class="summary-grid" style="padding:var(--space-4) var(--space-6)">' +
        '<div class="summary-label">TOB</div><div><span class="badge ' + tobClass + '">' + esc(tobLabel) + '</span></div>' +
        '<div class="summary-label">Compliance Dir.</div><div>' + decBadge(g2m['gate2_compliance']) + '</div>' +
        '<div class="summary-label">Commercial Dir.</div><div>' + decBadge(g2m['gate2_commercial']) + '</div>' +
      '</div>';
  }
}

async function renderActiveStage(stage) {
  if (stage === 's1a') await s1a_renderForm();
  if (stage === 's1b') await s1b_renderForm();
  if (stage === 's2')  await s2_renderForm();
  if (stage === 's3')  await s3_renderForm();
}

// ═══════════════════════════════════════════════════════════
// INIT IIFE
// ═══════════════════════════════════════════════════════════

(async () => {
  await getCurrentUser();

  if (supplierId) {
    const { data: c, error: cErr } = await supabaseClient.from('contacts').select('*').eq('id', supplierId).single();
    if (cErr || !c) {
      document.querySelector('.portal-content').innerHTML = '<p style="color:var(--color-danger);padding:var(--space-6)">Supplier not found.</p>';
      return;
    }
    contact = c;

    const { data: rows } = await supabaseClient.from('supplier_onboarding')
      .select('*').eq('contact_id', supplierId).order('created_at', { ascending: false }).limit(1);
    if (rows?.[0]) { onboarding = rows[0]; onboardingId = onboarding.id; }
  }

  const ws = onboarding?.workflow_stage || null;

  if (ws === 'trade_ready' || ws === 'rejected') {
    location.replace('detail.html?id=' + supplierId);
    return;
  }

  document.getElementById('topbar-title').textContent = contact
    ? 'Onboarding — ' + contact.company_name : 'New Supplier — Onboarding';
  document.getElementById('back-link').href = supplierId
    ? 'detail.html?id=' + supplierId : 'index.html';
  if (contact) {
    document.getElementById('page-heading').textContent = 'Onboarding — ' + contact.company_name;
    document.title = 'Onboarding — ' + contact.company_name + ' — Vertex Metals Portal';
  }

  const activeStage = getActiveStage(ws);
  const activeIdx   = activeStage ? STAGE_ORDER.indexOf(activeStage) : STAGE_ORDER.length;

  for (const [i, stage] of STAGE_ORDER.entries()) {
    if (i < activeIdx) {
      await renderCompletedSummary(stage);
    } else if (stage === activeStage) {
      await renderActiveStage(stage);
    }
  }

  applyAccordionState(activeStage);
})();



