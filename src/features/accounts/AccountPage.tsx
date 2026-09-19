import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useUser } from '../../app/providers/useAuth'
import { Money } from '../../components/Money'
import { PageHeader } from '../../components/PageHeader'
import { useEarmarks } from '../budgets/useEarmarks'
import { useCategories } from '../categories/useCategories'
import { useProfile } from '../profile/profileContext'
import { TransactionRow } from '../transactions/TransactionRow'
import { deleteTransaction, useTransactions } from '../transactions/useTransactions'
import { computeBalances } from './balances'
import { ACCOUNT_TYPES, accountCurrency } from './types'
import { setAccountArchived, setAccountCommitted, useAccounts } from './useAccounts'

/**
 * One account's ledger and balance: everything that moved in or out of it,
 * newest first. This is where a set-aside account shows how it was disbursed.
 * Filtered on the device from the full list, so it works offline and needs no
 * extra index; the ledger is small enough for that to be instant.
 */
export function AccountPage() {
  const user = useUser()
  const { accountId = '' } = useParams()
  const { currency: profileCurrency } = useProfile()
  const { accounts, byId, loading } = useAccounts()
  const { byId: categories } = useCategories()
  const { transactions, fromCache } = useTransactions({ max: 10000 })

  const account = byId.get(accountId)
  const currency = accountCurrency(account, profileCurrency)
  const balances = useMemo(() => computeBalances(accounts, transactions), [accounts, transactions])
  const earmarked = useEarmarks().get(accountId) ?? 0
  const rows = useMemo(
    () => transactions.filter((t) => t.accountId === accountId || t.toAccountId === accountId),
    [transactions, accountId],
  )

  if (!loading && !account) {
    return (
      <div className="rounded-lg border border-dashed border-edge p-8 text-center">
        <p className="text-sm text-fg-muted">That account does not exist.</p>
        <Link to="/accounts" className="mt-2 inline-block text-sm font-semibold text-accent-text underline">
          All accounts
        </Link>
      </div>
    )
  }

  const meta = ACCOUNT_TYPES.find((t) => t.value === account?.type)

  return (
    <>
      <PageHeader
        title={account?.name ?? '…'}
        subtitle={[
          meta?.label ?? account?.type,
          currency,
          account?.committed && 'committed',
          account?.archived && 'archived',
          fromCache && 'showing saved copy',
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          <Link to="/accounts" className="text-sm font-semibold text-fg-muted hover:text-fg">
            ‹ Accounts
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="rounded-lg border border-edge bg-surface p-4">
          <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">Balance</p>
          <Money amountMinor={balances.get(accountId) ?? 0} currency={currency} className="text-2xl font-bold text-fg" />
          {earmarked > 0 && (
            <p className="mt-1 text-xs text-fg-subtle">
              <Money amountMinor={earmarked} currency={currency} /> earmarked for the budget ·{' '}
              <Money amountMinor={(balances.get(accountId) ?? 0) - earmarked} currency={currency} /> free
            </p>
          )}
        </div>
        {account && (
          <div className="flex flex-col justify-center gap-2 text-xs">
            <label className="flex items-center gap-2 text-fg-muted">
              <input
                type="checkbox"
                checked={!!account.committed}
                onChange={(e) => void setAccountCommitted(user.uid, account.id, e.target.checked)}
              />
              Committed money, left out of the monthly budget
            </label>
            <button
              type="button"
              onClick={() => void setAccountArchived(user.uid, account.id, !account.archived)}
              className="self-start font-semibold text-fg-subtle hover:text-fg"
            >
              {account.archived ? 'Restore account' : 'Archive account'}
            </button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-edge p-8 text-center text-sm text-fg-subtle">
          Nothing has moved through this account yet.
        </p>
      ) : (
        <ul className="divide-y divide-edge rounded-lg border border-edge bg-surface px-4">
          {rows.map((t) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              currency={profileCurrency}
              category={t.categoryId ? categories.get(t.categoryId) : undefined}
              account={byId.get(t.accountId)}
              toAccount={t.toAccountId ? byId.get(t.toAccountId) : undefined}
              perspectiveAccountId={accountId}
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
