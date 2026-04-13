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
 *   <script src="/js/portal-guard.js"></script>
 *   <!-- page-specific script last -->
 *
 * The body should have visibility:hidden until auth is confirmed.
 */

(async function guard() {
  // Hide body until auth confirmed to prevent flash of protected content
  document.body.style.visibility = 'hidden';

  try {
    await requireAuth();
    // Auth confirmed — show page
    document.body.style.visibility = 'visible';
  } catch {
    // requireAuth() already redirects — keep body hidden
  }
})();
