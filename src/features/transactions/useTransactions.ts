import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'

import { useUser } from '../../app/providers/useAuth'
import { db, userCollections, userPath } from '../../lib/firebase/db'
import type { Transaction, TransactionInput } from './types'

export type TransactionsState = {
  transactions: Transaction[]
  loading: boolean
  /**
   * True when the current results came from the local cache rather than the
   * server. Lets a screen say "showing saved copy" so the person knows whether
   * a figure is live or last-synced.
   */
  fromCache: boolean
  error: Error | null
}

export type TransactionsFilter = {
  /** Inclusive lower bound. */
  from?: Date
  /** Exclusive upper bound. */
  to?: Date
  accountId?: string
  categoryId?: string
  max?: number
}

/**
 * Live list, newest first.
 *
 * Any accountId/categoryId filter combined with the date sort needs the
 * composite indexes in firestore.indexes.json -- add a field here and add its
 * index there, or the query errors in production.
 */
export function useTransactions(filter: TransactionsFilter = {}): TransactionsState {
  const user = useUser()
  const [state, setState] = useState<TransactionsState>({
    transactions: [],
    loading: true,
    fromCache: false,
    error: null,
  })

  // Dates are compared by value so a caller can pass a fresh `new Date()`
  // each render without re-subscribing every time.
  const fromMs = filter.from?.getTime()
  const toMs = filter.to?.getTime()
  const { accountId, categoryId, max = 200 } = filter

  useEffect(() => {
    const constraints: QueryConstraint[] = []
    if (accountId) constraints.push(where('accountId', '==', accountId))
    if (categoryId) constraints.push(where('categoryId', '==', categoryId))
    if (fromMs !== undefined) constraints.push(where('date', '>=', Timestamp.fromMillis(fromMs)))
    if (toMs !== undefined) constraints.push(where('date', '<', Timestamp.fromMillis(toMs)))
    constraints.push(orderBy('date', 'desc'), limit(max))

    const q = query(collection(db, userPath(user.uid, userCollections.transactions)), ...constraints)

    // includeMetadataChanges lets the UI react when the same data flips from
    // cached to server-confirmed, which is invisible otherwise.
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        setState({
          transactions: snap.docs.map((d) => ({ ...(d.data() as Omit<Transaction, 'id'>), id: d.id })),
          loading: false,
          fromCache: snap.metadata.fromCache,
          error: null,
        })
      },
      (error) => setState((s) => ({ ...s, loading: false, error })),
    )
  }, [user.uid, accountId, categoryId, fromMs, toMs, max])

  return state
}

/*
 * Mutations. Not awaited by the UI when offline -- see useAccounts.ts.
 * `undefined` fields are stripped: Firestore rejects them, and a transfer has
 * no category while an expense has no toAccountId.
 */

function clean<T extends object>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as T
}

export function createTransaction(uid: string, input: TransactionInput) {
  return addDoc(collection(db, userPath(uid, userCollections.transactions)), {
    ...clean(input),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export type SetAsideTransfer = {
  setAsideId: string
  accountId: string
  toAccountId: string
  currency: string
  amountMinor: number
}

/**
 * One income, landing in several accounts: one transaction per part, written
 * as a single batch so a person never sees half a salary. All parts share a
 * generated groupId plus the date, category and note; each carries its own
 * account, currency and amount. A single-part income goes through here too
 * and simply gets no groupId.
 *
 * Set-asides ride in the same batch as transfers out of the receiving account:
 * the income is recorded in full, then the promised slice moves. The ledger
 * says what happened; the tag says why.
 */
export function createIncome(
  uid: string,
  shared: Pick<TransactionInput, 'categoryId' | 'date' | 'note'>,
  parts: { accountId: string; currency: string; amountMinor: number }[],
  setAsides: SetAsideTransfer[] = [],
) {
  const col = collection(db, userPath(uid, userCollections.transactions))
  const groupId = parts.length + setAsides.length > 1 ? doc(col).id : undefined
  const batch = writeBatch(db)
  const stamps = { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
  for (const part of parts) {
    batch.set(doc(col), { ...clean({ type: 'income' as const, ...shared, ...part, groupId }), ...stamps })
  }
  for (const s of setAsides) {
    batch.set(doc(col), {
      ...clean({ type: 'transfer' as const, ...s, date: shared.date, note: '', groupId }),
      ...stamps,
    })
  }
  return batch.commit()
}

export function updateTransaction(uid: string, id: string, input: Partial<TransactionInput>) {
  return updateDoc(doc(db, userPath(uid, userCollections.transactions), id), {
    ...clean(input),
    updatedAt: serverTimestamp(),
  })
}

export function deleteTransaction(uid: string, id: string) {
  return deleteDoc(doc(db, userPath(uid, userCollections.transactions), id))
}
