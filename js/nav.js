/**
 * Vertex Metals — Public Site Navigation
 *
 * Single source of truth for the top nav across all public pages.
 * Generates the nav + mobile nav HTML and injects it into #site-nav.
 * Active link and relative path depth are both detected automatically
 * from window.location.pathname — no per-page hardcoding required.
 *
 * To use on any public page:
 *   1. Replace the <nav>...</nav> and following <div class="nav-mobile">
 *      block with a single empty placeholder:
 *        <div id="site-nav"></div>
 *   2. Add this script right after the placeholder:
 *        <script src="[path-to-root]js/nav.js"></script>
 *
 * Adding/removing a nav link: edit LINKS below only.
 */
(function () {

  const LINKS = [
    { href: 'products.html',       label: 'Products' },
    { href: 'industries.html',     label: 'Sectors' },
    { href: 'sustainability.html', label: 'Sustainability' },
    { href: 'about.html',          label: 'About' },
    { href: 'compliance.html',     label: 'Compliance' },
    { href: 'partners.html',       label: 'Partners' },
  ];

  // ── Path depth ────────────────────────────────────────────────────────────
  // Work out how many directory levels the current page sits below the site
  // root, so all links and asset paths use the correct relative prefix.
  const parts = window.location.pathname.split('/').filter(Boolean);
  const file  = parts[parts.length - 1] || 'index.html';
  const depth = Math.max(parts.length - 1, 0);
  const p     = '../'.repeat(depth); // prefix to reach site root

  // Product detail pages (products/*.html) don't have their own nav entry —
  // they belong under "Products".
  const activeHref = parts[0] === 'products' && parts.length > 1 ? 'products.html' : file;

  const navLinks = LINKS.map(l =>
    `<li><a href="${p}${l.href}"${l.href === activeHref ? ' class="active"' : ''}>${l.label}</a></li>`
  ).join('\n      ');

  const mobileLinks = LINKS.map(l => `<a href="${p}${l.href}">${l.label}</a>`).join('\n  ');

  const html = `
<nav class="nav" id="nav">
  <div class="nav-inner">
    <a href="${p}index.html" class="nav-logo" aria-label="Vertex Metals home">
      <img src="${p}assets/images/logo/vertex-logo-transparent.png" alt="Vertex Metals" />
      <span class="nav-logo-text">Vertex Metals</span>
    </a>
    <ul class="nav-links" role="list">
      ${navLinks}
    </ul>
    <a href="${p}contact.html" class="btn btn-primary nav-cta btn-sm">Submit Enquiry</a>
    <button class="nav-hamburger" id="hamburger" aria-label="Toggle menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>
<div class="nav-mobile" id="nav-mobile" role="navigation" aria-label="Mobile navigation">
  ${mobileLinks}
  <a href="${p}contact.html" class="btn btn-primary">Submit Enquiry</a>
</div>`;

  const mount = document.getElementById('site-nav');
  if (!mount) return;
  mount.outerHTML = html;

  // ── Behaviour ─────────────────────────────────────────────────────────────
  // Every page has a dark hero directly under the nav (hero-video on the
  // homepage, page-hero elsewhere), so the nav starts transparent over it and
  // solidifies once the page scrolls past the hero — universal, not just home.
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 24);
  }, { passive: true });
  nav.classList.toggle('scrolled', window.scrollY > 24); // correct state on load if not at top (e.g. back-navigation)

  const hamburger = document.getElementById('hamburger');
  const navMobile = document.getElementById('nav-mobile');
  hamburger.addEventListener('click', () => {
    const open = navMobile.classList.toggle('open');
    hamburger.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
  });
})();
