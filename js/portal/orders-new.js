/**
 * Vertex Metals Portal — New Order Form
 * Handles portal/orders/new.html
 *
 * Creates a trade in order_drafted state, a po_translation verification
 * queue entry, and the first order_events row — all in sequence.
 *
 * Prerequisites: run docs/migrations/phase-3-trades-columns.sql first.
 * Storage bucket 'order-documents' must exist for PO document upload.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let _buyers       = [];
let _productLines = [];

function generateReference() {
  const year  = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix  = '';
  for (let i = 0; i < 5; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `VM-${year}-${suffix}`;
}

async function init() {
  const [buyersRes, plRes] = await Promise.all([
    supabaseClient.from('contacts').select('id, company_name').eq('type', 'buyer').order('company_name'),
    supabaseClient.from('product_lines').select('id, name, cn_code, default_markup_pct').eq('active', true).order('name'),
  ]);

  _buyers       = buyersRes.data || [];
  _productLines = plRes.data     || [];

  // Populate dropdowns
  const buyerSel = document.getElementById('f-buyer');
  _buyers.forEach(b => {
    const opt = document.createElement('option');
    opt.value       = b.id;
    opt.textContent = b.company_name;
    buyerSel.appendChild(opt);
  });

  const productSel = document.getElementById('f-product-line');
  _productLines.forEach(pl => {
    const opt = document.createElement('option');
    opt.value       = pl.id;
    opt.dataset.name = pl.name;
    opt.textContent = pl.name + (pl.cn_code ? ` (CN ${pl.cn_code})` : '');
    productSel.appendChild(opt);
  });

  document.getElementById('f-reference').value = generateReference();
}

// Show email file name in the left panel when a file is selected
document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('f-email-file');
  const emailLabel = document.getElementById('email-file-label');
  if (emailInput && emailLabel) {
    emailInput.addEventListener('change', () => {
      emailLabel.textContent = emailInput.files[0]?.name || 'No file selected';
    });
  }

  const poInput = document.getElementById('f-po-doc');
  const poLabel = document.getElementById('po-doc-label');
  if (poInput && poLabel) {
    poInput.addEventListener('change', () => {
      poLabel.textContent = poInput.files[0]?.name || 'No file selected';
    });
  }
});

async function uploadFile(bucket, path, file) {
  const { error } = await supabaseClient.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

async function submitNewOrder(e) {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  const errEl = document.getElementById('form-error');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const actorId = PortalRoles.getUserId();

  try {
    const poFile    = document.getElementById('f-po-doc').files[0] || null;
    const emailFile = document.getElementById('f-email-file').files[0] || null;

    const productSel  = document.getElementById('f-product-line');
    const productName = productSel.options[productSel.selectedIndex]?.dataset.name || '';

    // 1 — Insert the trade
    const payload = {
      reference:              document.getElementById('f-reference').value.trim(),
      buyer_id:               document.getElementById('f-buyer').value || null,
      product_line_id:        document.getElementById('f-product-line').value || null,
      product:                productName,
      specification:          document.getElementById('f-specification').value.trim() || null,
      quantity_mt:            parseFloat(document.getElementById('f-quantity').value) || null,
      sell_price_gbp:         parseFloat(document.getElementById('f-agreed-price').value) || null,
      incoterms:              document.getElementById('f-incoterms').value || null,
      delivery_destination:   document.getElementById('f-delivery-dest').value.trim() || null,
      required_delivery_date: document.getElementById('f-delivery-date').value || null,
      customer_po_reference:  document.getElementById('f-customer-po-ref').value.trim() || null,
      customer_po_date:       document.getElementById('f-customer-po-date').value || null,
      payment_terms:          document.getElementById('f-payment-terms').value.trim() || null,
      special_conditions:     document.getElementById('f-special-conditions').value.trim() || null,
      notes:                  document.getElementById('f-operator-notes').value.trim() || null,
      current_state:          'order_drafted',
      status:                 'enquiry', // legacy field — kept for existing JS compatibility
    };

    const { data: trade, error: tradeErr } = await supabaseClient
      .from('trades').insert(payload).select().single();

    if (tradeErr) throw new Error(tradeErr.message);

    // 2 — Upload email file if provided → inbound_emails row
    if (emailFile) {
      try {
        const emailPath = `${trade.id}/email-${Date.now()}-${emailFile.name}`;
        await uploadFile('order-documents', emailPath, emailFile);
        const { data: emailRow } = await supabaseClient.from('inbound_emails').insert({
          from_address:    'manual-upload',
          subject:         emailFile.name,
          raw_message_path: emailPath,
          linked_trade_id:  trade.id,
          processed:        false,
        }).select('id').single();
        // Link the email to the trade
        if (emailRow) {
          await supabaseClient.from('trades')
            .update({ customer_po_email_id: emailRow.id })
            .eq('id', trade.id);
        }
      } catch (uploadErr) {
        console.warn('Email upload failed (non-fatal):', uploadErr.message);
      }
    }

    // 3 — Upload PO document if provided → order_documents row
    if (poFile) {
      try {
        const poPath = `${trade.id}/po-${Date.now()}-${poFile.name}`;
        await uploadFile('order-documents', poPath, poFile);
        await supabaseClient.from('order_documents').insert({
          trade_id:      trade.id,
          document_type: 'customer_po',
          file_path:     poPath,
          file_name:     poFile.name,
          file_size_bytes: poFile.size,
          mime_type:     poFile.type || 'application/octet-stream',
          uploaded_by:   actorId,
          source:        'manual_upload',
        });
      } catch (uploadErr) {
        console.warn('PO document upload failed (non-fatal):', uploadErr.message);
      }
    }

    // 4 — Create verification queue entry
    const priority  = document.getElementById('f-priority').value || 'routine';
    const slaHours  = priority === 'expedite' ? 4 : 24;
    const { error: queueErr } = await supabaseClient.from('verification_queue').insert({
      trade_id:   trade.id,
      queue_type: 'po_translation',
      drafted_by: actorId,
      priority,
      sla_due_at: new Date(Date.now() + slaHours * 3600_000).toISOString(),
      status:     'pending',
    });
    if (queueErr) console.warn('Queue entry failed (non-fatal):', queueErr.message);

    // 5 — Write first audit event (INSERT trigger does not fire; write manually)
    await supabaseClient.from('order_events').insert({
      trade_id:   trade.id,
      event_type: 'state_change',
      from_state: null,
      to_state:   'order_drafted',
      actor_id:   actorId,
      actor_role: 'sales',
      notes:      payload.notes || null,
    });

    // Done — navigate to the new order's detail page
    window.location.href = `detail.html?id=${trade.id}`;

  } catch (err) {
    errEl.textContent = err.message;
    btn.disabled = false;
    btn.textContent = 'Save & Submit for Verification';
  }
}

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  await init();
})();
