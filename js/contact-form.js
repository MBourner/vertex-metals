/**
 * Vertex Metals Ltd — Public Contact / RFQ Form
 *
 * Handles cascading product family → product line dropdowns loaded from
 * Supabase (anon key), validation, and insert to rfq_submissions.
 *
 * TODO: Set up a Supabase DB webhook on rfq_submissions INSERT →
 *       Edge Function → Resend to notify sales@vertexmetalsltd.com.
 */

// ── Dropdown population ────────────────────────────────────────

async function loadFamilies() {
  const sel = document.getElementById('field-family');

  const { data, error } = await supabaseClient
    .from('product_families')
    .select('id, name')
    .eq('active', true)
    .order('name');

  sel.innerHTML = '<option value="">Select a product family…</option>';

  if (error || !data || !data.length) {
    sel.innerHTML += '<option value="general">General enquiry</option>';
    return;
  }

  data.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.name;
    opt.textContent = f.name;
    sel.appendChild(opt);
  });

  // Add general enquiry at the end
  const gen = document.createElement('option');
  gen.value = 'general';
  gen.textContent = 'General enquiry';
  sel.appendChild(gen);

  // Apply URL param pre-selection if set
  if (window._preselectFamily) {
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === window._preselectFamily) {
        sel.selectedIndex = i;
        await loadProductLines(window._preselectFamily);
        break;
      }
    }
  }
}

async function loadProductLines(familyName) {
  const group = document.getElementById('product-line-group');
  const sel   = document.getElementById('field-product-line');

  if (!familyName || familyName === 'general') {
    group.style.display = 'none';
    sel.value = '';
    return;
  }

  const { data, error } = await supabaseClient
    .from('product_lines')
    .select('id, name, sub_type')
    .eq('metal_family', familyName)
    .eq('active', true)
    .order('sub_type')
    .order('name');

  if (error || !data || !data.length) {
    group.style.display = 'none';
    return;
  }

  sel.innerHTML = '<option value="">— Any / not sure yet —</option>';

  // Group by sub_type
  const groups = {};
  data.forEach(pl => {
    const g = pl.sub_type || 'Other';
    if (!groups[g]) groups[g] = [];
    groups[g].push(pl);
  });

  Object.entries(groups).forEach(([groupName, lines]) => {
    if (Object.keys(groups).length > 1) {
      const og = document.createElement('optgroup');
      og.label = groupName;
      lines.forEach(pl => {
        const opt = document.createElement('option');
        opt.value = pl.id;
        opt.textContent = pl.name;
        og.appendChild(opt);
      });
      sel.appendChild(og);
    } else {
      lines.forEach(pl => {
        const opt = document.createElement('option');
        opt.value = pl.id;
        opt.textContent = pl.name;
        sel.appendChild(opt);
      });
    }
  });

  group.style.display = 'block';
}

document.getElementById('field-family').addEventListener('change', function () {
  loadProductLines(this.value);
});

// ── Validation ─────────────────────────────────────────────────

function clearErrors() {
  ['name', 'company', 'email'].forEach(f => {
    const el = document.getElementById('err-' + f);
    if (el) el.textContent = '';
    const input = document.getElementById('field-' + f);
    if (input) input.classList.remove('error');
  });
}

function showError(field, message) {
  const el    = document.getElementById('err-' + field);
  const input = document.getElementById('field-' + field);
  if (el)    el.textContent = message;
  if (input) input.classList.add('error');
}

function validateForm() {
  clearErrors();
  let valid = true;
  const name    = document.getElementById('field-name').value.trim();
  const company = document.getElementById('field-company').value.trim();
  const email   = document.getElementById('field-email').value.trim();
  if (!name)    { showError('name',    'Required'); valid = false; }
  if (!company) { showError('company', 'Required'); valid = false; }
  if (!email)   { showError('email',   'Required'); valid = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('email', 'Please enter a valid email address'); valid = false;
  }
  return valid;
}

function showFormError(message) {
  const section = document.getElementById('form-section');
  let alertEl = document.getElementById('form-alert');
  if (!alertEl) {
    alertEl = document.createElement('div');
    alertEl.id = 'form-alert';
    alertEl.style.marginTop = 'var(--space-4)';
    section.appendChild(alertEl);
  }
  alertEl.style.display = 'block';
  alertEl.className = 'alert alert-error';
  alertEl.innerHTML = message;
  alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showFormSuccess() {
  const section = document.getElementById('form-section');
  section.innerHTML = `
    <div style="padding:var(--space-10) 0;text-align:center">
      <div style="width:56px;height:56px;background:rgba(122,184,212,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto var(--space-5)">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style="margin-bottom:var(--space-3)">Enquiry received</h2>
      <div class="divider-steel" style="margin:0 auto var(--space-5)"></div>
      <p style="color:var(--color-text-secondary);max-width:420px;margin:0 auto var(--space-4);line-height:1.7">
        Thank you for getting in touch. We'll review your enquiry and respond within one business day.
      </p>
      <p style="font-size:var(--text-sm);color:var(--color-text-muted);max-width:400px;margin:0 auto">
        For urgent matters, email us directly at
        <a href="mailto:sales@vertexmetalsltd.com" style="color:var(--color-accent)">sales@vertexmetalsltd.com</a>
      </p>
    </div>`;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Submit ─────────────────────────────────────────────────────

document.getElementById('contact-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  if (!validateForm()) return;

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  const familyVal      = document.getElementById('field-family').value;
  const productLineId  = document.getElementById('field-product-line').value || null;
  const productLineName = productLineId
    ? document.getElementById('field-product-line').selectedOptions[0]?.textContent
    : null;

  // `product` text field: use product line name if selected, otherwise family name
  const productText = productLineName || (familyVal !== 'general' ? familyVal : null);

  const qtyRaw  = document.getElementById('field-quantity')?.value.trim();
  const qtyMt   = parseFloat(qtyRaw) || null;
  const qtyUnit = document.getElementById('field-quantity-unit')?.value || 'MT';

  const payload = {
    type:            'buyer',
    name:            document.getElementById('field-name').value.trim(),
    company:         document.getElementById('field-company').value.trim(),
    email:           document.getElementById('field-email').value.trim(),
    role:            document.getElementById('field-role')?.value.trim()           || null,
    phone:           document.getElementById('field-phone')?.value.trim()          || null,
    product:         productText,
    product_line_id: productLineId,
    quantity_mt:     qtyUnit === 'MT' ? qtyMt : null,
    quantity_unit:   qtyUnit,
    specifications:  document.getElementById('field-specifications')?.value.trim() || null,
    message:         document.getElementById('field-message').value.trim()         || null,
    status:          'new',
  };

  const { error } = await supabaseClient.from('rfq_submissions').insert([payload]);

  if (error) {
    console.error('Supabase insert error:', error);
    showFormError(
      'Something went wrong submitting your enquiry. Please try again or email us directly at ' +
      '<a href="mailto:sales@vertexmetalsltd.com" style="color:inherit;text-decoration:underline">sales@vertexmetalsltd.com</a>.'
    );
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Enquiry';
    return;
  }

  showFormSuccess();
});

// ── Init ───────────────────────────────────────────────────────
loadFamilies();
