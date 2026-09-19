import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'

import { useUser } from '../../app/providers/useAuth'
import { db, userCollections, userPath } from '../../lib/firebase/db'
import { useAccounts } from '../accounts/useAccounts'
import { useProfile } from '../profile/profileContext'
import { useTransactions } from '../transactions/useTransactions'
import { monthEnd, monthStart } from './months'
import { budgetStatus, type BudgetStatus } from './status'
import type { Budget, BudgetInput } from './types'

export type BudgetState = {
  /** Null once confirmed absent; undefined while still loading. */
  budget: Budget | null | undefined
  fromCache: boolean
  error: Error | null
}

/** Live view of one month's budget document. */
const EMPTY: BudgetState = { budget: undefined, fromCache: false, error: null }

export function useBudget(month: string): BudgetState {
  const user = useUser()
  // Keyed by month so switching months reads as "loading" until the new
  // listener fires, without a reset call inside the effect.
  const [state, setState] = useState<BudgetState & { month: string }>({ ...EMPTY, month })

  useEffect(() => {
    return onSnapshot(
      doc(db, userPath(user.uid, userCollections.budgets), month),
      { includeMetadataChanges: true },
      (snap) => {
        setState({
          month,
          budget: snap.exists() ? ({ ...(snap.data() as Omit<Budget, 'id'>), id: snap.id } as Budget) : null,
          fromCache: snap.metadata.fromCache,
          error: null,
        })
      },
      (error) => setState((s) => ({ ...s, month, error })),
    )
  }, [user.uid, month])

  return state.month === month ? state : EMPTY
}

export type MonthStatus = {
  budget: Budget | null | undefined
  /** Null until the budget exists. */
  status: BudgetStatus | null
  loading: boolean
  fromCache: boolean
}

/**
 * A month's budget together with where it stands: the month's transactions
 * are folded into per-item spent and available figures on the device.
 */
export function useMonthStatus(month: string): MonthStatus {
  const { currency: profileCurrency } = useProfile()
  const { budget, fromCache } = useBudget(month)
  const range = useMemo(() => ({ from: monthStart(month), to: monthEnd(month), max: 5000 }), [month])
  const { transactions, loading: transactionsLoading } = useTransactions(range)
  const { byId: accounts } = useAccounts()

  const status = useMemo(
    () => (budget ? budgetStatus(budget, transactions, accounts, profileCurrency) : null),
    [budget, transactions, accounts, profileCurrency],
  )

  return { budget, status, loading: budget === undefined || transactionsLoading, fromCache }
}

/*
 * Mutations. Not awaited by the UI when offline -- see useAccounts.ts.
 */

export function createBudget(uid: string, input: BudgetInput) {
  return setDoc(doc(db, userPath(uid, userCollections.budgets), input.month), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function deleteBudget(uid: string, month: string) {
  return deleteDoc(doc(db, userPath(uid, userCollections.budgets), month))
}
