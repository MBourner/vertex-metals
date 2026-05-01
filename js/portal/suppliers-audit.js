/**
 * Vertex Metals Portal — Record Supplier Audit
 * Handles portal/suppliers/audit.html
 */

function esc(s) { if (s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

const supplierId = new URLSearchParams(location.search).get('supplier_id');

async function init() {
  if (!supplierId) return;

  const { data: supplier } = await supabaseClient.from('contacts').select('company_name').eq('id', supplierId).single();
  if (supplier) {
    document.getElementById('supplier-name-display').textContent = supplier.company_name;
    document.title = `Audit — ${supplier.company_name} — Vertex Metals Portal`;
  }

  // Default audit date to today
  document.getElementById('f-audit-date').value = new Date().toISOString().split('T')[0];
  // Default next audit due to 1 year from today
  const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1);
  document.getElementById('f-next-audit-due').value = nextYear.toISOString().split('T')[0];

  // Show/hide conditions field based on outcome
  document.getElementById('f-outcome').addEventListener('change', function () {
    document.getElementById('conditions-group').style.display =
      this.value === 'approved_with_conditions' ? 'block' : 'none';
  });
}

async function submitAudit(e) {
  e.preventDefault();
  const btn   = document.getElementById('submit-btn');
  const errEl = document.getElementById('form-error');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const outcome       = document.getElementById('f-outcome').value;
  const nextAuditDate = document.getElementById('f-next-audit-due').value;
  const auditFile     = document.getElementById('f-audit-report').files[0] || null;

  try {
    // Upload audit report if provided
    let reportPath = null;
    if (auditFile) {
      const path = `supplier-audits/${supplierId}/${Date.now()}-${auditFile.name}`;
      const { error: uploadErr } = await supabaseClient.storage.from('order-documents').upload(path, auditFile);
      if (!uploadErr) reportPath = path;
    }

    // Insert audit record
    const { data: audit, error: auditErr } = await supabaseClient.from('supplier_audits').insert({
      supplier_id:        supplierId,
      audit_date:         document.getElementById('f-audit-date').value,
      audit_type:         document.getElementById('f-audit-type').value,
      auditor_name:       document.getElementById('f-auditor-name').value.trim(),
      outcome,
      conditions:         document.getElementById('f-conditions').value.trim() || null,
      next_audit_due_date: nextAuditDate,
      audit_report_path:  reportPath,
      notes:              document.getElementById('f-notes').value.trim() || null,
    }).select().single();

    if (auditErr) throw new Error(auditErr.message);

    // Update the supplier contact record
    const contactUpdate = {
      next_audit_due_date: nextAuditDate,
      approval_status: outcome === 'approved' || outcome === 'approved_with_conditions'
        ? 'approved'
        : 'prospect', // not_approved → revert to prospect for re-assessment
    };

    if (outcome === 'approved' || outcome === 'approved_with_conditions') {
      contactUpdate.approved_at = new Date().toISOString();
      contactUpdate.approved_by = PortalRoles.getUserId();
    }

    const { error: contactErr } = await supabaseClient.from('contacts').update(contactUpdate).eq('id', supplierId);
    if (contactErr) throw new Error(contactErr.message);

    // Redirect back to supplier detail
    window.location.href = `detail.html?id=${supplierId}`;

  } catch (err) {
    errEl.textContent = err.message;
    btn.disabled = false;
    btn.textContent = 'Save Audit Record';
  }
}

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) document.getElementById('user-email').textContent = user?.email || '';
  await init();
})();
