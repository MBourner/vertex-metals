/**
 * Vertex Metals — Public Site Footer
 *
 * Single source of truth for the footer across all public pages.
 * Generates the footer HTML and injects it into #site-footer.
 * Relative path depth is detected automatically from
 * window.location.pathname — no per-page hardcoding required.
 *
 * To use on any public page:
 *   1. Replace the <footer class="footer">...</footer> block with a single
 *      empty placeholder:
 *        <div id="site-footer"></div>
 *   2. Add this script right after the placeholder:
 *        <script src="[path-to-root]js/footer.js"></script>
 *
 * Editing footer content/links: edit this file only.
 */
(function () {

  const parts = window.location.pathname.split('/').filter(Boolean);
  const depth = Math.max(parts.length - 1, 0);
  const p     = '../'.repeat(depth); // prefix to reach site root

  const html = `
<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="${p}index.html" class="nav-logo">
          <img src="${p}assets/images/logo/vertex-logo-transparent.png" alt="Vertex Metals" />
          <span class="nav-logo-text">Vertex Metals</span>
        </a>
        <p>A global sourcer of critical metals and minerals to the UK. Utilising responsible and vetted mills around the world, trust us to keep your supply chain moving efficiently.</p>
        <div style="margin-top:var(--space-6)">
          <address style="font-style:normal;font-size:var(--text-sm);color:rgba(255,255,255,0.4);line-height:1.8">
            No 3 Falcon Cliff<br>
            9–10 Palace Road, Douglas<br>
            Isle of Man, IM2 4LD
          </address>
          <a href="mailto:sales@vertexmetalsltd.com" style="display:block;margin-top:var(--space-3);font-size:var(--text-sm);color:rgba(255,255,255,0.4);transition:color var(--transition)" onmouseover="this.style.color='var(--color-accent)'" onmouseout="this.style.color='rgba(255,255,255,0.4)'">sales@vertexmetalsltd.com</a>
        </div>
      </div>
      <div class="footer-col">
        <h4>Products &amp; Sectors</h4>
        <a href="${p}products.html">All Products</a>
        <a href="${p}products.html#aluminium">Aluminium Alloys</a>
        <a href="${p}products.html#copper">Copper &amp; Products</a>
        <a href="${p}products.html#stainless">Stainless Steel</a>
        <a href="${p}industries.html">Industries We Serve</a>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <a href="${p}about.html">About Us</a>
        <a href="${p}sustainability.html">Sustainability</a>
        <a href="${p}compliance.html">Compliance</a>
        <a href="${p}partners.html">Become a Partner</a>
        <a href="${p}contact.html">Contact</a>
      </div>
      <div class="footer-col">
        <h4>Legal &amp; Compliance</h4>
        <a href="${p}compliance.html">AML/KYC Policy</a>
        <a href="${p}compliance.html#sanctions">Sanctions Policy</a>
        <a href="${p}compliance.html#ethics">Ethics &amp; Modern Slavery</a>
        <a href="${p}compliance.html#cbam">CBAM Readiness</a>
        <a href="${p}compliance.html#reach">UK REACH</a>
        <a href="${p}compliance.html#iso">Quality Standards</a>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© <span id="year"></span> Vertex Metals Ltd. All rights reserved. Incorporated in the Isle of Man.</p>
      <p>Incorporated under the Isle of Man Companies Act 1931</p>
      <p style="margin-top:var(--space-2);opacity:.5">Built by <a href="#" style="color:inherit;text-decoration:none">Vector Business Solutions</a></p>
    </div>
  </div>
</footer>`;

  const mount = document.getElementById('site-footer');
  if (!mount) return;
  mount.outerHTML = html;

  document.getElementById('year').textContent = new Date().getFullYear();
})();
