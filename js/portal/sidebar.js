/**
 * Vertex Metals Portal — Sidebar
 *
 * Single source of truth for portal navigation.
 * Generates the sidebar HTML and injects it into #sidebar.
 * Active link is detected automatically from window.location.pathname —
 * no per-page hardcoding required.
 *
 * To use on any portal page:
 *   1. Replace the full <aside class="sidebar" id="sidebar">...</aside>
 *      block with the empty placeholder:
 *        <aside class="sidebar" id="sidebar"></aside>
 *   2. Add this script to the page's script list, before portal-guard.js:
 *        <script src="[path]/js/portal/sidebar.js"></script>
 *
 * Adding a new nav item: edit this file only.
 */

(function () {

  // ── Path depth ────────────────────────────────────────────────────────────
  // Work out how many directory levels the current page sits below portal/
  // so all links and asset paths use the correct relative prefix.

  const path     = window.location.pathname;
  const parts    = path.split('/').filter(Boolean);
  const portalIdx = parts.indexOf('portal');

  // Number of subdirectory levels inside portal/ (0 for portal/dashboard.html,
  // 1 for portal/orders/index.html, etc.)
  const depth = portalIdx !== -1 ? parts.slice(portalIdx + 1, -1).length : 0;

  // p  = prefix to reach portal/ root  ('', '../', '../../', …)
  // lp = prefix to reach site root     ('../', '../../', …)
  const p  = '../'.repeat(depth);
  const lp = '../'.repeat(depth + 1);

  // ── Active link detection ─────────────────────────────────────────────────
  // All portal-relative hrefs that appear in the nav.
  // Used to decide whether the current page has a direct nav entry or is
  // a sub-page that should highlight its parent section link.

  const NAV_HREFS = [
    'dashboard.html',
    'financials/index.html',
    'metrics/index.html',
    'orders/index.html',
    'verification-queue/index.html',
    'rfq/index.html',
    'quotes/index.html',
    'logistics-quotes/index.html',
    'product-lines/index.html',
    'suppliers/index.html',
    'kyc/index.html',
    'contacts/index.html',
    'sanctions/log.html',
    'cbam/index.html',
    'disputes/index.html',
    'concessions/index.html',
    'quotes/calculator.html',
  ];

  // Portal-relative path of the current page (e.g. 'orders/detail.html')
  const key = portalIdx !== -1 ? parts.slice(portalIdx + 1).join('/') : '';

  // True when the current page has an exact entry in the nav
  const hasExact = NAV_HREFS.includes(key);

  function isActive(href) {
    // Exact match (e.g. 'dashboard.html' or 'quotes/calculator.html')
    if (key === href) return true;

    // Sub-page match: a page not in the nav highlights its section's index link.
    // e.g. 'orders/supplier-po.html' → highlights 'orders/index.html'
    // But only when no exact match exists (prevents 'quotes/calculator.html'
    // from also activating 'quotes/index.html').
    if (!hasExact && href.endsWith('/index.html')) {
      const linkSection = href.replace('/index.html', '');
      const keySection  = key.split('/')[0];
      if (linkSection === keySection) return true;
    }

    return false;
  }

  function a(href, label) {
    const cls = isActive(href) ? 'sidebar-link active' : 'sidebar-link';
    return `<a href="${p}${href}" class="${cls}">${label}</a>`;
  }

  function sec(label) {
    return `<div class="sidebar-section-label" style="margin-top:var(--space-4)">${label}</div>`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const el = document.getElementById('sidebar');
  if (!el) return;

  el.innerHTML = `
    <div class="sidebar-logo">
      <img src="${lp}assets/images/logo/vertex-metals-logo.jpg" alt="" />
      <div>
        <div class="sidebar-logo-text">Vertex Metals</div>
        <div class="sidebar-logo-sub">Internal Portal</div>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div class="sidebar-section-label">Overview</div>
      ${a('dashboard.html',                 'Dashboard')}
      ${a('financials/index.html',          'Financials')}
      ${a('metrics/index.html',             'Metrics')}

      ${sec('Operations')}
      ${a('orders/index.html',             'Orders')}
      ${a('verification-queue/index.html', 'Verification Queue')}
      ${a('rfq/index.html',                'RFQs')}
      ${a('quotes/index.html',             'Supplier Quotes')}
      ${a('logistics-quotes/index.html',   'Logistics Quotes')}
      ${a('product-lines/index.html',      'Product Lines')}

      ${sec('Suppliers')}
      ${a('suppliers/index.html',          'Supplier Register')}

      ${sec('Compliance')}
      ${a('kyc/index.html',                'KYC Records')}
      ${a('contacts/index.html',           'Contacts')}
      ${a('sanctions/log.html',            'Sanctions Log')}
      ${a('cbam/index.html',               'CBAM Tracker')}

      ${sec('Post-Trade')}
      ${a('disputes/index.html',           'Disputes')}
      ${a('concessions/index.html',        'Concessions')}

      ${sec('Tools')}
      ${a('quotes/calculator.html',        'Pricing Calculator')}
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="sidebar-user-email" id="user-email">Loading...</div>
        <div class="sidebar-user-role" id="user-role">—</div>
      </div>
      <button onclick="signOut()" class="btn btn-ghost btn-sm"
        style="width:100%;justify-content:center">Sign Out</button>
      <div style="text-align:center;font-size:var(--text-xs);color:var(--color-text-muted);
        margin-top:var(--space-4);opacity:.5">Built by Vector Business Solutions</div>
    </div>
  `;

})();
