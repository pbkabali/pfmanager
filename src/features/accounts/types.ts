import type { Timestamp } from 'firebase/firestore'

/** Where money physically sits. Mobile money is first-class: it is how most
 *  day-to-day spending happens here. */
export type AccountType = 'cash' | 'mobile_money' | 'bank' | 'card' | 'savings' | 'set_aside' | 'other'

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'mobile_money', label: 'Mobile money', icon: '📱' },
  { value: 'bank', label: 'Bank account', icon: '🏦' },
  { value: 'card', label: 'Card', icon: '💳' },
  { value: 'savings', label: 'Savings', icon: '💰' },
  { value: 'set_aside', label: 'Set-aside', icon: '🤲' },
  { value: 'other', label: 'Other', icon: '▤' },
]

/**
 * How an account presents. Committed money is a set-aside whatever type it
 * was created as, so accounts made before the type existed read correctly.
 */
export function accountMeta(account: Pick<Account, 'type' | 'committed'>): { label: string; icon: string } {
  const type = account.committed ? 'set_aside' : account.type
  const meta = ACCOUNT_TYPES.find((t) => t.value === type)
  return meta ?? { label: account.type, icon: '▤' }
}

export type Account = {
  id: string
  name: string
  type: AccountType
  /**
   * ISO 4217 code every amount in this account is denominated in. A USD
   * savings account and a UGX mobile money wallet are different accounts,
   * and money only changes currency by moving between them.
   *
   * Absent on accounts created before currencies were per-account; read it
   * through `accountCurrency()` which falls back to the profile currency.
   */
  currency?: string
  /** Balance before any recorded transaction, in minor units of `currency`. */
  openingBalanceMinor: number
  /**
   * Money already promised to someone else -- a tithe or parents account.
   * Still an ordinary account with a derived balance, but left out of the
   * monthly budget's cap base and funding sources, since it is not yours to
   * plan with.
   */
  committed?: boolean
  archived: boolean
  createdAt: Timestamp | null
}

/** The account's currency, defaulting to the profile's for pre-currency rows. */
export function accountCurrency(account: Account | undefined, fallback: string): string {
  return account?.currency ?? fallback
}

export const DEFAULT_ACCOUNT_ID = 'cash'
