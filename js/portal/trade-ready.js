/**
 * Vertex Metals Portal — Stage 3 (Trade Ready Sign-off)
 * Handles portal/suppliers/trade-ready.html
 *
 * Captures final commercial terms (accepted/default currency, payment terms,
 * incoterm), confirms a current DPA is on file, and runs the final sign-off
 * checklist before advancing workflow_stage to 'trade_ready'.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

const params       = new URLSearchParams(location.search);
const supplierId   = params.get('supplier_id');
const onboardingId = params.get('onboarding_id');

const CURRENCIES = ['USD', 'GBP', 'EUR', 'INR', 'CNY', 'AED'];

// ── State ────────────────────────────────────────────────────────────────

let contact = null;
let onboarding = null;
let dpaOnFile = false;

// ── Icon helpers ─────────────────────────────────────────────────────────

function passIcon() {
  return `<div class="check-icon pass">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
  </div>`;
}
function failIcon() {
  return `<div class="check-icon fail">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </div>`;
}

// ── Header: progress bar + stage badge ──────────────────────────────────

function renderHeader() {
  document.getElementById('progress-bar').innerHTML = OnboardingWorkflow.renderProgressSteps(onboarding.workflow_stage);

  const stageBadge = OnboardingWorkflow.stageBadgeClass(onboarding.workflow_stage);
  const stageText  = OnboardingWorkflow.stageLabel(onboarding.workflow_stage);
  document.getElementById('stage-badge').innerHTML = `<span class="badge ${stageBadge}">${esc(stageText)}</span>`;
}

// ── Commercial Terms ─────────────────────────────────────────────────────

function renderCurrencies() {
  const el = document.getElementById('tr-currencies');
  el.innerHTML = CURRENCIES.map(c => `
    <label class="currency-chip">
      <input type="checkbox" class="tr-currency-check" value="${c}" style="accent-color:var(--color-accent)" ${contact.accepted_currencies?.includes(c) ? 'checked' : ''} /> ${c}
    </label>`).join('');
  el.querySelectorAll('.tr-currency-check').forEach(cb => cb.addEventListener('change', updateDefaultCurrencyOptions));
  updateDefaultCurrencyOptions();
}

function updateDefaultCurrencyOptions() {
  const checked = Array.from(document.querySelectorAll('.tr-currency-check:checked')).map(cb => cb.value);
  const sel = document.getElementById('tr-default-currency');
  const current = sel.value || contact.default_currency || '';
  sel.innerHTML = checked.length
    ? checked.map(c => `<option value="${c}">${c}</option>`).join('')
    : '<option value="">Select an accepted currency first…</option>';
  if (checked.includes(current)) sel.value = current;
}

function loadCommercialTerms() {
  if (contact.payment_terms_initial)    document.getElementById('tr-payment-initial').value = contact.payment_terms_initial;
  if (contact.payment_terms_subsequent) document.getElementById('tr-payment-subsequent').value = contact.payment_terms_subsequent;
  if (contact.standard_incoterm)        document.getElementById('tr-incoterm').value = contact.standard_incoterm;
}

async function submitCommercialTerms() {
  const btn = document.getElementById('commercial-save-btn');
  const statusEl = document.getElementById('commercial-status');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const accepted = Array.from(document.querySelectorAll('.tr-currency-check:checked')).map(cb => cb.value);
  const payload = {
    accepted_currencies:      accepted.length ? accepted : null,
    default_currency:         document.getElementById('tr-default-currency').value || null,
    payment_terms_initial:    document.getElementById('tr-payment-initial').value.trim() || null,
    payment_terms_subsequent: document.getElementById('tr-payment-subsequent').value.trim() || null,
    standard_incoterm:        document.getElementById('tr-incoterm').value || null,
  };

  const { error } = await supabaseClient.from('contacts').update(payload).eq('id', contact.id);

  if (error) {
    statusEl.style.color = 'var(--color-danger)';
    statusEl.textContent = error.message;
  } else {
    Object.assign(contact, payload);
    statusEl.style.color = 'var(--color-success)';
    statusEl.textContent = 'Saved.';
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
    renderSignoff();
  }

  btn.disabled = false;
  btn.textContent = 'Save Commercial Terms';
}

// ── DPA Document ─────────────────────────────────────────────────────────

async function loadDpa() {
  const { data } = await supabaseClient
    .from('supplier_documents')
    .select('*')
    .eq('onboarding_id', onboardingId)
    .eq('document_type', 'dpa')
    .order('uploaded_at', { ascending: false });

  const latest = data?.[0] || null;
  dpaOnFile = !!data?.some(d => d.is_current);
  renderDpaSection(latest);
}

function renderDpaSection(latest) {
  const badgeEl = document.getElementById('dpa-status-badge');
  badgeEl.innerHTML = dpaOnFile
    ? '<span class="badge badge-success">On file</span>'
    : '<span class="badge badge-danger">Required</span>';

  const el = document.getElementById('dpa-section');
  const docsLink = `documents.html?supplier_id=${esc(supplierId)}&onboarding_id=${esc(onboardingId)}`;

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
    <div class="check-item" style="background:${dpaOnFile ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)'}">
      ${dpaOnFile ? passIcon() : failIcon()}
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
      <a href="${docsLink}" class="btn btn-ghost btn-sm" style="border:1px solid var(--color-border)">${dpaOnFile ? 'Manage Documents →' : 'Upload DPA →'}</a>
    </div>`;
}

// ── Final Sign-off ───────────────────────────────────────────────────────

function renderSignoff() {
  const items = [
    { ok: onboarding.workflow_stage === 'stage2_complete', label: 'Stage 2 must be complete before final sign-off' },
    { ok: !!contact.accepted_currencies?.length,           label: 'At least one accepted currency selected' },
    { ok: !!contact.default_currency,                      label: 'A default currency selected' },
    { ok: !!contact.payment_terms_initial?.trim(),         label: 'Initial payment terms recorded' },
    { ok: !!contact.payment_terms_subsequent?.trim(),       label: 'Subsequent payment terms recorded' },
    { ok: !!contact.standard_incoterm,                     label: 'A standard incoterm selected' },
    { ok: dpaOnFile,                                        label: 'A current Data Processing Agreement (DPA) is on file' },
  ];

  document.getElementById('signoff-checklist').innerHTML = items.map(item => `
    <div class="check-item" style="background:${item.ok ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)'}">
      ${item.ok ? passIcon() : failIcon()}
      <div style="flex:1;font-size:var(--text-sm);padding-top:2px">${esc(item.label)}</div>
    </div>`).join('');

  document.getElementById('trade-ready-btn').disabled = !items.every(i => i.ok);
}

async function submitMarkTradeReady() {
  const errEl = document.getElementById('tr-error');
  errEl.style.display = 'none';

  const btn = document.getElementById('trade-ready-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const result = await OnboardingWorkflow.advanceStage(onboardingId, 'trade_ready');
  if (!result.ok) {
    errEl.innerHTML = '<strong>Cannot mark Trade Ready yet:</strong>' + OnboardingWorkflow.renderBlockers(result.blockers);
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Mark Trade Ready →';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  location.href = `detail.html?id=${contact.id}`;
}

// ── Init ──────────────────────────────────────────────────────────────────

(async () => {
  if (!supplierId || !onboardingId) {
    document.body.innerHTML = '<p style="padding:2rem;color:var(--color-danger)">Missing supplier_id or onboarding_id in URL.</p>';
    return;
  }

  await getCurrentUser();

  const { data: c } = await supabaseClient.from('contacts').select('*').eq('id', supplierId).single();
  if (!c) { document.body.innerHTML = '<p style="padding:2rem;color:var(--color-danger)">Supplier not found.</p>'; return; }
  contact = c;

  const { data: ob } = await supabaseClient.from('supplier_onboarding').select('*').eq('id', onboardingId).single();
  if (!ob) { document.body.innerHTML = '<p style="padding:2rem;color:var(--color-danger)">Onboarding record not found.</p>'; return; }
  onboarding = ob;

  document.getElementById('topbar-title').textContent = `Stage 3 — Trade Ready Sign-off — ${contact.company_name}`;
  document.title = `Stage 3 — ${contact.company_name} — Vertex Metals Portal`;
  document.getElementById('back-link').href = `detail.html?id=${contact.id}`;
  document.getElementById('cancel-link').href = `detail.html?id=${contact.id}`;

  renderHeader();
  renderCurrencies();
  loadCommercialTerms();
  await loadDpa();
  renderSignoff();

  document.getElementById('commercial-save-btn').addEventListener('click', submitCommercialTerms);
  document.getElementById('trade-ready-btn').addEventListener('click', submitMarkTradeReady);
})();
