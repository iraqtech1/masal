# ماسال — نسخة أولية

Vue 3 + Vite. Arabic RTL interface, Cairo Bold 700 only, burgundy and white, English digits and ISO dates.

The complete user interface is Vue. It is an installable PWA with a standalone manifest, Android/maskable icons and iOS home-screen support. The service worker precaches the UI, assets and bundled Cairo Bold font for offline use after the first successful visit. A new build prompts users to update rather than immediately interrupting their session. Only the static demo interface works offline; production payments, authentication and stock require an online backend.

Run `npm install`, then `npm run dev`. Build with `npm run build`.

This is an interactive UI prototype. Products and prices are illustrative. Qi payments, supplier APIs, Excel import, authentication, production inventory and native app packaging are not implemented. Demo purchases stay in memory and reset on reload. No real codes are issued and support messages are not sent. Brand names use text treatments, not official logo assets.

The merchant switch previews account context only, not an authorization boundary or real wholesale pricing.

Admin preview: open `#/admin` on the same app. The Vue dashboard includes catalog and retail/merchant price editing, product publishing, XLSX stock import with duplicate validation, orders and statuses, customers and merchants, Qi preview, supplier setup, support replies, Excel reports and store settings. It shares reactive session data with the storefront within the same tab; a reload clears all demo data. Admin access is public for this prototype and is not an authorization boundary. Excel files and card codes stay in memory and are not uploaded; imported codes are never issued as real customer cards. The first import sheet uses `product_id`, `denomination`, `code`, up to 5000 rows and 2 MB.

Run `npm test` for shared-state and import validation checks.

Welcome screen offers guest entry, sign-in, and registration with name, phone, email and password. Demo accounts are kept only in the current tab's memory, with a password digest and no browser storage. Register a test account first to try sign-in; refreshing clears accounts and sessions. Production authentication requires a backend and is not provided by GitHub Pages.

Agreed requirements: Vue web + mobile experience; Cairo Bold; English digits and dates; burgundy and white; consumers and merchants; Excel inventory import; supplier API; Qi integration. Store name: Masal (ماسال).
