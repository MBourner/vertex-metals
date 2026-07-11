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

  // Portal build version — keep in sync with DEVELOPMENT.md "Current Version".
  const PORTAL_VERSION = 'v0.7.0';

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
    'customers/dashboard.html',
    'customers/index.html',
    'leads/index.html',
    'contacts/index.html',
    'suppliers/index.html',
    'suppliers/onboarding-pipeline.html',
    'suppliers/expiry-monitor.html',
    'product-lines/index.html',
    'product-lines/reviews.html',
    'sales/index.html',
    'rfq/index.html',
    'quotes/calculator.html',
    'customer-pos/index.html',
    'orders/supplier-po.html',
    'quotes/index.html',
    'orders/index.html',
    'verification-queue/index.html',
    'enquiries/index.html',
    'metrics/index.html',
    'disputes/index.html',
    'concessions/index.html',
    'logistics-quotes/index.html',
    'cbam/index.html',
    'financials/index.html',
    'kyc/index.html',
    'sanctions/log.html',
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

  // Section label that also acts as a link to a section landing page.
  function secLink(href, label) {
    const cls = isActive(href) ? 'sidebar-section-label sidebar-section-link active' : 'sidebar-section-label sidebar-section-link';
    return `<a href="${p}${href}" class="${cls}" style="margin-top:var(--space-4)">${label}</a>`;
  }

  // Placeholder for sub-pages that don't exist yet — shown but not clickable.
  function soon(label) {
    return `<span class="sidebar-link sidebar-link-soon">${label}<span class="sidebar-link-soon-badge">Soon</span></span>`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const el = document.getElementById('sidebar');
  if (!el) return;

  el.innerHTML = `
    <div class="sidebar-logo">
      <img src="${lp}assets/images/logo/vertex-logo-transparent.png" alt="" />
      <div>
        <div class="sidebar-logo-text">Vertex Metals</div>
        <div class="sidebar-logo-sub">Internal Portal</div>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div class="sidebar-section-label">Dashboard</div>
      ${a('dashboard.html',                 'Dashboard')}

      ${secLink('customers/dashboard.html',    'Customer')}
      ${a('customers/index.html',           'Customers')}
      ${a('leads/index.html',               'Leads Hub')}
      ${soon('Customer History')}

      ${sec('Supplier')}
      ${a('suppliers/index.html',              'Supplier Details')}
      ${a('suppliers/onboarding-pipeline.html','Supplier Onboarding')}
      ${a('enquiries/index.html',          'Enquiry Queue')}
      ${soon('Supplier Order History')}

      ${sec('Products')}
      ${a('product-lines/index.html',      'Product Details')}
      ${a('product-lines/reviews.html',    'Product Reviews')}

      ${secLink('sales/index.html',        'Sales')}
      ${a('rfq/index.html',                'RFQ / Estimate')}
      ${a('quotes/calculator.html',        'Pricing Calculator')}
      ${a('customer-pos/index.html',       'Customer Purchase Orders')}
      ${soon('Quotes Tracking')}

      ${sec('Purchasing')}
      ${a('orders/supplier-po.html',       'Purchase Orders')}
      ${a('quotes/index.html',             'Purchase Tracking')}

      ${sec('Operations')}
      ${a('orders/index.html',             'Orders')}
      ${a('verification-queue/index.html', 'Verification Queue')}
      ${a('metrics/index.html',            'Metrics')}

      ${sec('Quality')}
      ${a('disputes/index.html',           'Disputes')}
      ${a('concessions/index.html',        'Concessions')}

      ${sec('Logistics')}
      ${a('logistics-quotes/index.html',   'Logistics Quotes')}

      ${sec('Finance')}
      ${a('financials/index.html',         'Financials')}

      ${sec('Compliance')}
      ${a('kyc/index.html',                'KYC Records')}
      ${a('sanctions/log.html',            'Sanctions Log')}
      ${a('cbam/index.html',               'CBAM Tracker')}
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
      <div style="text-align:center;font-size:var(--text-xs);color:var(--color-text-muted);
        margin-top:var(--space-1);opacity:.5">${PORTAL_VERSION}</div>
    </div>
  `;

})();
