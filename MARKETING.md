# Digital Zone reference rebuild

The six marketing pages start at `#/ar` inside Masal. The existing storefront at `#/` and admin at `#/admin` retain their own routes, data and Cairo typography.

Pages: home, about, mini apps, business, insights, and partnerships. Vue Router uses hash history so every URL works on GitHub Pages without server rewrites. Readex Pro is bundled locally in six weights with its OFL license. Burgundy tokens and all website styles are scoped to `.dz-site`.

Content was transcribed from the supplied `wasl/reference/CONTENT.md`, with home partner details from the supplied `home.html`. English article text is translated into Arabic as requested. Statistics follow the new marketing reference; the existing app continues using English digits. SVG illustrations and Lucide icons replace proprietary photos and logos. No original CSS or JavaScript was copied.

The archive contains one article and its summary. Search and filtering work locally; load more reports when no additional archived articles exist. The partnership form validates locally and sends no data. Store links retain the reference's generic store destinations; no product IDs or social profile URLs were supplied, so social icons are decorative.

SEO titles, descriptions, Open Graph and canonical URLs update on each route. Hash pages require JavaScript; separate crawler-visible HTML for each route would require prerendering or a server deployment.

Verification: `pnpm build`, `pnpm test`, `pnpm check`, plus browser checks at 375, 768 and 1280 pixels, direct navigation, refresh, back, article controls and form validation.
