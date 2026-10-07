import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server:{proxy:{'/api':{target:'http://127.0.0.1:3001'}}},
  resolve: {alias: [{find: /^vue$/, replacement: 'vue/dist/vue.esm-bundler.js'}]},
  base: process.env.GITHUB_ACTIONS ? '/masal/' : '/',
  plugins: [VitePWA({
    registerType: 'autoUpdate',
    injectRegister: false,
    includeAssets: ['favicon.png', 'brand/*', 'icons/*.png', 'fonts/*.ttf'],
    manifest: {
      id: './', name: 'ماسال — بطاقاتك الرقمية', short_name: 'ماسال',
      description: 'بطاقات الرصيد والألعاب والبطاقات العالمية بمكان واحد.',
      lang: 'ar', dir: 'rtl', start_url: './', scope: './',
      display: 'standalone', background_color: '#ffffff', theme_color: '#a21c2d',
      icons: [
        {src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
        {src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
        {src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,webp,ttf}'],
      cleanupOutdatedCaches: true,
      skipWaiting: true,
      clientsClaim: true,
      navigateFallbackDenylist: [/^\/api\//],
    },
  })],
});
