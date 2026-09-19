import type { Timestamp } from 'firebase/firestore'

export type TransactionType = 'income' | 'expense' | 'transfer'

export type Transaction = {
  id: string
  type: TransactionType
  /** Always positive; `type` carries the direction. Minor units of `currency`. */
  amountMinor: number
  /**
   * Currency of `amountMinor`, copied from the account at write time so a row
   * renders correctly on its own and per-currency totals need no join.
   * Absent on rows written before accounts had currencies.
   */
  currency?: string
  /** Source account for expense and transfer; destination for income. */
  accountId: string
  /** Transfers only: the account money moved into. */
  toAccountId?: string
  /**
   * Transfers between accounts of different currencies only: what landed in
   * `toAccountId`, in that account's minor units. Absent when both sides are
   * the same currency, in which case `amountMinor` landed unchanged. No rate
   * is stored: the two amounts are what actually happened.
   */
  toAmountMinor?: number
  /**
   * Expenses paid in a currency other than the account's: what actually left
   * `accountId`, in that account's minor units. `amountMinor`/`currency` stay
   * the price as paid (a USD subscription is a USD expense even when a UGX
   * wallet settled it). Absent when the expense is in the account's currency.
   */
  accountAmountMinor?: number
  /** Absent on transfers, which are neither income nor spending. */
  categoryId?: string
  /**
   * Transfers only: the set-aside rule that produced this movement, so the row
   * can read "Tithe on Salary" and totals per rule are a filter away.
   */
  setAsideId?: string
  /**
   * Set on each part of an income that was split across several accounts.
   * All parts share the id, date, category and note; each is a complete
   * transaction in its own right, so balances and totals need no special case.
   */
  groupId?: string
  /** When it happened, as chosen by the person -- not when it was typed in. */
  date: Timestamp
  note: string
  /** Null while a locally-created row waits for the server timestamp. */
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
