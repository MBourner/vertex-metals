/**
 * Vertex Metals Portal — State Machine Client
 *
 * Wraps the three Supabase RPC functions that drive order state transitions.
 * Also provides UI helpers (badge rendering, allowed-transition lookup) used
 * by order-related pages.
 *
 * Depends on: supabase-client.js, auth-roles.js
 *
 * All mutating calls go through the SECURITY DEFINER Postgres functions,
 * which enforce allowed transitions, four-eyes constraints, and audit logging.
 * The client never writes directly to trades.current_state.
 *
 * Usage:
 *   const result = await StateMachine.transition(tradeId, 'quoted', { notes: '...' });
 *   if (!result.ok) showError(result.error);
 *
 *   const result = await StateMachine.decide(queueItemId, 'approved', { notes: '...' });
 *
 *   const allowed = await StateMachine.getAllowedTransitions('order_drafted');
 */

const StateMachine = (() => {

  // ── Badge colour map (one entry per state) ─────────────────────────────────
  // Colours convey lane: info=sales, accent=procurement, warning=quality/pending,
  // success=finance/complete, danger=blocked/non-conforming, neutral=terminal.
  const _BADGE_CLASS = {
    enquiry_received:      'badge-info',
    quoted:                'badge-info',
    quote_accepted:        'badge-info',
    po_received:           'badge-info',
    order_drafted:         'badge-accent',
    order_verified:        'badge-accent',
    kyc_blocked:           'badge-danger',
    sanctions_blocked:     'badge-danger',
    supplier_po_drafted:   'badge-accent',
    supplier_po_approved:  'badge-accent',
    supplier_po_issued:    'badge-accent',
    awaiting_supplier_docs:'badge-warning',
    docs_under_review:     'badge-warning',
    non_conforming:        'badge-danger',
    concession_requested:  'badge-warning',
    concession_granted:    'badge-warning',
    concession_declined:   'badge-danger',
    awaiting_rework:       'badge-warning',
    release_approved:      'badge-success',
    in_transit:            'badge-info',
    delivered:             'badge-success',
    dispute_open:          'badge-danger',
    invoice_drafted:       'badge-info',
    invoice_issued:        'badge-info',
    customer_paid:         'badge-success',
    supplier_paid:         'badge-success',
    complete:              'badge-success',
    cancelled:             'badge-neutral',
  };

  // Reference data cached after first load
  let _states      = null; // { code → state row }
  let _transitions = null; // array of transition rows

  // Private HTML-escape (avoids dependency on page-level esc())
  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Reference data ─────────────────────────────────────────────────────────

  /**
   * Fetches order_states and order_state_transitions from Supabase and caches
   * them for the session. Subsequent calls return immediately.
   */
  async function loadReference() {
    if (_states && _transitions) return;

    const [statesRes, transitionsRes] = await Promise.all([
      supabaseClient.from('order_states').select('*'),
      supabaseClient.from('order_state_transitions').select('*'),
    ]);

    _states = Object.fromEntries(
      (statesRes.data || []).map(s => [s.code, s])
    );
    _transitions = transitionsRes.data || [];
  }

  /**
   * Returns the allowed next states from a given current state,
   * filtered to transitions the current user is permitted to trigger.
   *
   * Each entry: { toState, displayName, requiresApproval, requiredRole, isSystemTriggered }
   *
   * System-triggered transitions are excluded — they happen automatically.
   * Transitions that require a role the user does not hold are excluded.
   */
  async function getAllowedTransitions(fromState) {
    await loadReference();

    return _transitions
      .filter(t =>
        t.from_state === fromState &&
        !t.is_system_triggered &&
        (!t.required_role || PortalRoles.hasRole(t.required_role))
      )
      .map(t => ({
        toState:           t.to_state,
        displayName:       _states[t.to_state]?.display_name || t.to_state,
        requiresApproval:  t.requires_approval,
        requiredRole:      t.required_role,
        isSystemTriggered: t.is_system_triggered,
      }));
  }

  /**
   * Returns the display name for a state code.
   * Falls back to the code itself if reference data is not yet loaded.
   */
  function stateDisplayName(code) {
    return _states?.[code]?.display_name || (code ? code.replace(/_/g, ' ') : '—');
  }

  /**
   * Returns an HTML badge element for a state code.
   * Safe to call before loadReference() — will fall back to the code string.
   */
  function stateBadge(code) {
    const label = _states?.[code]?.display_name || (code ? code.replace(/_/g, ' ') : '—');
    const cls   = _BADGE_CLASS[code] || 'badge-neutral';
    return `<span class="badge ${cls}">${_esc(label)}</span>`;
  }

  // ── Mutating RPC calls ──────────────────────────────────────────────────────

  /**
   * Advance an order to a new state.
   *
   * @param {string} tradeId   - UUID of the trade
   * @param {string} toState   - target state code
   * @param {object} opts
   *   actorRole   {string}  - role the actor is acting in (defaults to first role held)
   *   reasonCode  {string}  - from reason_codes table; required for some transitions
   *   notes       {string}  - free text
   *   evidenceRef {string}  - pointer to a document or email
   *   priority    {string}  - 'routine' (default) or 'expedite'
   *
   * @returns {object} { ok: true, from_state, to_state }
   *                or { ok: false, error: string }
   */
  async function transition(tradeId, toState, opts = {}) {
    const actorId   = PortalRoles.getUserId();
    const actorRole = opts.actorRole || PortalRoles.getRoles()[0] || null;

    const { data, error } = await supabaseClient.rpc('transition_order_state', {
      p_trade_id:     tradeId,
      p_to_state:     toState,
      p_actor_id:     actorId,
      p_actor_role:   actorRole,
      p_reason_code:  opts.reasonCode  || null,
      p_notes:        opts.notes       || null,
      p_evidence_ref: opts.evidenceRef || null,
      p_priority:     opts.priority    || 'routine',
    });

    if (error) return { ok: false, error: error.message };
    return data; // { ok, from_state, to_state } or { ok: false, error }
  }

  /**
   * Approve or reject a verification queue item.
   *
   * @param {string} queueItemId - UUID of the verification_queue row
   * @param {string} decision    - 'approved' or 'rejected'
   * @param {object} opts
   *   actorRole   {string}
   *   reasonCode  {string}
   *   notes       {string}
   *
   * @returns {object} { ok: true, decision }
   *                or { ok: false, error: string }
   */
  async function decide(queueItemId, decision, opts = {}) {
    const actorId   = PortalRoles.getUserId();
    const actorRole = opts.actorRole || PortalRoles.getRoles()[0] || null;

    const { data, error } = await supabaseClient.rpc('decide_verification_queue_item', {
      p_queue_item_id: queueItemId,
      p_decision:      decision,
      p_actor_id:      actorId,
      p_actor_role:    actorRole,
      p_reason_code:   opts.reasonCode || null,
      p_notes:         opts.notes      || null,
    });

    if (error) return { ok: false, error: error.message };
    return data;
  }

  /**
   * Request release approval from the document review screen.
   * State stays at docs_under_review; an approver must decide via the queue.
   *
   * @param {string} tradeId
   * @param {object} opts
   *   notes    {string}
   *   priority {string} 'routine' (default) or 'expedite'
   *
   * @returns {object} { ok: true } or { ok: false, error: string }
   */
  async function requestRelease(tradeId, opts = {}) {
    const actorId = PortalRoles.getUserId();

    const { data, error } = await supabaseClient.rpc('request_release_approval', {
      p_trade_id: tradeId,
      p_actor_id: actorId,
      p_notes:    opts.notes    || null,
      p_priority: opts.priority || 'routine',
    });

    if (error) return { ok: false, error: error.message };
    return data;
  }

  // ── Convenience: fetch order events for a trade ─────────────────────────────

  /**
   * Returns the full audit log for a trade, newest first.
   * Includes actor email via a join on auth.users (via user_roles table —
   * Supabase does not expose auth.users directly to the client, so we
   * return actor_id and actor_role; the page can enrich if needed).
   */
  async function getOrderEvents(tradeId) {
    const { data, error } = await supabaseClient
      .from('order_events')
      .select('id, created_at, event_type, from_state, to_state, actor_id, actor_role, reason_code, notes, evidence_ref')
      .eq('trade_id', tradeId)
      .order('created_at', { ascending: true });

    if (error) return { ok: false, error: error.message, data: [] };
    return { ok: true, data: data || [] };
  }

  /**
   * Returns all open/in-review verification queue items, ordered by SLA.
   * Used by the verification queue page and dashboard badge counts.
   *
   * @param {string} queueType - optional filter ('po_translation' etc.)
   */
  async function getPendingQueue(queueType) {
    let query = supabaseClient
      .from('verification_queue')
      .select(`
        id, created_at, trade_id, queue_type, drafted_by, priority, sla_due_at, status,
        trade:trades(reference, current_state,
          buyer:contacts!trades_buyer_id_fkey(company_name),
          supplier:contacts!trades_supplier_id_fkey(company_name))
      `)
      .in('status', ['pending', 'in_review'])
      .order('sla_due_at', { ascending: true });

    if (queueType) query = query.eq('queue_type', queueType);

    const { data, error } = await query;
    if (error) return { ok: false, error: error.message, data: [] };
    return { ok: true, data: data || [] };
  }

  // ── SLA helpers ─────────────────────────────────────────────────────────────

  /**
   * Returns 'overdue', 'soon' (within 1 hour), or 'ok' for a queue item.
   */
  function slaStatus(slaDueAt) {
    const due  = new Date(slaDueAt).getTime();
    const now  = Date.now();
    const diff = due - now;
    if (diff < 0)           return 'overdue';
    if (diff < 3600 * 1000) return 'soon';
    return 'ok';
  }

  /**
   * Returns an SLA badge HTML string.
   */
  function slaBadge(slaDueAt) {
    const status = slaStatus(slaDueAt);
    const due    = new Date(slaDueAt);
    const label  = due.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const cls    = status === 'overdue' ? 'badge-danger' : status === 'soon' ? 'badge-warning' : 'badge-neutral';
    return `<span class="badge ${cls}" title="${_esc(due.toISOString())}">${_esc(label)}</span>`;
  }

  /**
   * Human-readable queue type label.
   */
  function queueTypeLabel(type) {
    const map = {
      po_translation:       'PO Translation',
      supplier_po_approval: 'Supplier PO',
      release_approval:     'Release',
      invoice_review:       'Invoice Review',
    };
    return map[type] || type;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  return {
    // Reference
    loadReference,
    getAllowedTransitions,
    stateDisplayName,
    stateBadge,
    // Mutations
    transition,
    decide,
    requestRelease,
    // Queries
    getOrderEvents,
    getPendingQueue,
    // UI helpers
    slaStatus,
    slaBadge,
    queueTypeLabel,
  };
})();
