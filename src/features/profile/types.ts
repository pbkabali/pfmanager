import type { Timestamp } from 'firebase/firestore'

/**
 * `users/{uid}` -- one document per person, created on first sign-in.
 *
 * Deliberately small. Preferences live here; the ledger lives in the
 * subcollections so this document stays cheap to listen to.
 */
export type Profile = {
  /**
   * ISO 4217 code new expenses are recorded in unless changed on the form,
   * the default for new accounts, and the first shown in per-currency
   * summaries. Each account carries its own currency; this is not a
   * reporting currency and nothing is converted into it.
   */
  currency: string
  displayName: string | null
  /**
   * The most that may be earmarked for a month, as a percentage of the total
   * balance across accounts in the profile currency. Absent on older profiles;
   * read via `budgetCapPercent()`.
   */
  budgetCapPercent?: number
  createdAt: Timestamp | null
  /** Bumped when the default categories or accounts are re-seeded. */
  schemaVersion: number
}

export const PROFILE_SCHEMA_VERSION = 1

/** Fallback for a brand-new profile; changeable in Settings. */
export const DEFAULT_CURRENCY = 'UGX'

/** Currencies offered in Settings. Extend freely; formatting is Intl-driven. */
export const CURRENCIES = ['UGX', 'KES', 'TZS', 'RWF', 'USD', 'EUR', 'GBP'] as const

/** Half by default: leaves the other half untouched as a buffer. */
export const DEFAULT_BUDGET_CAP_PERCENT = 50

export function budgetCapPercent(profile: Pick<Profile, 'budgetCapPercent'>): number {
  return profile.budgetCapPercent ?? DEFAULT_BUDGET_CAP_PERCENT
}
