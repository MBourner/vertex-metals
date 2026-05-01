/**
 * Vertex Metals Portal — Role Helpers
 *
 * Loads the current user's roles from the user_roles table and caches
 * them in sessionStorage for the duration of the session.
 *
 * Load order (every portal page):
 *   supabase-client.js → auth.js → auth-roles.js → portal-guard.js
 *
 * portal-guard.js calls PortalRoles.init() automatically after auth is
 * confirmed, so page scripts can call PortalRoles.hasRole() synchronously
 * without any additional await.
 *
 * Usage in page scripts:
 *   if (PortalRoles.hasRole('verifier')) { ... }
 *   if (PortalRoles.isDirector()) { ... }
 *   const roles = PortalRoles.getRoles();
 */

const PortalRoles = (() => {
  let _roles  = null;
  let _userId = null;
  let _initPromise = null;

  /**
   * Fetch roles from Supabase and cache them.
   * Idempotent — safe to call multiple times; subsequent calls resolve instantly.
   * Called automatically by portal-guard.js after auth is confirmed.
   */
  async function init() {
    if (_roles !== null) return;           // already loaded
    if (_initPromise) return _initPromise; // in-flight — await the same promise

    _initPromise = (async () => {
      const user = await getCurrentUser();
      if (!user) {
        _roles = [];
        return;
      }

      _userId = user.id;

      // Serve from sessionStorage if available (survives page navigations)
      const cacheKey = `vertex_roles_${user.id}`;
      const cached   = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          _roles = JSON.parse(cached);
          return;
        } catch {
          sessionStorage.removeItem(cacheKey);
        }
      }

      const { data, error } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) {
        console.warn('[PortalRoles] Failed to load roles:', error.message);
        _roles = [];
        return;
      }

      _roles = (data || []).map(r => r.role);
      sessionStorage.setItem(cacheKey, JSON.stringify(_roles));
    })();

    return _initPromise;
  }

  /**
   * Returns true if the current user holds the given role.
   * Directors implicitly hold all roles.
   */
  function hasRole(role) {
    if (!_roles) return false;
    return _roles.includes('director') || _roles.includes(role);
  }

  /** Returns the full array of role strings for the current user. */
  function getRoles() {
    return _roles ? [..._roles] : [];
  }

  /** Shorthand for hasRole('director'). */
  function isDirector() {
    return Array.isArray(_roles) && _roles.includes('director');
  }

  /** Returns the authenticated user's UUID. */
  function getUserId() {
    return _userId;
  }

  /**
   * Clears the role cache — call on sign-out so the next user starts fresh.
   * auth.js signOut() should call this before redirecting.
   */
  function clear() {
    if (_userId) sessionStorage.removeItem(`vertex_roles_${_userId}`);
    _roles       = null;
    _userId      = null;
    _initPromise = null;
  }

  return { init, hasRole, getRoles, isDirector, getUserId, clear };
})();
