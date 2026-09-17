import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'

import { useUser } from '../../app/providers/useAuth'
import { db, userCollections, userPath } from '../../lib/firebase/db'
import type { Account, AccountType } from './types'

export type AccountsState = {
  accounts: Account[]
  /** Active accounts only, for pickers. */
  active: Account[]
  byId: Map<string, Account>
  loading: boolean
  error: Error | null
}

export function useAccounts(): AccountsState {
  const user = useUser()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const q = query(
      collection(db, userPath(user.uid, userCollections.accounts)),
      orderBy('createdAt', 'asc'),
    )
    return onSnapshot(
      q,
      (snap) => {
        setAccounts(snap.docs.map((d) => ({ ...(d.data() as Omit<Account, 'id'>), id: d.id })))
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
  }, [user.uid])

  const active = useMemo(() => accounts.filter((a) => !a.archived), [accounts])
  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  return { accounts, active, byId, loading, error }
}

/*
 * Mutations are NOT awaited by callers when offline: Firestore applies them
 * to the local cache at once and the listener above fires immediately, so the
 * UI updates before the server has heard anything. The returned promise only
 * settles on server acknowledgement -- use it for error reporting, never to
 * gate the UI.
 */

export function createAccount(
  uid: string,
  input: { name: string; type: AccountType; currency: string; openingBalanceMinor: number },
) {
  return addDoc(collection(db, userPath(uid, userCollections.accounts)), {
    ...input,
    archived: false,
    createdAt: serverTimestamp(),
  })
}

export function setAccountArchived(uid: string, accountId: string, archived: boolean) {
  return updateDoc(doc(db, userPath(uid, userCollections.accounts), accountId), { archived })
}
