import { useSearchParams } from 'react-router-dom'

import { useUser } from '../../app/providers/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { useAccounts } from '../accounts/useAccounts'
import { useCategories } from '../categories/useCategories'
import { useProfile } from '../profile/profileContext'
import { TransactionForm } from './TransactionForm'
import { TransactionRow } from './TransactionRow'
import { deleteTransaction, useTransactions } from './useTransactions'

export function TransactionsPage() {
  const user = useUser()
  const { currency } = useProfile()
  // `?add` opens the form on arrival, so the Home "+ Add" lands ready to type.
  // Kept in the URL rather than state so a refresh or back-navigation agrees.
  const [params, setParams] = useSearchParams()
  const adding = params.has('add')
  const setAdding = (open: boolean) => setParams(open ? { add: '' } : {}, { replace: true })
  const { transactions, loading, fromCache, error } = useTransactions()
  const { byId: categories } = useCategories()
  const { byId: accounts } = useAccounts()

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
            onSaved={() => {
              // Back to the list, with the new row in view at the top.
              setAdding(false)
              window.scrollTo({ top: 0 })
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {error.message}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-fg-subtle">Loading…</p>
      ) : transactions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-edge p-8 text-center">
          <p className="text-sm text-fg-muted">Nothing recorded yet.</p>
          <p className="mt-1 text-xs text-fg-subtle">Tap Add to log your first transaction.</p>
        </div>
      ) : (
        <ul className="divide-y divide-edge rounded-lg border border-edge bg-surface px-4">
          {transactions.map((t) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              currency={currency}
              category={t.categoryId ? categories.get(t.categoryId) : undefined}
              account={accounts.get(t.accountId)}
              toAccount={t.toAccountId ? accounts.get(t.toAccountId) : undefined}
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
