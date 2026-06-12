/**
 * Vertex Metals Portal — Customer Purchase Orders (placeholder)
 */

(async () => {
  const user = await getCurrentUser();
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user?.email || '';
})();
