/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

/*
 * App-shell service worker.
 *
 * Precache every built asset and serve the shell for any navigation, so a
 * deep link opens cold with no connection. Data is not cached here: Firestore's
 * own IndexedDB persistence (see lib/firebase/db.ts) is the offline store for
 * the ledger, and duplicating it in the HTTP cache would only create two
 * sources of truth.
 *
 * Owned by us (injectManifest) rather than generated so a push handler can be
 * added here later without changing the registration.
 */

// __WB_MANIFEST is replaced at build time with the precache manifest.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/__/, /\/[^/?]+\.[^/]+$/],
  }),
)

// Take over immediately so a returning user gets the newest build rather than
// whatever was cached last time.
self.skipWaiting()
self.addEventListener('activate', () => self.clients.claim())
