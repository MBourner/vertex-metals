/**
 * Vertex Metals Portal — Dashboard
 * v3 KPIs: verification queue, transit, disputes, audits, blocks.
 */

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (h >= 24) return `${Math.floor(h/24)}d ago`;
  if (h >= 1)  return `${h}h ago`;
  if (m >= 1)  return `${m}m ago`;
  return 'just now';
}

// Colour a stat card value red or amber if threshold is met
function flagCard(cardId, count, colour) {
  if (count > 0) {
    const el = document.getElementById(cardId);
    if (el) el.style.borderTop = `3px solid ${colour}`;
    const val = el?.querySelector('.stat-card__value');
    if (val) val.style.color = colour;
  }
}

(async () => {
  const user = await getCurrentUser();
  if (document.getElementById('user-email')) {
    document.getElementById('user-email').textContent = user?.email || '';
  }

  await StateMachine.loadReference();

  const today   = new Date().toISOString().split('T')[0];
  const in30    = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const now     = new Date().toISOString();

  // ── KPI counts (parallel) ────────────────────────────────────────────────
  const [vqPending, vqOverdue, inTransit, disputesOpen, auditsDue, blocked] =
    await Promise.all([
      supabaseClient
        .from('verification_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),

      supabaseClient
        .from('verification_queue')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending','in_review'])
        .lt('sla_due_at', now),

      supabaseClient
        .from('trades')
        .select('id', { count: 'exact', head: true })
        .eq('current_state', 'in_transit'),

      supabaseClient
        .from('disputes')
        .select('id', { count: 'exact', head: true })
        .not('status', 'in', '("resolved","escalated")'),

      supabaseClient
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'supplier')
        .not('next_audit_due_date', 'is', null)
        .lte('next_audit_due_date', in30)
        .gte('next_audit_due_date', today),

      supabaseClient
        .from('trades')
        .select('id', { count: 'exact', head: true })
        .in('current_state', ['kyc_blocked','sanctions_blocked']),
    ]);

  document.getElementById('stat-vq-pending').textContent  = vqPending.count  ?? '—';
  document.getElementById('stat-vq-overdue').textContent  = vqOverdue.count  ?? '—';
  document.getElementById('stat-in-transit').textContent  = inTransit.count  ?? '—';
  document.getElementById('stat-disputes').textContent    = disputesOpen.count ?? '—';
  document.getElementById('stat-audits').textContent      = auditsDue.count   ?? '—';
  document.getElementById('stat-blocked').textContent     = blocked.count     ?? '—';

  // Flag cards red/amber when action is needed
  flagCard('card-vq-overdue', vqOverdue.count,  'var(--color-danger)');
  flagCard('card-disputes',   disputesOpen.count,'#d97706');
  flagCard('card-audits',     auditsDue.count,   '#d97706');
  flagCard('card-blocked',    blocked.count,     'var(--color-danger)');

  // ── Recent Activity ──────────────────────────────────────────────────────
  const { data: events } = await supabaseClient
    .from('order_events')
    .select(`
      id, created_at, event_type, from_state, to_state, actor_role, notes,
      trade:trades(id, reference)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  const activityEl = document.getElementById('recent-activity');
  if (!events || events.length === 0) {
    activityEl.innerHTML = '<div style="padding:var(--space-8);text-align:center;color:var(--color-text-muted);font-size:var(--text-sm)">No activity yet.</div>';
  } else {
    const typeClass = {
      state_change:'badge-info', approval:'badge-success', rejection:'badge-danger',
      override:'badge-danger', note:'badge-neutral',
      document_attached:'badge-neutral', concession_decision:'badge-warning',
    };
    activityEl.innerHTML = events.map(ev => {
      const label = ev.event_type?.replace('_',' ') || '—';
      const cls   = typeClass[ev.event_type] || 'badge-neutral';
      const ref   = ev.trade?.reference || ev.trade?.id?.slice(0,8) || '—';
      const tradeId = ev.trade?.id;
      const stateChange = ev.from_state && ev.to_state
        ? `${StateMachine.stateDisplayName(ev.from_state)} → ${StateMachine.stateDisplayName(ev.to_state)}`
        : ev.notes ? esc(ev.notes).slice(0, 60) : '';
      return `<div style="padding:var(--space-3) var(--space-5);border-bottom:1px solid var(--color-border);display:flex;gap:var(--space-3);align-items:flex-start">
        <span class="badge ${cls}" style="flex-shrink:0;font-size:10px;margin-top:2px">${esc(label)}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:var(--text-sm)">
            ${tradeId ? `<a href="orders/detail.html?id=${esc(tradeId)}" style="font-weight:600;color:var(--color-accent)">${esc(ref)}</a>` : `<strong>${esc(ref)}</strong>`}
            ${stateChange ? `<span style="color:var(--color-text-muted)"> — ${esc(stateChange)}</span>` : ''}
          </div>
          <div style="font-size:11px;color:var(--color-text-muted);margin-top:2px">
            ${ev.actor_role ? esc(ev.actor_role) + ' · ' : ''}${timeAgo(ev.created_at)}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Recent RFQs ──────────────────────────────────────────────────────────
  const { data: rfqs } = await supabaseClient
    .from('rfq_submissions')
    .select('id, created_at, company, product, counterparty_type, status')
    .order('created_at', { ascending: false })
    .limit(6);

  const rfqEl = document.getElementById('recent-rfqs');
  if (!rfqs || rfqs.length === 0) {
    rfqEl.innerHTML = '<div style="padding:var(--space-8);text-align:center;color:var(--color-text-muted);font-size:var(--text-sm)">No RFQs yet.</div>';
  } else {
    const statusClass = { new:'badge-accent', reviewing:'badge-info', responded:'badge-warning', closed:'badge-neutral' };
    rfqEl.innerHTML = `<div class="table-wrapper" style="border:none"><table><thead><tr><th>Company</th><th>Product</th><th>Type</th><th>Status</th></tr></thead><tbody>
      ${rfqs.map(r => `<tr onclick="location.href='rfq/detail.html?id=${r.id}'" style="cursor:pointer">
        <td><strong style="font-size:var(--text-sm)">${esc(r.company)}</strong><br><small style="color:var(--color-text-muted)">${new Date(r.created_at).toLocaleDateString('en-GB')}</small></td>
        <td style="font-size:var(--text-sm)">${esc(r.product || '—')}</td>
        <td><span class="badge badge-neutral">${esc(r.counterparty_type || '—')}</span></td>
        <td><span class="badge ${statusClass[r.status]||'badge-neutral'}">${esc(r.status)}</span></td>
      </tr>`).join('')}
    </tbody></table></div>`;
  }
})();
