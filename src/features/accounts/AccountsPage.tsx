import { useMemo, useState, type FormEvent } from 'react'

import { useUser } from '../../app/providers/useAuth'
import { Money } from '../../components/Money'
import { PageHeader } from '../../components/PageHeader'
import { parseAmount } from '../../lib/money'
import { useProfile } from '../profile/profileContext'
import { useTransactions } from '../transactions/useTransactions'
import { ACCOUNT_TYPES, type AccountType } from './types'
import { createAccount, setAccountArchived, useAccounts } from './useAccounts'

const field = 'mt-1 w-full rounded-md border border-edge bg-bg px-3 py-2 text-fg'
const label = 'text-xs font-semibold tracking-wide text-fg-muted uppercase'

export function AccountsPage() {
  const user = useUser()
  const { currency } = useProfile()
  const { accounts, loading } = useAccounts()
  // Balances are derived, never stored: opening balance plus every movement.
  // Storing them would mean keeping two things in sync on every write, and
  // offline writes make that genuinely hard to get right.
  const { transactions } = useTransactions({ max: 10000 })
  const [adding, setAdding] = useState(false)

  const balances = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of accounts) map.set(a.id, a.openingBalanceMinor)
    for (const t of transactions) {
      const sign = t.type === 'income' ? 1 : -1
      map.set(t.accountId, (map.get(t.accountId) ?? 0) + sign * t.amountMinor)
      if (t.type === 'transfer' && t.toAccountId) {
        map.set(t.toAccountId, (map.get(t.toAccountId) ?? 0) + t.amountMinor)
      }
    }
    return map
  }, [accounts, transactions])

  const total = accounts.filter((a) => !a.archived).reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0)

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Where your money sits"
        action={
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-accent-fg"
          >
            {adding ? 'Close' : '+ Add'}
          </button>
        }
      />

      {adding && <NewAccountForm currency={currency} onSaved={() => setAdding(false)} />}

      <div className="mb-4 rounded-lg border border-edge bg-surface p-4">
        <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">Total</p>
        <Money amountMinor={total} currency={currency} className="text-2xl font-bold text-fg" />
      </div>

      {loading ? (
        <p className="text-sm text-fg-subtle">Loading…</p>
      ) : (
        <ul className="divide-y divide-edge rounded-lg border border-edge bg-surface px-4">
          {accounts.map((a) => {
            const meta = ACCOUNT_TYPES.find((t) => t.value === a.type)
            return (
              <li key={a.id} className={`flex items-center gap-3 py-3 ${a.archived ? 'opacity-50' : ''}`}>
                <span aria-hidden className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-raised text-lg">
                  {meta?.icon ?? '▤'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{a.name}</p>
                  <p className="text-xs text-fg-subtle">
                    {meta?.label ?? a.type}
                    {a.archived && ' · archived'}
                  </p>
                </div>
                <Money amountMinor={balances.get(a.id) ?? 0} currency={currency} className="text-sm font-semibold" />
                <button
                  type="button"
                  onClick={() => void setAccountArchived(user.uid, a.id, !a.archived)}
                  className="flex-none text-xs font-semibold text-fg-subtle hover:text-fg"
                >
                  {a.archived ? 'Restore' : 'Archive'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function NewAccountForm({ currency, onSaved }: { currency: string; onSaved: () => void }) {
  const user = useUser()
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('mobile_money')
  const [opening, setOpening] = useState('')
  const [error, setError] = useState<string | null>(null)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const openingBalanceMinor = opening.trim() === '' ? 0 : parseAmount(opening, currency)
    if (openingBalanceMinor === null) {
      setError('Opening balance must be a number.')
      return
    }
    if (!name.trim()) {
      setError('Give the account a name.')
      return
    }
    void createAccount(user.uid, { name: name.trim(), type, openingBalanceMinor })
    onSaved()
  }

  return (
    <form onSubmit={onSubmit} className="mb-6 space-y-4 rounded-lg border border-edge bg-surface p-4">
      <label className="block">
        <span className={label}>Name</span>
        <input
          type="text"
          required
          autoFocus
          placeholder="e.g. MTN MoMo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as AccountType)} className={field}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Balance today ({currency})</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            className={`${field} tabular`}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      )}
      <button type="submit" className="w-full rounded-md bg-accent py-2.5 font-bold text-accent-fg">
        Add account
      </button>
    </form>
  )
}
