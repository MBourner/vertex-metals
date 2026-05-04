/**
 * Vertex Metals Ltd — Auth Helpers
 *
 * Wraps Supabase Auth for use across portal pages.
 * Depends on: supabase-client.js (must be loaded first)
 */

/**
 * Resolves a portal root-relative filename to a path that works regardless
 * of what subdirectory the site is hosted in (e.g. /vertex-metals/ on GitHub Pages).
 * Counts directory levels between the current page and the portal/ folder and
 * prefixes with the right number of ../ steps.
 */
function resolvePortalPath(page) {
  const parts = window.location.pathname.replace(/^\//, '').split('/').filter(Boolean);
  const portalIdx = parts.indexOf('portal');
  if (portalIdx === -1) return page; // fallback: same directory
  const dirsAfterPortal = parts.slice(portalIdx + 1, -1).length;
  return '../'.repeat(dirsAfterPortal) + page;
}

/**
 * Sign in with email and password.
 * On success redirects to portal/dashboard.html.
 * On failure returns the error object.
 */
async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return { error };
  window.location.href = resolvePortalPath('dashboard.html');
  return { data };
}

/**
 * Sign out the current user and redirect to login.
 */
async function signOut() {
  if (typeof PortalRoles !== 'undefined') PortalRoles.clear();
  await supabaseClient.auth.signOut();
  window.location.href = resolvePortalPath('login.html');
}

/**
 * Returns the current session, or null if not authenticated.
 */
async function getSession() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session;
}

/**
 * Returns the current user object, or null.
 */
async function getCurrentUser() {
  const session = await getSession();
  return session ? session.user : null;
}

/**
 * Checks for a valid session.
 * If none found, immediately redirects to /portal/login.html.
 * Call this at the top of every portal page script.
 *
 * Usage:
 *   await requireAuth();
 *   // rest of page logic
 */
async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.replace(resolvePortalPath('login.html'));
    // Throw to prevent any further code execution while redirect happens
    throw new Error('Unauthenticated — redirecting to login');
  }
  return session;
}
