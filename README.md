# ماسال — نسخة أولية

Vue 3 + Vite. Arabic RTL interface, Cairo Bold 700 only, burgundy and white, English digits and ISO dates.

The complete user interface is Vue. It is an installable PWA with a standalone manifest, Android/maskable icons and iOS home-screen support. The service worker precaches the UI, assets and bundled Cairo Bold font for offline use after the first successful visit. A new build prompts users to update rather than immediately interrupting their session. Only the static demo interface works offline; production payments, authentication and stock require an online backend.

Run `npm install`, then `npm run dev`. Build with `npm run build`.

This is an interactive UI prototype. Products and prices are illustrative. Qi payments, supplier APIs, Excel import, authentication, production inventory and native app packaging are not implemented. Demo purchases stay in memory and reset on reload. No real codes are issued and support messages are not sent. Brand names use text treatments, not official logo assets.

The merchant switch previews account context only, not an authorization boundary or real wholesale pricing.

Admin preview: open `#/admin` on the same app. The Vue dashboard includes catalog and retail/merchant price editing, product publishing, XLSX stock import with duplicate validation, orders and statuses, customers and merchants, Qi preview, supplier setup, support replies, Excel reports and store settings. It shares reactive session data with the storefront within the same tab; a reload clears all demo data. Admin access is public for this prototype and is not an authorization boundary. Excel files and card codes stay in memory and are not uploaded; imported codes are never issued as real customer cards. The first import sheet uses `product_id`, `denomination`, `code`, up to 5000 rows and 2 MB.

Run `npm test` for shared-state and import validation checks.

The middle slider appears directly below favorite companies with three bundled images and a two-second interval. Manage it independently at `#/admin/middle-slider` (سلايدر وسطي): add, delete and reorder up to ten images. GIF and WebP uploads retain their original animation (up to 2 MB per file); JPG/PNG uploads are optimized. Image settings persist in localStorage and synchronize across tabs in the same browser, not across devices or visitors. Hover, keyboard focus, pause, a hidden tab and reduced-motion preferences pause automatic slide changes.

The store opens with phone-number sign-in and a link to create an account. Registration asks for name, Iraqi WhatsApp phone number and optional email, followed by a six-digit OTP confirmation. The email field is explicitly labelled optional; accounts, orders and support tickets use the phone identity so separate accounts can omit email. Returning sign-in also requires OTP. Codes expire after five minutes, allow five attempts and can be resent after 60 seconds. Changing the number cancels the pending challenge. No account is created before successful verification.

WhatsApp is not connected: this is a local verification preview and no messages are sent. The OTP screen explicitly shows a preview code. Accounts and challenges stay in memory and reset on reload; an existing preview store session can restore within the same tab. Register a test account before trying a fresh sign-in. Real WhatsApp delivery, account persistence and verification must run on a backend using a WhatsApp Business provider; never put provider credentials or production OTP generation in this static app.

Agreed requirements: Vue web + mobile experience; Cairo Bold; English digits and dates; burgundy and white; consumers and merchants; Excel inventory import; supplier API; Qi integration. Store name: Masal (ماسال).
