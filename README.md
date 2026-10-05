# ماسال — نسخة أولية

Vue 3 + Vite. Arabic RTL interface, Cairo Bold 700 only, burgundy and white, English digits and ISO dates.

The complete user interface is Vue. It is an installable PWA with a standalone manifest, Android/maskable icons and iOS home-screen support. The service worker precaches the UI, assets and bundled Cairo Bold font for offline use after the first successful visit. A new build prompts users to update rather than immediately interrupting their session. Only the static demo interface works offline; production payments, authentication and stock require an online backend.

Run `npm install`, then `npm run dev`. Build with `npm run build`.

This is an interactive UI prototype. Products and prices are illustrative. Qi payments, supplier APIs, Excel import, authentication, production inventory and native app packaging are not implemented. Demo purchases stay in memory and reset on reload. No real codes are issued and support messages are not sent. Brand names use text treatments, not official logo assets.

The merchant switch previews account context only, not an authorization boundary or real wholesale pricing.

Welcome screen offers guest entry, sign-in, and registration with name, phone, email and password. Demo accounts are kept only in the current tab's memory, with a password digest and no browser storage. Register a test account first to try sign-in; refreshing clears accounts and sessions. Production authentication requires a backend and is not provided by GitHub Pages.

Agreed requirements: Vue web + mobile experience; Cairo Bold; English digits and dates; burgundy and white; consumers and merchants; Excel inventory import; supplier API; Qi integration. Store name: Masal (ماسال).
