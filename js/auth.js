/**
 * Vertex Metals Ltd — Auth Helpers
 *
 * Wraps Supabase Auth for use across portal pages.
 * Depends on: supabase-client.js (must be loaded first)
 */

/**
 * Sign in with email and password.
 * On success redirects to portal/dashboard.html.
 * On failure returns the error object.
 */
async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return { error };
  window.location.href = '/portal/dashboard.html';
  return { data };
}

/**
 * Sign out the current user and redirect to login.
 */
async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.href = '/portal/login.html';
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
    window.location.replace('/portal/login.html');
    // Throw to prevent any further code execution while redirect happens
    throw new Error('Unauthenticated — redirecting to login');
  }
  return session;
}
