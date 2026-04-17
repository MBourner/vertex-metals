/**
 * Vertex Metals Ltd — Public Contact / RFQ Form
 *
 * Handles validation, Supabase insert, and success/error feedback
 * for contact.html (buyer enquiries only).
 *
 * Depends on: supabase-client.js (loaded before this in contact.html)
 *
 * On submit: writes to rfq_submissions table in Supabase.
 * RLS policy allows anonymous INSERT on this table.
 *
 * TODO (email notification): Set up a Supabase Database Webhook that
 * triggers on INSERT to rfq_submissions and calls a Supabase Edge Function
 * to send an email via Resend to sales@vertexmetalsltd.com.
 * This keeps the Resend API key server-side (Edge Function environment variables).
 * See: https://supabase.com/docs/guides/database/webhooks
 *      https://supabase.com/docs/guides/functions
 */

function clearErrors() {
  ['name', 'company', 'email'].forEach(f => {
    const el = document.getElementById('err-' + f);
    if (el) el.textContent = '';
    const input = document.getElementById('field-' + f);
    if (input) input.classList.remove('error');
  });
}

function showError(field, message) {
  const el = document.getElementById('err-' + field);
  const input = document.getElementById('field-' + field);
  if (el) el.textContent = message;
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

function showAlert(type, message) {
  const alertEl = document.getElementById('form-alert');
  alertEl.style.display = 'block';
  alertEl.className = 'alert alert-' + type;
  alertEl.innerHTML = message;
  alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.getElementById('contact-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  const payload = {
    type:        'buyer',
    name:        document.getElementById('field-name').value.trim(),
    company:     document.getElementById('field-company').value.trim(),
    email:       document.getElementById('field-email').value.trim(),
    role:        document.getElementById('field-role')?.value.trim()     || null,
    phone:       document.getElementById('field-phone')?.value.trim()    || null,
    product:     document.getElementById('field-product')?.value         || null,
    quantity_mt: parseFloat(document.getElementById('field-quantity')?.value.trim()) || null,
    message:     document.getElementById('field-message').value.trim()   || null,
    status:      'new',
  };

  const { error } = await supabaseClient
    .from('rfq_submissions')
    .insert([payload]);

  if (error) {
    console.error('Supabase insert error:', error);
    showAlert('error',
      'Something went wrong submitting your enquiry. Please try again or email us directly at ' +
      '<a href="mailto:sales@vertexmetalsltd.com" style="color:inherit;text-decoration:underline">sales@vertexmetalsltd.com</a>.'
    );
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Enquiry';
    return;
  }

  document.getElementById('contact-form').style.display = 'none';
  showAlert('success',
    '<strong>Enquiry received.</strong> Thank you — we will respond within one business day. ' +
    'If your matter is urgent, please email <a href="mailto:sales@vertexmetalsltd.com" style="color:inherit;text-decoration:underline">sales@vertexmetalsltd.com</a> directly.'
  );
});
