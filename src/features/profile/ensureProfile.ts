import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import type { User } from 'firebase/auth'

import { db, userCollections, userDocPath, userPath } from '../../lib/firebase/db'
import { DEFAULT_ACCOUNT_ID } from '../accounts/types'
import { DEFAULT_CATEGORIES } from '../categories/defaults'
import { DEFAULT_CURRENCY, PROFILE_SCHEMA_VERSION } from './types'

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
    createdAt: serverTimestamp(),
    schemaVersion: PROFILE_SCHEMA_VERSION,
  })

  for (const { id, ...category } of DEFAULT_CATEGORIES) {
    batch.set(doc(db, userPath(user.uid, userCollections.categories), id), category)
  }

  batch.set(doc(db, userPath(user.uid, userCollections.accounts), DEFAULT_ACCOUNT_ID), {
    name: 'Cash',
    type: 'cash',
    openingBalanceMinor: 0,
    archived: false,
    createdAt: serverTimestamp(),
  })

  await batch.commit()
}
