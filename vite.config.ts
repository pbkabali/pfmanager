import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** pfmanager's dev port. Fixed so it never collides with the other projects
 *  on this machine (racewire owns 5399, 5173 is taken). */
const DEV_PORT = 5411

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: DEV_PORT,
    // Fail rather than silently moving to the next free port. A drifting port
    // means a browser tab or smoke test can end up on a different app entirely.
    strictPort: true,
  },
  preview: {
    port: DEV_PORT,
    strictPort: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // injectManifest so we own the service worker file. Nothing in it needs
      // that yet, but it keeps the door open for push (budget alerts, bill
      // reminders) which must live in the same worker as the precache.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
      },
      devOptions: {
        /*
         * Off in dev, on purpose (lesson carried over from racewire).
         *
         * A service worker in development buys nothing and breaks things in
         * ways that look like application bugs: stale registrations serving
         * outdated dynamic imports, or intercepting auth network calls.
         * Production still ships the full worker; offline behaviour is tested
         * against `npm run preview` or a deployed build.
         */
        enabled: false,
        type: 'module',
      },
      manifest: {
        name: 'pfmanager',
        short_name: 'pfmanager',
        description: 'Personal finances: income, spending and where it goes.',
        theme_color: '#0b0b0c',
        background_color: '#0b0b0c',
        display: 'standalone',
        // Not locked to portrait: on a desktop or tablet the dashboard wants
        // the width.
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
