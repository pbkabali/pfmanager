import type { Timestamp } from 'firebase/firestore'

/**
 * `users/{uid}` -- one document per person, created on first sign-in.
 *
 * Deliberately small. Preferences live here; the ledger lives in the
 * subcollections so this document stays cheap to listen to.
 */
export type Profile = {
  /**
   * ISO 4217 code used as the default for new accounts and shown first in
   * per-currency summaries. Each account carries its own currency; this is
   * not a reporting currency and nothing is converted into it.
   */
  currency: string
  displayName: string | null
  createdAt: Timestamp | null
  /** Bumped when the default categories or accounts are re-seeded. */
  schemaVersion: number
}

export const PROFILE_SCHEMA_VERSION = 1

/** Fallback for a brand-new profile; changeable in Settings. */
export const DEFAULT_CURRENCY = 'UGX'

/** Currencies offered in Settings. Extend freely; formatting is Intl-driven. */
export const CURRENCIES = ['UGX', 'KES', 'TZS', 'RWF', 'USD', 'EUR', 'GBP'] as const
