import { deleteApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
  type User,
} from 'firebase/auth'

import { auth } from './auth'
import { firebaseConfig, useEmulators } from './config'

/**
 * Keeping more than one account signed in on a device, so switching between
 * them costs a tap instead of a password.
 *
 * No credential is ever stored. Firebase already persists a long-lived
 * refresh token per app instance in IndexedDB -- that is what lets this app
 * reopen offline without a sign-in -- and the persistence key includes the
 * FirebaseApp *name*. So a second, differently named app instance gets its own
 * independent session slot for free. We park each account's session in one of
 * those, and switching promotes a parked session onto the primary instance
 * with `updateCurrentUser`.
 *
 * Why not store the password and re-sign-in? Because a password in
 * localStorage is readable by any script that gets onto the page, cannot be
 * revoked without changing it everywhere, and does not exist at all for a
 * Google sign-in. Refresh tokens are revocable server-side, scoped to this
 * origin, and already trusted by the rest of the app.
 *
 * Parked instances are auth ONLY -- never call getFirestore on one. There is
 * exactly one Firestore handle in the app, bound to the primary instance, and
 * every path is derived from the signed-in uid, so a switch re-keys all data
 * through React rather than by re-pointing handles. That is what keeps one
 * account's write from ever landing in another's ledger.
 */

const INDEX_KEY = 'pfmanager.accounts.v1'

/** What the switcher shows. Identity only -- nothing secret lives here. */
export type RememberedAccount = {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

const parkedAuths = new Map<string, Auth>()

function parkedAppName(uid: string): string {
  return `parked:${uid}`
}

/**
 * The auth instance holding `uid`'s parked session, created on demand.
 *
 * Cached because `initializeAuth` throws if called twice for one app; the
 * fallback covers HMR, which discards the cache while the apps survive.
 */
function parkedAuthFor(uid: string): Auth {
  const cached = parkedAuths.get(uid)
  if (cached) return cached

  const name = parkedAppName(uid)
  const app: FirebaseApp = getApps().find((a) => a.name === name) ?? initializeApp(firebaseConfig, name)

  let parked: Auth
  try {
    parked = initializeAuth(app, { persistence: indexedDBLocalPersistence })
    if (useEmulators) {
      connectAuthEmulator(parked, 'http://127.0.0.1:9099', { disableWarnings: true })
    }
  } catch {
    parked = getAuth(app)
  }

  parkedAuths.set(uid, parked)
  return parked
}

function readIndex(): RememberedAccount[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is RememberedAccount =>
        typeof entry === 'object' && entry !== null && typeof (entry as RememberedAccount).uid === 'string',
    )
  } catch {
    // Private-mode localStorage throws on read. Degrade to "nothing
    // remembered" rather than breaking the menu.
    return []
  }
}

function writeIndex(accounts: RememberedAccount[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(accounts))
  } catch {
    // Switching simply stays unavailable if we cannot keep the list.
  }
}

/** Every account with a session parked on this device, most recent first. */
export function rememberedAccounts(): RememberedAccount[] {
  return readIndex()
}

/**
 * Park a copy of the signed-in session so it survives a switch away.
 *
 * Called on every auth state change rather than only at sign-in, so the
 * entry's name and email stay current and a session parked before an app
 * update is topped up on next open. Re-parking the same session is a no-op.
 */
export async function rememberCurrent(user: User): Promise<void> {
  const entry: RememberedAccount = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  }

  try {
    const parked = parkedAuthFor(user.uid)
    await parked.authStateReady()
    await parked.updateCurrentUser(user)
  } catch {
    // Parking failed (no IndexedDB, quota, private mode). The current session
    // still works; this account just will not appear as switchable.
    return
  }

  writeIndex([entry, ...readIndex().filter((a) => a.uid !== user.uid)])
}

/**
 * Make a parked account the signed-in one.
 *
 * `updateCurrentUser` copies the user onto the primary instance and fires
 * onAuthStateChanged, so the app reacts exactly as it would to a sign-in.
 *
 * While online we force a token refresh first: a session revoked elsewhere
 * (password changed, account deleted) would otherwise switch "successfully"
 * and then fail every read with a permission error. Offline we promote
 * unchecked, because refusing to switch without a network would break the
 * offline-first promise the rest of the app keeps.
 */
export async function switchTo(uid: string): Promise<void> {
  const parked = parkedAuthFor(uid)
  await parked.authStateReady()

  const user = parked.currentUser
  if (!user) {
    await forget(uid)
    throw new Error('That account is no longer signed in on this device. Sign in again.')
  }

  if (navigator.onLine) {
    try {
      await user.getIdToken(true)
    } catch {
      await forget(uid)
      throw new Error('That sign-in has expired. Sign in again.')
    }
  }

  await auth.updateCurrentUser(user)
}

/**
 * Drop an account's parked session and its entry.
 *
 * Signing the parked instance out is what actually clears its refresh token
 * from IndexedDB -- removing the list entry alone would leave a usable
 * session behind.
 */
export async function forget(uid: string): Promise<void> {
  writeIndex(readIndex().filter((a) => a.uid !== uid))

  const parked = parkedAuths.get(uid) ?? parkedAuthFor(uid)
  try {
    await parked.authStateReady()
    await parked.signOut()
    await deleteApp(parked.app)
  } catch {
    // Best effort: the entry is gone either way.
  }
  parkedAuths.delete(uid)
}

/**
 * Sign out for real: the parked session goes too.
 *
 * Without this, "sign out" would leave the account one tap away in the
 * switcher for anyone holding the device, which is not what the words mean.
 * Other remembered accounts are untouched.
 *
 * Note this leaves the Firestore offline cache on disk. Clearing it needs the
 * Firestore instance terminated and would discard writes still queued from a
 * spell offline -- losing someone's unsynced transactions to a sign-out is
 * the worse failure. Security rules gate the server; the cache is only ever
 * read back through the signed-in uid's own paths.
 */
export async function signOutAndForget(): Promise<void> {
  const uid = auth.currentUser?.uid
  if (uid) await forget(uid)
  await auth.signOut()
}
