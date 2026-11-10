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

/*
 * Deliberately NOT skipWaiting() on install.
 *
 * It read as "a returning user gets the newest build", but paired with
 * cleanupOutdatedCaches() above it meant a new worker seized an ALREADY-OPEN
 * page and then deleted the precache that page was still running from. The
 * HTML and entry bundle in memory reference chunk filenames by content hash,
 * so the next lazy import -- Budget, Accounts, Settings, an account ledger
 * (see app/lazyPages.ts) -- asks for a file that no longer exists in the
 * cache or on the server, and the screen fails to open.
 *
 * The usual companion to skipWaiting is reloading on controllerchange. That
 * is not safe here either: the transaction form holds a dozen fields in
 * component state and writes them only on an explicit Save, so a reload timed
 * by our deploys would throw away a half-entered split income at a moment of
 * our choosing rather than the person's.
 *
 * So the new worker waits instead. The running page keeps the cache it was
 * loaded with and stays coherent; the update applies when somebody taps
 * Reload in UpdateBanner, or on the next cold start once every old client is
 * gone.
 *
 * clients.claim() IS kept. skipWaiting was the dangerous half -- it activated
 * a new worker underneath a running page. claim only decides who controls a
 * page once a worker has already activated. Without it a first visit stays
 * uncontrolled, so nothing is served from cache until a second load -- and
 * controllerchange never fires for that page, which is what makes a Reload
 * button appear to do nothing.
 */
self.addEventListener('activate', () => self.clients.claim())

/*
 * Let the page bring an update forward.
 *
 * The worker waits rather than seizing a running session, which means an
 * update otherwise lands only after the app is fully closed and reopened --
 * two cold starts, with no way for anybody to know one is pending. This is
 * the other half: the page detects the waiting worker, offers a Reload, and
 * asks here only once somebody has tapped it.
 *
 * Asked for, never assumed.
 */
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})
