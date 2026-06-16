/**
 * Vertex Metals Portal — Stage 1a (Supplier Registration)
 * Handles portal/suppliers/onboard.html
 *
 * Captures company identity, address, and primary contact. On "Submit for
 * Compliance Review" the onboarding moves to workflow_stage='pending_compliance',
 * handing off to the compliance director for Stage 1b (sanctions screening
 * and preliminary risk assessment — compliance-review.html). "Save Progress &
 * Exit" persists a 'draft' for later resumption.
 *
 * If ?enquiry_id is in the URL, fields are pre-filled from the enquiry.
 * If ?supplier_id is in the URL, an existing contact is loaded — either to
 * resume a 'draft' onboarding or to re-onboard a previously 'rejected' supplier
 * (a fresh onboarding record is created in that case).
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const params      = new URLSearchParams(location.search);
const enquiryId   = params.get('enquiry_id');
const reonboardId = params.get('supplier_id'); // existing contact — resume draft or re-onboard rejected

// ── State ────────────────────────────────────────────────────────────────

let contactId  = null;
let onboardingId = null;

// Products Offered (Stage 1a) — { db_id, product_line_id, product, metal_family, sub_type, specification }
let productsOffered   = [];
let removedProductIds = [];
let productFamilies   = [];
let productLinesCache = [];

const CONTACT_TYPE_MAP = {
  manufacturing:         'supplier',
  materials_commodities: 'supplier',
  logistics:             'logistics',
  packaging:             'other',
  service_provider:      'other',
};

// Updates the "Before you begin" checklist for the selected supplier type.
function renderPrerequisites() {
  const supplierType = document.getElementById('ob-type')?.value;
  const items = OnboardingWorkflow.buildStage1aPrerequisites(supplierType);
  const list = document.getElementById('prereq-list');
  if (list) list.innerHTML = items.map(item => `<li>${esc(item)}</li>`).join('');
}

function onSupplierTypeChange() {
  const supplierType = document.getElementById('ob-type')?.value;
  const profile = OnboardingWorkflow.getSupplierProfile(supplierType);

  renderPrerequisites();

  // Export licence only applies to suppliers exporting goods themselves.
  const exportLicenceGroup = document.getElementById('ob-export-licence-group');
  if (exportLicenceGroup) {
    exportLicenceGroup.style.display = profile.showExportLicence ? '' : 'none';
  }

  // QMS isn't a meaningful signal for some supplier types.
  const qmsGroup = document.getElementById('ob-qms-group');
  if (qmsGroup) {
    qmsGroup.style.display = profile.showQms ? '' : 'none';
    if (!profile.showQms) {
      document.getElementById('ob-qms-details').style.display = 'none';
    }
  }
}

// ── Pre-fill from enquiry / existing contact ────────────────────────────

async function loadEnquiry() {
  if (!enquiryId) return;

  const { data: e, error } = await supabaseClient
    .from('supplier_enquiries')
    .select('company_name, contact_name, email, phone, country, website, products_of_interest, hq_address')
    .eq('id', enquiryId)
    .single();

  if (error || !e) return;

  document.getElementById('enquiry-banner').style.display = 'block';
  document.getElementById('enquiry-banner-text').textContent = e.company_name;

  setVal('ob-company',       e.company_name);
  setVal('ob-country',       e.country);
  setVal('ob-website',       e.website);
  setVal('ob-contact-name',  e.contact_name);
  setVal('ob-contact-email', e.email);
  setVal('ob-contact-phone', e.phone);
  // hq_address from the enquiry is free text — drop it into Address Line 1
  // as a starting point; the field can be split into structured fields.
  setVal('ob-address1',      e.hq_address);
  if (e.products_of_interest) {
    setVal('ob-notes', `From enquiry — products / materials: ${e.products_of_interest}`);
  }
}

// Loads an existing contact for resume-draft or re-onboard-rejected flows.
async function loadExistingContact() {
  if (!reonboardId) return;

  const { data: c } = await supabaseClient
    .from('contacts')
    .select(`company_name, country, website, primary_contact_name, email, phone, vat_number,
      company_registration_number, beneficial_owner, supplier_type, address_line_1, address_line_2,
      city, postcode, dispatch_address_line_1, dispatch_address_line_2, dispatch_city, dispatch_postcode,
      dispatch_country, company_phone, export_licence_number, qms_certification, qms_certificate_ref,
      qms_expiry, supplier_reference, notes`)
    .eq('id', reonboardId)
    .single();

  if (!c) return;
  contactId = reonboardId;

  const { data: products } = await supabaseClient
    .from('supplier_quotes')
    .select('id, product_line_id, product, specification, product_line:product_lines(metal_family, sub_type, name)')
    .eq('supplier_id', contactId)
    .not('onboarding_review_status', 'is', null);
  productsOffered = (products || []).map(p => ({
    db_id:           p.id,
    product_line_id: p.product_line_id,
    product:         p.product_line?.name || p.product,
    metal_family:    p.product_line?.metal_family || '',
    sub_type:        p.product_line?.sub_type || '',
    specification:   p.specification,
  }));
  renderProductsOffered();

  const { data: obRows } = await supabaseClient
    .from('supplier_onboarding')
    .select('id, workflow_stage')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(1);
  const latestOb = obRows?.[0];

  // onboard.html only handles in-progress drafts or re-onboarding a
  // previously rejected supplier — any other stage means Stage 1a is
  // already submitted, so send the user to the supplier detail page instead.
  if (latestOb && !['draft', 'rejected'].includes(latestOb.workflow_stage)) {
    location.href = `detail.html?id=${reonboardId}`;
    return;
  }

  document.getElementById('enquiry-banner').style.display = 'block';
  document.getElementById('enquiry-banner-text').textContent = latestOb?.workflow_stage === 'draft'
    ? `Resuming draft for ${c.company_name}`
    : `Re-onboarding ${c.company_name} (previous onboarding rejected)`;

  if (latestOb?.workflow_stage === 'draft') {
    onboardingId = latestOb.id;
  }

  setVal('ob-company',        c.company_name);
  setVal('ob-registration',   c.company_registration_number);
  setVal('ob-country',        c.country);
  setVal('ob-vat',            c.vat_number);
  setVal('ob-website',        c.website);
  setVal('ob-beneficial',     c.beneficial_owner);
  setVal('ob-contact-name',   c.primary_contact_name);
  setVal('ob-contact-email',  c.email);
  setVal('ob-contact-phone',  c.phone);
  setVal('ob-address1',       c.address_line_1);
  setVal('ob-address2',       c.address_line_2);
  setVal('ob-city',           c.city);
  setVal('ob-postcode',       c.postcode);
  setVal('ob-company-phone',  c.company_phone);
  setVal('ob-export-licence', c.export_licence_number);
  setVal('ob-supplier-ref',   c.supplier_reference);
  setVal('ob-notes',          c.notes);
  setVal('ob-qms-ref',        c.qms_certificate_ref);
  if (c.qms_expiry) setVal('ob-qms-expiry', c.qms_expiry);
  if (c.qms_certification) document.getElementById('ob-qms').value = c.qms_certification;
  if (c.supplier_type) document.getElementById('ob-type').value = c.supplier_type;

  if (c.dispatch_address_line_1 || c.dispatch_city || c.dispatch_postcode || c.dispatch_country) {
    document.getElementById('ob-dispatch-different').checked = true;
    document.getElementById('ob-dispatch-address').style.display = 'flex';
    setVal('ob-dispatch-address1', c.dispatch_address_line_1);
    setVal('ob-dispatch-address2', c.dispatch_address_line_2);
    setVal('ob-dispatch-city',     c.dispatch_city);
    setVal('ob-dispatch-postcode', c.dispatch_postcode);
    setVal('ob-dispatch-country',  c.dispatch_country);
  }
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.value = value;
}

function toggleQmsFields() {
  const qms = document.getElementById('ob-qms')?.value;
  document.getElementById('ob-qms-details').style.display = (qms && qms !== 'none') ? 'flex' : 'none';
}

// Builds the address + dispatch address fields for the contacts payload.
function buildAddressPayload() {
  const dispatchDifferent = document.getElementById('ob-dispatch-different')?.checked;
  return {
    address_line_1: document.getElementById('ob-address1')?.value.trim() || null,
    address_line_2: document.getElementById('ob-address2')?.value.trim() || null,
    city:           document.getElementById('ob-city')?.value.trim()     || null,
    postcode:       document.getElementById('ob-postcode')?.value.trim() || null,
    dispatch_address_line_1: dispatchDifferent ? (document.getElementById('ob-dispatch-address1')?.value.trim() || null) : null,
    dispatch_address_line_2: dispatchDifferent ? (document.getElementById('ob-dispatch-address2')?.value.trim() || null) : null,
    dispatch_city:           dispatchDifferent ? (document.getElementById('ob-dispatch-city')?.value.trim()     || null) : null,
    dispatch_postcode:       dispatchDifferent ? (document.getElementById('ob-dispatch-postcode')?.value.trim() || null) : null,
    dispatch_country:        dispatchDifferent ? (document.getElementById('ob-dispatch-country')?.value.trim()  || null) : null,
  };
}

function buildContactPayload() {
  const supplierType = document.getElementById('ob-type')?.value || null;
  const qms = document.getElementById('ob-qms')?.value || null;
  const qmsHasDetails = qms && qms !== 'none';
  return {
    company_name:                document.getElementById('ob-company')?.value.trim(),
    company_registration_number: document.getElementById('ob-registration')?.value.trim() || null,
    country:                     document.getElementById('ob-country')?.value.trim() || null,
    supplier_type:                supplierType,
    primary_contact_name:        document.getElementById('ob-contact-name')?.value.trim() || null,
    email:                        document.getElementById('ob-contact-email')?.value.trim() || null,
    phone:                        document.getElementById('ob-contact-phone')?.value.trim() || null,
    company_phone:                document.getElementById('ob-company-phone')?.value.trim() || null,
    website:                      document.getElementById('ob-website')?.value.trim() || null,
    vat_number:                   document.getElementById('ob-vat')?.value.trim() || null,
    beneficial_owner:             document.getElementById('ob-beneficial')?.value.trim() || null,
    export_licence_number:        document.getElementById('ob-export-licence')?.value.trim() || null,
    qms_certification:            qms || null,
    qms_certificate_ref:          qmsHasDetails ? (document.getElementById('ob-qms-ref')?.value.trim() || null) : null,
    qms_expiry:                   qmsHasDetails ? (document.getElementById('ob-qms-expiry')?.value || null) : null,
    supplier_reference:           document.getElementById('ob-supplier-ref')?.value.trim() || null,
    notes:                         document.getElementById('ob-notes')?.value.trim() || null,
    approval_status:              'under_review',
    ...buildAddressPayload(),
  };
}

// Inserts a new contact, retrying once with a freshly generated
// supplier_reference if the unique index is violated.
async function insertContact(payload) {
  const contactType = CONTACT_TYPE_MAP[payload.supplier_type] || 'supplier';
  const { data, error } = await supabaseClient
    .from('contacts').insert({ ...payload, type: contactType }).select('id').single();

  if (!error) return data.id;

  if (error.code === '23505') {
    payload.supplier_reference = OnboardingWorkflow.generateSupplierReference();
    document.getElementById('ob-supplier-ref').value = payload.supplier_reference;
    const { data: retryData, error: retryErr } = await supabaseClient
      .from('contacts').insert({ ...payload, type: contactType }).select('id').single();
    if (retryErr) throw new Error('Failed to create supplier record: ' + retryErr.message);
    return retryData.id;
  }

  throw new Error('Failed to create supplier record: ' + error.message);
}

// ── Products Offered ─────────────────────────────────────────────────────

async function loadProductCatalogue() {
  try {
    const { data, error } = await supabaseClient.from('product_families').select('*').order('name');
    if (error) throw error;
    productFamilies = (data || []).filter(f => f.active !== false);
  } catch (error) {
    console.warn('Unable to load product_families table, falling back to distinct metal_family values:', error.message);
    const { data: allFamilies } = await supabaseClient.from('product_lines').select('metal_family').order('metal_family');
    const names = [...new Set((allFamilies || []).map(r => r.metal_family).filter(Boolean))];
    productFamilies = names.map(name => ({ id: null, name, active: true }));
  }

  const { data: lines } = await supabaseClient
    .from('product_lines')
    .select('id, name, metal_family, sub_type')
    .eq('active', true)
    .order('metal_family').order('sub_type').order('name');
  productLinesCache = lines || [];
}

function renderProductsOffered() {
  const tbody = document.getElementById('products-offered-body');
  if (!tbody) return;

  if (productsOffered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted);padding:var(--space-6)">No products added yet.</td></tr>';
    return;
  }

  tbody.innerHTML = productsOffered.map((p, idx) => `
    <tr>
      <td>${esc(p.metal_family || '—')}${p.sub_type ? ` / ${esc(p.sub_type)}` : ''}</td>
      <td style="font-weight:600">${esc(p.product)}</td>
      <td>${esc(p.specification || '—')}</td>
      <td style="text-align:right"><button type="button" class="btn btn-ghost btn-sm" onclick="removeProductOffered(${idx})">Remove</button></td>
    </tr>`).join('');
}

function openAddProductModal() {
  const container = document.getElementById('add-product-form-container');
  container.innerHTML = buildAddProductForm();
  document.getElementById('add-product-modal').classList.add('open');
}

function buildAddProductForm() {
  const familyOptions = productFamilies.map(f => `<option value="${esc(f.name)}">${esc(f.name)}</option>`).join('');

  return `
    <form id="add-product-form" onsubmit="submitAddProduct(event)">
      <div class="form-group" style="margin-bottom:var(--space-4)">
        <label class="form-label">Source</label>
        <div style="display:flex;gap:var(--space-5)">
          <label style="display:flex;align-items:center;gap:var(--space-2);font-weight:normal">
            <input type="radio" name="add-product-mode" value="catalogue" checked onchange="onAddProductModeChange()" /> From catalogue
          </label>
          <label style="display:flex;align-items:center;gap:var(--space-2);font-weight:normal">
            <input type="radio" name="add-product-mode" value="new" onchange="onAddProductModeChange()" /> New product line
          </label>
        </div>
      </div>

      <div id="add-product-catalogue-fields" class="form-grid" style="margin-bottom:var(--space-4)">
        <div class="form-group">
          <label class="form-label">Family <span class="required">*</span></label>
          <select class="form-select" id="add-product-family" onchange="onAddProductFamilyChange()">
            <option value="">— Select family —</option>
            ${familyOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Product <span class="required">*</span></label>
          <select class="form-select" id="add-product-line">
            <option value="">— Select family first —</option>
          </select>
        </div>
      </div>

      <div id="add-product-new-fields" class="form-grid" style="margin-bottom:var(--space-4);display:none">
        <div class="form-group">
          <label class="form-label">Family <span class="required">*</span></label>
          <select class="form-select" id="add-product-new-family" onchange="onAddProductNewFamilyChange()">
            <option value="">— Select family —</option>
            ${familyOptions}
            <option value="__new__">— New family —</option>
          </select>
          <input type="text" class="form-input" id="add-product-new-family-name" placeholder="New family name" style="display:none;margin-top:var(--space-2)" />
        </div>
        <div class="form-group">
          <label class="form-label">Sub-type</label>
          <input type="text" class="form-input" id="add-product-new-subtype" placeholder="e.g. Alloy Wire, EC Grade, 6XXX Series" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Product Name <span class="required">*</span></label>
          <input type="text" class="form-input" id="add-product-new-name" placeholder="e.g. Aluminium Alloy Core Wire EC Grade" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Specification</label>
        <input type="text" class="form-input" id="add-product-spec" placeholder="Grade, size, standard, etc. the supplier offers" />
      </div>

      <div id="add-product-alert" class="alert" style="display:none;margin-top:var(--space-3)"></div>

      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary">Add Product</button>
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('add-product-modal').classList.remove('open')">Cancel</button>
      </div>
    </form>`;
}

function onAddProductModeChange() {
  const mode = document.querySelector('input[name="add-product-mode"]:checked')?.value;
  document.getElementById('add-product-catalogue-fields').style.display = mode === 'catalogue' ? '' : 'none';
  document.getElementById('add-product-new-fields').style.display = mode === 'new' ? '' : 'none';
}

function onAddProductFamilyChange() {
  const family = document.getElementById('add-product-family')?.value;
  const sel = document.getElementById('add-product-line');
  const lines = productLinesCache.filter(pl => pl.metal_family === family);

  if (!family || lines.length === 0) {
    sel.innerHTML = '<option value="">— Select family first —</option>';
    return;
  }

  sel.innerHTML = '<option value="">— Select product —</option>' +
    lines.map(pl => `<option value="${esc(pl.id)}">${esc(pl.sub_type ? `${pl.sub_type} — ${pl.name}` : pl.name)}</option>`).join('');
}

function onAddProductNewFamilyChange() {
  const val = document.getElementById('add-product-new-family')?.value;
  document.getElementById('add-product-new-family-name').style.display = val === '__new__' ? '' : 'none';
}

async function submitAddProduct(e) {
  e.preventDefault();
  const alertEl = document.getElementById('add-product-alert');
  const showError = (msg) => {
    alertEl.style.display = 'block';
    alertEl.className = 'alert alert-error';
    alertEl.textContent = msg;
  };

  const mode = document.querySelector('input[name="add-product-mode"]:checked')?.value;
  const specification = document.getElementById('add-product-spec')?.value.trim() || null;

  let productLineId, product, metalFamily, subType;

  if (mode === 'catalogue') {
    productLineId = document.getElementById('add-product-line')?.value;
    if (!productLineId) return showError('Select a product from the catalogue.');

    const pl = productLinesCache.find(p => p.id === productLineId);
    if (!pl) return showError('Selected product could not be found.');
    product = pl.name;
    metalFamily = pl.metal_family;
    subType = pl.sub_type;

  } else {
    const familySel = document.getElementById('add-product-new-family')?.value;
    const newFamilyName = document.getElementById('add-product-new-family-name')?.value.trim();
    subType = document.getElementById('add-product-new-subtype')?.value.trim() || null;
    product = document.getElementById('add-product-new-name')?.value.trim();

    if (!familySel) return showError('Select or create a family.');
    if (familySel === '__new__' && !newFamilyName) return showError('Enter a name for the new family.');
    if (!product) return showError('Enter a product name.');

    metalFamily = familySel === '__new__' ? newFamilyName : familySel;

    if (familySel === '__new__') {
      await supabaseClient.from('product_families').insert({ name: metalFamily, active: true });
    }

    const { data: newPl, error: plErr } = await supabaseClient
      .from('product_lines')
      .insert({ metal_family: metalFamily, sub_type: subType, name: product, active: true })
      .select('id').single();
    if (plErr) return showError('Failed to create product line: ' + plErr.message);

    productLineId = newPl.id;
    productLinesCache.push({ id: productLineId, name: product, metal_family: metalFamily, sub_type: subType });
  }

  if (productsOffered.some(p => p.product_line_id === productLineId)) {
    return showError('This product has already been added.');
  }

  productsOffered.push({ db_id: null, product_line_id: productLineId, product, metal_family: metalFamily, sub_type: subType, specification });
  renderProductsOffered();
  document.getElementById('add-product-modal').classList.remove('open');
}

function removeProductOffered(idx) {
  const entry = productsOffered[idx];
  if (entry.db_id) removedProductIds.push(entry.db_id);
  productsOffered.splice(idx, 1);
  renderProductsOffered();
}

// Persists productsOffered/removedProductIds to supplier_quotes once the
// contact record exists. Called from both Save & Exit and Submit for Review.
async function syncProductsOffered(supplierId) {
  for (const p of productsOffered) {
    if (p.db_id) continue;
    const { data, error } = await supabaseClient
      .from('supplier_quotes')
      .insert({
        supplier_id:               supplierId,
        product_line_id:           p.product_line_id,
        product:                   p.product,
        specification:             p.specification,
        incoterm:                  'FOB',
        fob_price_usd:             0,
        status:                    'pending',
        onboarding_review_status:  'pending_review',
      })
      .select('id').single();
    if (error) throw new Error('Failed to save offered product: ' + error.message);
    p.db_id = data.id;
  }

  if (removedProductIds.length) {
    const { error } = await supabaseClient.from('supplier_quotes').delete().in('id', removedProductIds);
    if (error) throw new Error('Failed to remove product: ' + error.message);
    removedProductIds = [];
  }
}

// ── Save Progress & Exit ─────────────────────────────────────────────────

async function submitSaveAndExit() {
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
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const user = await getCurrentUser();
    const payload = buildContactPayload();

    if (!contactId) {
      contactId = await insertContact(payload);
    } else {
      const { error } = await supabaseClient.from('contacts').update(payload).eq('id', contactId);
      if (error) throw new Error('Failed to update supplier record: ' + error.message);
    }

    await syncProductsOffered(contactId);

    if (!onboardingId) {
      const { data: onboarding, error: obErr } = await supabaseClient
        .from('supplier_onboarding')
        .insert({ contact_id: contactId, enquiry_id: enquiryId || null, workflow_stage: 'draft', raised_by: user?.id || null })
        .select('id').single();
      if (obErr) throw new Error('Failed to create onboarding record: ' + obErr.message);
      onboardingId = onboarding.id;
    } else {
      await supabaseClient.from('supplier_onboarding')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', onboardingId);
    }

    await OnboardingWorkflow.logEvent(contactId, onboardingId, 'onboarding_draft_saved',
      `Stage 1 progress saved as draft for ${company}.`, {}
    );

    location.href = `detail.html?id=${contactId}`;

  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Save Progress & Exit';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ── Submit for Compliance Review ─────────────────────────────────────────

async function submitForComplianceReview() {
  const errEl = document.getElementById('ob-error');
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
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const user = await getCurrentUser();
    const payload = buildContactPayload();
    const contactTypeLabel = payload.supplier_type === 'logistics' ? 'logistics provider'
                            : payload.supplier_type === 'packaging' ? 'packaging supplier'
                            : ['service_provider'].includes(payload.supplier_type) ? 'service provider'
                            : 'supplier';

    // ── 1. Upsert contact ────────────────────────────────────────────
    if (!contactId) {
      const contactType = CONTACT_TYPE_MAP[payload.supplier_type] || 'supplier';
      const { data: existing } = await supabaseClient
        .from('contacts').select('id').eq('type', contactType).ilike('company_name', company).limit(1);
      if (existing && existing.length > 0) {
        const proceed = confirm(
          `A ${contactTypeLabel} named "${company}" already exists in the register.\n\nProceed and create a new record anyway? (Click Cancel to go back and check first.)`
        );
        if (!proceed) {
          btn.disabled = false;
          btn.textContent = 'Submit for Compliance Review';
          return;
        }
      }
      contactId = await insertContact(payload);
    } else {
      const { error } = await supabaseClient.from('contacts').update(payload).eq('id', contactId);
      if (error) throw new Error('Failed to update supplier record: ' + error.message);
    }

    await syncProductsOffered(contactId);

    // ── 2. Upsert onboarding record ──────────────────────────────────
    if (!onboardingId) {
      const { data: complianceUsers } = await supabaseClient
        .from('user_roles').select('user_id').eq('role', 'director_compliance').limit(1);
      const vetterUserId = complianceUsers?.[0]?.user_id || null;

      const { data: onboarding, error: obErr } = await supabaseClient
        .from('supplier_onboarding')
        .insert({
          contact_id:          contactId,
          enquiry_id:          enquiryId || null,
          workflow_stage:      'draft',
          raised_by:           user?.id || null,
          vetting_assigned_to: vetterUserId,
        })
        .select('id').single();
      if (obErr) throw new Error('Failed to create onboarding record: ' + obErr.message);
      onboardingId = onboarding.id;

      await OnboardingWorkflow.logEvent(contactId, onboardingId, 'onboarding_created',
        `Onboarding created for ${company} (${contactTypeLabel}) by ${user?.email || 'unknown'}.`,
        { raised_by: user?.id, enquiry_id: enquiryId || null }
      );

      if (enquiryId) {
        await supabaseClient.from('supplier_enquiries').update({
          status: 'converted', converted_to_onboarding_id: onboarding.id,
          reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
        }).eq('id', enquiryId);
        await OnboardingWorkflow.logEvent(contactId, onboardingId, 'enquiry_converted',
          `Enquiry ${enquiryId} converted to onboarding.`, { enquiry_id: enquiryId }
        );
      }
    }

    // ── 3. Advance to pending_compliance ──────────────────────────────
    const result = await OnboardingWorkflow.advanceStage(onboardingId, 'pending_compliance');
    if (!result.ok) {
      errEl.innerHTML = '<strong>Saved, but cannot be submitted for compliance review yet:</strong>' + OnboardingWorkflow.renderBlockers(result.blockers);
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Submit for Compliance Review';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    location.href = `detail.html?id=${contactId}`;

  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Submit for Compliance Review';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ── Init ──────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';

  document.getElementById('save-exit-btn').addEventListener('click', submitSaveAndExit);
  document.getElementById('complete-btn').addEventListener('click', submitForComplianceReview);
  document.getElementById('ob-type').addEventListener('change', onSupplierTypeChange);
  document.getElementById('ob-qms').addEventListener('change', toggleQmsFields);
  document.getElementById('add-product-offered-btn').addEventListener('click', openAddProductModal);

  await loadProductCatalogue();
  renderProductsOffered();

  if (enquiryId)   await loadEnquiry();
  if (reonboardId) await loadExistingContact();

  if (!document.getElementById('ob-supplier-ref').value) {
    document.getElementById('ob-supplier-ref').value = OnboardingWorkflow.generateSupplierReference();
  }

  toggleQmsFields();
  onSupplierTypeChange();
})();
