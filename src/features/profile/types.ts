import type { Timestamp } from 'firebase/firestore'

/**
 * `users/{uid}` -- one document per person, created on first sign-in.
 *
 * Deliberately small. Preferences live here; the ledger lives in the
 * subcollections so this document stays cheap to listen to.
 */
/**
 * A standing rule: on every income, this share moves to a dedicated account.
 * Tithe and support for parents are the motivating cases. Optional per
 * person; an empty list means income lands in full and nothing else happens.
 */
export type SetAside = {
  id: string
  name: string
  /** Basis points of each income part (10000 = 100%). */
  shareBp: number
  /**
   * Destination per currency: the income's currency picks the account, so a
   * UGX salary tithes into a UGX account and a USD one into a USD account.
   * An income in a currency with no entry is flagged on the form and skipped;
   * nothing is converted.
   */
  accounts: Record<string, string>
  paused?: boolean
}

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
  /** Standing set-aside rules applied to every income. Absent means none. */
  setAsides?: SetAside[]
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
