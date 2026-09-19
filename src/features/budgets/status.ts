import { accountCurrency, type Account } from '../accounts/types'
import type { Transaction } from '../transactions/types'
import type { Budget } from './types'

export type ItemStatus = {
  categoryId: string
  shareBp: number
  allocatedMinor: number
  spentMinor: number
  /** Allocation less spending; negative when overspent. */
  availableMinor: number
}

export type BudgetStatus = {
  items: ItemStatus[]
  /** carried + funded: the lumpsum that was split. */
  totalMinor: number
  spentMinor: number
  availableMinor: number
  /** What would roll into next month if it ended now: unspent balances only. */
  carryOverMinor: number
  /** Spending in the budget currency on categories outside the plan. */
  unbudgetedMinor: number
  /** Expenses that could not be counted because they are in another currency. */
  unconvertedCount: number
}

/**
 * The expense's amount in `currency`, or null when it cannot be known without
 * an exchange rate. The price counts when priced in that currency; failing
 * that, what the account was charged counts when the account is in it.
 */
export function amountInCurrency(
  t: Transaction,
  currency: string,
  accounts: Map<string, Account>,
  profileCurrency: string,
): number | null {
  const account = accounts.get(t.accountId)
  const priced = t.currency ?? accountCurrency(account, profileCurrency)
  if (priced === currency) return t.amountMinor
  if (t.accountAmountMinor !== undefined && accountCurrency(account, profileCurrency) === currency) {
    return t.accountAmountMinor
  }
  return null
}

/** Where a funded month stands, given that month's transactions. */
export function budgetStatus(
  budget: Budget,
  transactions: Transaction[],
  accounts: Map<string, Account>,
  profileCurrency: string,
): BudgetStatus {
  const spent = new Map<string, number>()
  let unbudgetedMinor = 0
  let unconvertedCount = 0

  for (const t of transactions) {
    if (t.type !== 'expense') continue
    const amount = amountInCurrency(t, budget.currency, accounts, profileCurrency)
    if (amount === null) {
      unconvertedCount++
      continue
    }
    const key = t.categoryId ?? ''
    if (key in budget.allocations) spent.set(key, (spent.get(key) ?? 0) + amount)
    else unbudgetedMinor += amount
  }

  const items: ItemStatus[] = Object.entries(budget.allocations).map(([categoryId, allocatedMinor]) => {
    const spentMinor = spent.get(categoryId) ?? 0
    return {
      categoryId,
      shareBp: budget.shares[categoryId] ?? 0,
      allocatedMinor,
      spentMinor,
      availableMinor: allocatedMinor - spentMinor,
    }
  })

  const totalMinor = budget.fundedMinor + budget.carriedMinor
  const spentMinor = items.reduce((sum, i) => sum + i.spentMinor, 0)
  const carryOverMinor = items.reduce((sum, i) => sum + Math.max(i.availableMinor, 0), 0)

  return {
    items,
    totalMinor,
    spentMinor,
    availableMinor: totalMinor - spentMinor,
    carryOverMinor,
    unbudgetedMinor,
    unconvertedCount,
  }
}
