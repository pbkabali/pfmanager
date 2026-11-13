import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useUser } from '../../app/providers/useAuth'
import { Money } from '../../components/Money'
import { PageHeader } from '../../components/PageHeader'
import { useAccounts } from '../accounts/useAccounts'
import { dateWithinMonth } from '../budgets/months'
import { useCategories } from '../categories/useCategories'
import { useProfile } from '../profile/profileContext'
import { ActivityFilters } from './ActivityFilters'
import {
  applyQuery,
  indexTransactions,
  isFiltering,
  isTypeFilter,
  matchedTotal,
  type ActivityQuery,
} from './filters'
import { TransactionForm } from './TransactionForm'
import { TransactionRow } from './TransactionRow'
import { deleteTransaction, useTransactions } from './useTransactions'

/** Rows held for the plain list, and for a search, which must see everything. */
const RECENT = 200
const WHOLE_LEDGER = 10000

export function TransactionsPage() {
  const user = useUser()
  const profile = useProfile()
  const { currency } = profile
  /*
   * The form and the filters live in the URL rather than in state, so a
   * refresh, a back-navigation, and the trip into a transaction and out again
   * all come back to the list a person left. It also makes the category link
   * on a detail page -- `?cat=food` -- work with no extra plumbing.
   */
  const [params, setParams] = useSearchParams()
  const adding = params.has('add')
  /*
   * Started from a budget item: `for` is the item and `month` the budget
   * being looked at. The date follows the month rather than today, so
   * recording against October while browsing October does not file the
   * spending under November.
   */
  const startCategoryId = params.get('for') ?? undefined
  const startMonth = params.get('month')
  const typeParam = params.get('type')
  const text = params.get('q') ?? ''
  const categoryId = params.get('cat') ?? ''
  const type = isTypeFilter(typeParam) ? typeParam : 'all'
  // Stable across renders so the filtering below can memoise on it.
  const query = useMemo<ActivityQuery>(() => ({ text, type, categoryId }), [text, type, categoryId])
  const filtering = isFiltering(query)

  const setQuery = (next: ActivityQuery) => {
    const updated = new URLSearchParams(params)
    const set = (key: string, value: string) => (value ? updated.set(key, value) : updated.delete(key))
    set('q', next.text)
    set('type', next.type === 'all' ? '' : next.type)
    set('cat', next.categoryId)
    setParams(updated, { replace: true })
  }

  const setAdding = (open: boolean) => {
    const updated = new URLSearchParams(params)
    if (open) {
      updated.set('add', '')
    } else {
      // The starting point goes with the form it opened.
      updated.delete('add')
      updated.delete('for')
      updated.delete('month')
    }
    setParams(updated, { replace: true })
  }

  // A search that only looked at the newest 200 rows would quietly lie about
  // older months, so turning a filter on widens the window. The extra rows
  // come from the offline cache on a repeat visit, so the cost lands once.
  const { transactions, loading, fromCache, error } = useTransactions({
    max: filtering ? WHOLE_LEDGER : RECENT,
  })
  const { byId: categories, categories: allCategories } = useCategories()
  const { byId: accounts } = useAccounts()

  const indexed = useMemo(
    () => indexTransactions(transactions, { categories, accounts, setAsides: profile.setAsides ?? [], currency }),
    [transactions, categories, accounts, profile.setAsides, currency],
  )
  const rows = useMemo(() => applyQuery(indexed, query), [indexed, query])
  const total = matchedTotal(rows, query, currency)

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle={fromCache ? 'Showing saved copy' : undefined}
        action={
          <button
            type="button"
            onClick={() => setAdding(!adding)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-accent-fg"
          >
            {adding ? 'Close' : '+ Add'}
          </button>
        }
      />

      {adding && (
        <div className="mb-6">
          <TransactionForm
            startCategoryId={startCategoryId}
            startDate={startMonth ? dateWithinMonth(startMonth) : undefined}
            onSaved={() => {
              // Back to the list, with the new row in view at the top.
              setAdding(false)
              window.scrollTo({ top: 0 })
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      <ActivityFilters query={query} onChange={setQuery} categories={allCategories} />

      {filtering && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-subtle">
          <span>
            {rows.length} of {transactions.length}
            {total && (
              <>
                {' · '}
                <Money amountMinor={total.amountMinor} currency={total.currency} className="font-semibold" />
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => setQuery({ text: '', type: 'all', categoryId: '' })}
            className="font-semibold text-accent-text underline"
          >
            Clear
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {error.message}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-fg-subtle">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-edge p-8 text-center">
          {filtering ? (
            <>
              <p className="text-sm text-fg-muted">Nothing matches that.</p>
              <p className="mt-1 text-xs text-fg-subtle">Try fewer words, or a different type.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-fg-muted">Nothing recorded yet.</p>
              <p className="mt-1 text-xs text-fg-subtle">Tap Add to log your first transaction.</p>
            </>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-edge rounded-lg border border-edge bg-surface px-4">
          {rows.map((t) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              currency={currency}
              category={t.categoryId ? categories.get(t.categoryId) : undefined}
              account={accounts.get(t.accountId)}
              toAccount={t.toAccountId ? accounts.get(t.toAccountId) : undefined}
              to={`/transactions/${t.id}`}
              onDelete={() => {
                if (confirm('Delete this transaction?')) void deleteTransaction(user.uid, t.id)
              }}
            />
          ))}
        </ul>
      )}
    </>
  )
}
