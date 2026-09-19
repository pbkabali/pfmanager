import type { Timestamp } from 'firebase/firestore'

/** Where part of the lumpsum was taken from. Informational: nothing moves. */
export type BudgetSource = {
  accountId: string
  /** Minor units of the budget currency, which is also the account's. */
  amountMinor: number
}

/**
 * `users/{uid}/budgets/{YYYY-MM}` -- one month's plan.
 *
 * Funding a month is an earmark, not a movement: the money stays in the
 * accounts it was in, and this document records how much of it is spoken
 * for, where from, and how it is split. Shares are copied in at funding time
 * so editing the plan afterwards affects the next month, not this one.
 */
export type Budget = {
  /** Same as the document id, `YYYY-MM`. */
  id: string
  month: string
  /** The profile currency when funded. Every amount below is in it. */
  currency: string
  /** Fresh money earmarked for this month. This is what the cap limits. */
  fundedMinor: number
  /** Unspent balances left over from the previous month, taken at funding. */
  carriedMinor: number
  sources: BudgetSource[]
  /** categoryId -> basis points, as the plan stood when funded. */
  shares: Record<string, number>
  /** categoryId -> minor units. Sums exactly to fundedMinor + carriedMinor. */
  allocations: Record<string, number>
  /** The cap in force when funded, for the record. */
  capPercent: number
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export type BudgetInput = Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>
