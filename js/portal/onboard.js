/**
 * Vertex Metals Portal — Supplier Onboarding Intake Form
 * Handles portal/suppliers/onboard.html
 *
 * Jackson fills this form to create a formal supplier onboarding record.
 * If ?enquiry_id is in the URL, fields are pre-filled from the enquiry.
 * On submit: creates/updates the contacts record, creates supplier_onboarding,
 * writes audit trail events, and navigates to the supplier detail page.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const params     = new URLSearchParams(location.search);
const enquiryId  = params.get('enquiry_id');
const reonboardId = params.get('supplier_id'); // for re-onboarding a rejected supplier

// ── Pre-fill from enquiry ─────────────────────────────────────────────────

async function loadEnquiry() {
  if (!enquiryId) return;

  const { data: e, error } = await supabaseClient
    .from('supplier_enquiries')
    .select('company_name, contact_name, email, phone, country, website, products_of_interest')
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
  if (e.products_of_interest) {
    setVal('ob-notes', `From enquiry — products / materials: ${e.products_of_interest}`);
  }
}

// Pre-fill known details if re-onboarding a rejected supplier
async function loadExistingContact() {
  if (!reonboardId) return;

  const { data: c } = await supabaseClient
    .from('contacts')
    .select('company_name, country, website, primary_contact_name, email, phone, vat_number, company_registration_number, beneficial_owner, supplier_type')
    .eq('id', reonboardId)
    .single();

  if (!c) return;

  document.getElementById('enquiry-banner').style.display = 'block';
  document.getElementById('enquiry-banner-text').textContent = `Re-onboarding ${c.company_name} (previous onboarding rejected)`;

  setVal('ob-company',        c.company_name);
  setVal('ob-registration',   c.company_registration_number);
  setVal('ob-country',        c.country);
  setVal('ob-vat',            c.vat_number);
  setVal('ob-website',        c.website);
  setVal('ob-beneficial',     c.beneficial_owner);
  setVal('ob-contact-name',   c.primary_contact_name);
  setVal('ob-contact-email',  c.email);
  setVal('ob-contact-phone',  c.phone);
  if (c.supplier_type) document.getElementById('ob-type').value = c.supplier_type;
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.value = value;
}

// ── Form submission ───────────────────────────────────────────────────────

async function handleSubmit(e) {
  e.preventDefault();

  const errEl = document.getElementById('ob-error');
  errEl.style.display = 'none';

  const company       = document.getElementById('ob-company')?.value.trim();
  const regNumber     = document.getElementById('ob-registration')?.value.trim();
  const country       = document.getElementById('ob-country')?.value.trim();
  const supplierType  = document.getElementById('ob-type')?.value;
  const contactName   = document.getElementById('ob-contact-name')?.value.trim();
  const contactEmail  = document.getElementById('ob-contact-email')?.value.trim();
  const risk          = document.getElementById('ob-risk')?.value;

  // Required field validation
  const missing = [];
  if (!company)      missing.push('Company Name');
  if (!regNumber)    missing.push('Registration Number');
  if (!country)      missing.push('Country');
  if (!supplierType) missing.push('Supplier Type');
  if (!contactName)  missing.push('Contact Name');
  if (!contactEmail) missing.push('Email');
  if (!risk)         missing.push('Initial Risk Category');

  if (missing.length) {
    errEl.textContent = `Please complete: ${missing.join(', ')}.`;
    errEl.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const btn = document.getElementById('ob-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Creating…';

  try {
    const user = await getCurrentUser();

    // Map supplier_type → contacts.type so logistics/packaging/service
    // providers are stored under the correct contact category in the CRM.
    const CONTACT_TYPE_MAP = {
      manufacturing:         'supplier',
      materials_commodities: 'supplier',
      logistics:             'logistics',
      packaging:             'other',
      service_provider:      'other',
    };
    const contactType = CONTACT_TYPE_MAP[supplierType] || 'supplier';
    const contactTypeLabel = contactType === 'logistics' ? 'logistics provider'
                           : supplierType === 'packaging' ? 'packaging supplier'
                           : contactType === 'other'      ? 'service provider'
                           : 'supplier';

    // ── 1. Create or update contact record ──────────────────────────────
    let contactId = reonboardId || null;

    if (!contactId) {
      // Check for duplicate company name before inserting
      const { data: existing } = await supabaseClient
        .from('contacts')
        .select('id')
        .eq('type', contactType)
        .ilike('company_name', company)
        .limit(1);

      if (existing && existing.length > 0) {
        const proceed = confirm(
          `A ${contactTypeLabel} named "${company}" already exists in the register.\n\nProceed and create a new record anyway? (Click Cancel to go back and check first.)`
        );
        if (!proceed) {
          btn.disabled = false;
          btn.textContent = 'Create Onboarding & Assign for Vetting';
          return;
        }
      }

      const contactPayload = {
        type:                        contactType,
        company_name:                company,
        company_registration_number: regNumber,
        country,
        supplier_type:               supplierType,
        primary_contact_name:        contactName,
        email:                       contactEmail,
        phone:                       document.getElementById('ob-contact-phone')?.value.trim() || null,
        website:                     document.getElementById('ob-website')?.value.trim()       || null,
        vat_number:                  document.getElementById('ob-vat')?.value.trim()           || null,
        beneficial_owner:            document.getElementById('ob-beneficial')?.value.trim()    || null,
        approval_status:             'under_review',
        notes:                       document.getElementById('ob-notes')?.value.trim()         || null,
      };

      const { data: newContact, error: cErr } = await supabaseClient
        .from('contacts').insert(contactPayload).select('id').single();
      if (cErr) throw new Error('Failed to create supplier record: ' + cErr.message);
      contactId = newContact.id;

    } else {
      // Update existing contact with any newly captured fields
      await supabaseClient.from('contacts').update({
        company_registration_number: regNumber,
        country,
        supplier_type:               supplierType,
        primary_contact_name:        contactName,
        email:                       contactEmail,
        phone:                       document.getElementById('ob-contact-phone')?.value.trim() || null,
        website:                     document.getElementById('ob-website')?.value.trim()       || null,
        vat_number:                  document.getElementById('ob-vat')?.value.trim()           || null,
        beneficial_owner:            document.getElementById('ob-beneficial')?.value.trim()    || null,
        approval_status:             'under_review',
      }).eq('id', contactId);
    }

    // ── 2. Look up the director_compliance user to assign vetting ───────
    const { data: complianceUsers } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'director_compliance')
      .limit(1);
    const vetterUserId = complianceUsers?.[0]?.user_id || null;

    // ── 3. Create supplier_onboarding record ─────────────────────────────
    const { data: onboarding, error: obErr } = await supabaseClient
      .from('supplier_onboarding')
      .insert({
        contact_id:           contactId,
        enquiry_id:           enquiryId || null,
        workflow_stage:       'screening', // intake form IS stage 1; advance to screening on submit
        risk_level:           risk,
        raised_by:            user?.id || null,
        vetting_assigned_to:  vetterUserId,
      })
      .select('id')
      .single();
    if (obErr) throw new Error('Failed to create onboarding record: ' + obErr.message);

    // ── 4. Mark enquiry as converted if applicable ───────────────────────
    if (enquiryId) {
      await supabaseClient.from('supplier_enquiries').update({
        status:                      'converted',
        converted_to_onboarding_id:  onboarding.id,
        reviewed_by:                 user?.id,
        reviewed_at:                 new Date().toISOString(),
      }).eq('id', enquiryId);
    }

    // ── 5. Write audit trail events ──────────────────────────────────────
    await OnboardingWorkflow.logEvent(
      contactId, onboarding.id, 'onboarding_created',
      `Onboarding created for ${company} (${contactTypeLabel}) by ${user?.email || 'unknown'}. Initial risk: ${risk}. Assigned to compliance director for vetting.`,
      { risk_level: risk, raised_by: user?.id, enquiry_id: enquiryId || null }
    );

    if (enquiryId) {
      await OnboardingWorkflow.logEvent(
        contactId, onboarding.id, 'enquiry_converted',
        `Enquiry ${enquiryId} converted to onboarding.`,
        { enquiry_id: enquiryId }
      );
    }

    // ── 6. Navigate to supplier detail page ─────────────────────────────
    location.href = `detail.html?id=${contactId}&onboarding_new=1`;

  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Create Onboarding & Assign for Vetting';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ── Init ──────────────────────────────────────────────────────────────────

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';

  document.getElementById('onboard-form').addEventListener('submit', handleSubmit);

  if (enquiryId)    await loadEnquiry();
  if (reonboardId)  await loadExistingContact();
})();
