import { doc, getDocFromServer, serverTimestamp, writeBatch } from 'firebase/firestore'
import type { User } from 'firebase/auth'

import { db, userCollections, userDocPath, userPath } from '../../lib/firebase/db'
import { DEFAULT_ACCOUNT_ID } from '../accounts/types'
import { DEFAULT_CATEGORIES } from '../categories/defaults'
import { DEFAULT_BUDGET_CAP_PERCENT, DEFAULT_CURRENCY, PROFILE_SCHEMA_VERSION } from './types'

/**
 * First-run setup: profile document, default categories, one Cash account.
 *
 * A single batch so a person never sees a half-seeded state -- either the
 * profile exists with everything it needs, or nothing was written. Fixed ids
 * make it idempotent, so running it twice (two tabs racing on first sign-in)
 * is harmless.
 */
export async function seedProfile(user: User): Promise<void> {
  const batch = writeBatch(db)

  batch.set(doc(db, userDocPath(user.uid)), {
    currency: DEFAULT_CURRENCY,
    displayName: user.displayName ?? null,
    budgetCapPercent: DEFAULT_BUDGET_CAP_PERCENT,
    createdAt: serverTimestamp(),
    schemaVersion: PROFILE_SCHEMA_VERSION,
  })

  for (const { id, ...category } of DEFAULT_CATEGORIES) {
    batch.set(doc(db, userPath(user.uid, userCollections.categories), id), category)
  }

  batch.set(doc(db, userPath(user.uid, userCollections.accounts), DEFAULT_ACCOUNT_ID), {
    name: 'Cash',
    type: 'cash',
    currency: DEFAULT_CURRENCY,
    openingBalanceMinor: 0,
    archived: false,
    createdAt: serverTimestamp(),
  })

  await batch.commit()
}

/**
 * Bring an older profile up to the current schema. Today that means adding
 * default categories introduced since it was seeded ("Daily expenses", "Out of
 * budget") without touching anything the person already has. Reads go to the
 * server on purpose: an empty offline cache must not be mistaken for a missing
 * document, so with no connection this simply waits for a later visit.
 */
export async function upgradeProfile(uid: string, fromVersion: number): Promise<void> {
  if (fromVersion >= PROFILE_SCHEMA_VERSION) return
  const batch = writeBatch(db)
  for (const { id, ...category } of DEFAULT_CATEGORIES) {
    const ref = doc(db, userPath(uid, userCollections.categories), id)
    const snap = await getDocFromServer(ref)
    if (!snap.exists()) batch.set(ref, category)
  }
  batch.update(doc(db, userDocPath(uid)), { schemaVersion: PROFILE_SCHEMA_VERSION })
  await batch.commit()
}
