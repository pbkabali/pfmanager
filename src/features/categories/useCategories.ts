import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
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
