/**
 * Vertex Metals Ltd — Portal Route Guard
 *
 * Include this script on EVERY portal page immediately after
 * supabase-client.js and auth.js. It checks for a valid session
 * and redirects unauthenticated users to login before any page
 * content is rendered.
 *
 * Load order in every portal HTML page:
 *   <script src="/js/supabase-client.js"></script>
 *   <script src="/js/auth.js"></script>
 *   <script src="/js/portal/auth-roles.js"></script>
 *   <script src="/js/portal-guard.js"></script>
 *   <script src="/js/portal/state-machine.js"></script>
 *   <!-- page-specific script last -->
 *
 * The body should have visibility:hidden until auth is confirmed.
 */

(async function guard() {
  // Hide body until auth confirmed to prevent flash of protected content
  document.body.style.visibility = 'hidden';

  try {
    await requireAuth();
    // Only init roles if auth-roles.js is loaded (new pages only — old pages safe to omit it)
    if (typeof PortalRoles !== 'undefined') {
      await PortalRoles.init();
      const roles   = PortalRoles.getRoles();
      const roleEl  = document.getElementById('user-role');
      if (roleEl) {
        const label = roles.length
          ? roles.map(r => r.charAt(0).toUpperCase() + r.slice(1).replace(/_/g,' ')).join(', ')
          : 'Director'; // fallback if user_roles table not yet populated
        roleEl.textContent = label;
      }
    }
    document.body.style.visibility = 'visible';
  } catch {
    // requireAuth() already redirects — keep body hidden
  }
})();
