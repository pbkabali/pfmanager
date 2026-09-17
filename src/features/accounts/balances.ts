import type { Transaction } from '../transactions/types'
import type { Account } from './types'
import { accountCurrency } from './types'

/**
 * Balances are derived, never stored: opening balance plus every movement.
 * Storing them would mean keeping two things in sync on every write, and
 * offline writes make that genuinely hard to get right.
 *
 * Each balance is in its own account's currency; they are never added
 * together across accounts here.
 */
export function computeBalances(accounts: Account[], transactions: Transaction[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const a of accounts) map.set(a.id, a.openingBalanceMinor)
  for (const t of transactions) {
    const sign = t.type === 'income' ? 1 : -1
    map.set(t.accountId, (map.get(t.accountId) ?? 0) + sign * t.amountMinor)
    if (t.type === 'transfer' && t.toAccountId) {
      // A cross-currency transfer lands as a different number on the other side.
      const landed = t.toAmountMinor ?? t.amountMinor
      map.set(t.toAccountId, (map.get(t.toAccountId) ?? 0) + landed)
    }
  }
  return map
}

/** Active accounts' balances summed per currency, profile currency first. */
export function totalsByCurrency(
  accounts: Account[],
  balances: Map<string, number>,
  profileCurrency: string,
): { currency: string; totalMinor: number }[] {
  const totals = new Map<string, number>()
  for (const a of accounts) {
    if (a.archived) continue
    const currency = accountCurrency(a, profileCurrency)
    totals.set(currency, (totals.get(currency) ?? 0) + (balances.get(a.id) ?? 0))
  }
  return sortCurrencies([...totals.keys()], profileCurrency).map((currency) => ({
    currency,
    totalMinor: totals.get(currency) ?? 0,
  }))
}

/** Profile currency first, the rest alphabetical, so the main figure is stable. */
export function sortCurrencies(currencies: string[], profileCurrency: string): string[] {
  return [...new Set(currencies)].sort((a, b) => {
    if (a === profileCurrency) return -1
    if (b === profileCurrency) return 1
    return a.localeCompare(b)
  })
}
