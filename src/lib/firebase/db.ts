import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

import { firebaseApp } from './app'
import { useEmulators } from './config'

/**
 * Firestore configured for offline-first operation.
 *
 * `persistentLocalCache` keeps documents in IndexedDB, so the app reads and
 * writes normally with no connection: queries resolve from cache and writes
 * queue locally, then flush automatically when the network returns. Logging
 * a purchase in a shop basement with no signal just works.
 *
 * `persistentMultipleTabManager` shares that cache across tabs rather than
 * letting the first tab take an exclusive lock and the rest fall back to
 * memory-only -- a desktop user with two tabs open is the normal case.
 */
export const db: Firestore = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})

if (useEmulators) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

/**
 * Firestore paths.
 *
 * Everything a person owns lives under `users/{uid}`. Scoping by path is what
 * lets firestore.rules protect it with a single uid comparison, and means a
 * query cannot return anybody else's ledger. The alternative -- a flat
 * `transactions` collection with an ownerId field -- relies on every query and
 * every rule remembering to filter, and fails silently when one forgets.
 */
export const collections = {
  users: 'users',
} as const

/** Subcollections beneath `users/{uid}`. */
export const userCollections = {
  accounts: 'accounts',
  categories: 'categories',
  transactions: 'transactions',
  budgets: 'budgets',
} as const

export type UserCollection = (typeof userCollections)[keyof typeof userCollections]

/** `users/{uid}` -- the profile document. */
export function userDocPath(uid: string): string {
  return `${collections.users}/${uid}`
}

/** `users/{uid}/transactions` -- built here so the path shape lives in one place. */
export function userPath(uid: string, sub: UserCollection): string {
  return `${userDocPath(uid)}/${sub}`
}
