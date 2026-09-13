import type { Timestamp } from 'firebase/firestore'

export type TransactionType = 'income' | 'expense' | 'transfer'

export type Transaction = {
  id: string
  type: TransactionType
  /** Always positive; `type` carries the direction. Minor units. */
  amountMinor: number
  /** Source account for expense and transfer; destination for income. */
  accountId: string
  /** Transfers only: the account money moved into. */
  toAccountId?: string
  /** Absent on transfers, which are neither income nor spending. */
  categoryId?: string
  /** When it happened, as chosen by the person -- not when it was typed in. */
  date: Timestamp
  note: string
  /** Null while a locally-created row waits for the server timestamp. */
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
