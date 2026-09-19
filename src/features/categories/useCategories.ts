import { collection, doc, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'

import { useUser } from '../../app/providers/useAuth'
import { db, userCollections, userPath } from '../../lib/firebase/db'
import type { Category } from './types'

export type CategoriesState = {
  categories: Category[]
  /** Lookup by id, for rendering a transaction's category without a search. */
  byId: Map<string, Category>
  loading: boolean
  error: Error | null
}

export function useCategories(): CategoriesState {
  const user = useUser()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const q = query(
      collection(db, userPath(user.uid, userCollections.categories)),
      orderBy('sortOrder', 'asc'),
    )
    return onSnapshot(
      q,
      (snap) => {
        setCategories(snap.docs.map((d) => ({ ...(d.data() as Omit<Category, 'id'>), id: d.id })))
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
  }, [user.uid])

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  return { categories, byId, loading, error }
}

/*
 * Mutations. Not awaited by the UI when offline -- see useAccounts.ts.
 */

export type PlanEntry = { shareBp: number; daily: boolean }

/**
 * Rewrite the monthly plan in one batch: every listed category gets its share
 * and daily flag, and `created` categories are added as new expense items.
 * One batch so the plan never half-saves: a set of shares that totals 100%
 * either lands whole or not at all.
 */
export function savePlan(
  uid: string,
  entries: Record<string, PlanEntry>,
  created: { name: string; icon: string; shareBp: number; daily: boolean; sortOrder: number }[],
) {
  const col = collection(db, userPath(uid, userCollections.categories))
  const batch = writeBatch(db)
  for (const [id, entry] of Object.entries(entries)) {
    batch.update(doc(col, id), { shareBp: entry.shareBp, daily: entry.daily })
  }
  for (const c of created) {
    batch.set(doc(col), { ...c, kind: 'expense', archived: false })
  }
  return batch.commit()
}

export function setCategoryArchived(uid: string, id: string, archived: boolean) {
  const batch = writeBatch(db)
  // An archived item leaves the plan; its share must be re-assigned by hand.
  batch.update(doc(db, userPath(uid, userCollections.categories), id), {
    archived,
    ...(archived ? { shareBp: 0, daily: false } : {}),
  })
  return batch.commit()
}
