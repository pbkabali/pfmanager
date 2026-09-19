import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useUser } from '../../app/providers/useAuth'
import { Money } from '../../components/Money'
import { PageHeader } from '../../components/PageHeader'
import { parseAmount } from '../../lib/money'
import { useEarmarks } from '../budgets/useEarmarks'
import { useProfile } from '../profile/profileContext'
import { CURRENCIES } from '../profile/types'
import { useTransactions } from '../transactions/useTransactions'
import { computeBalances, totalsByCurrency } from './balances'
import { ACCOUNT_TYPES, accountCurrency, type AccountType } from './types'
import { createAccount, setAccountArchived, useAccounts } from './useAccounts'

const field = 'mt-1 w-full rounded-md border border-edge bg-bg px-3 py-2 text-fg'
const label = 'text-xs font-semibold tracking-wide text-fg-muted uppercase'

export function AccountsPage() {
  const user = useUser()
  const { currency: profileCurrency } = useProfile()
  const { accounts, loading } = useAccounts()
  const { transactions } = useTransactions({ max: 10000 })
  const [adding, setAdding] = useState(false)

  const balances = useMemo(() => computeBalances(accounts, transactions), [accounts, transactions])
  // One total per currency. Adding a USD balance to a UGX balance would be a
  // number that means nothing, so the page never does it.
  const totals = useMemo(
    () => totalsByCurrency(accounts, balances, profileCurrency),
    [accounts, balances, profileCurrency],
  )
  // What the budget has spoken for, per account and then per currency, so a
  // total can be read as "this much is actually yours to amass, the rest is
  // promised to the month".
  const earmarks = useEarmarks()
  // Committed accounts hold money promised to someone else (tithe, parents).
  // It is held, but it is not amassed, so it comes out of the headline too.
  const { earmarkedByCurrency, committedByCurrency } = useMemo(() => {
    const earmarkedByCurrency = new Map<string, number>()
    const committedByCurrency = new Map<string, number>()
    for (const a of accounts) {
      if (a.archived) continue
      const cur = accountCurrency(a, profileCurrency)
      earmarkedByCurrency.set(cur, (earmarkedByCurrency.get(cur) ?? 0) + (earmarks.get(a.id) ?? 0))
      if (a.committed) {
        committedByCurrency.set(cur, (committedByCurrency.get(cur) ?? 0) + (balances.get(a.id) ?? 0))
      }
    }
    return { earmarkedByCurrency, committedByCurrency }
  }, [accounts, earmarks, balances, profileCurrency])

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

      {adding && <NewAccountForm defaultCurrency={profileCurrency} onSaved={() => setAdding(false)} />}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(totals.length ? totals : [{ currency: profileCurrency, totalMinor: 0 }]).map((t) => (
          <div key={t.currency} className="rounded-lg border border-edge bg-surface p-4">
            <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">Total amassed · {t.currency}</p>
            <Money
              amountMinor={
                t.totalMinor -
                (earmarkedByCurrency.get(t.currency) ?? 0) -
                (committedByCurrency.get(t.currency) ?? 0)
              }
              currency={t.currency}
              className="text-2xl font-bold text-fg"
            />
            <p className="mt-1 text-xs text-fg-subtle">
              <Money amountMinor={t.totalMinor} currency={t.currency} /> held ·{' '}
              <Money amountMinor={earmarkedByCurrency.get(t.currency) ?? 0} currency={t.currency} /> earmarked
              {(committedByCurrency.get(t.currency) ?? 0) > 0 && (
                <>
                  {' · '}
                  <Money amountMinor={committedByCurrency.get(t.currency) ?? 0} currency={t.currency} /> committed
                </>
              )}
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-fg-subtle">Loading…</p>
      ) : (
        <ul className="divide-y divide-edge rounded-lg border border-edge bg-surface px-4">
          {accounts.map((a) => {
            const meta = ACCOUNT_TYPES.find((t) => t.value === a.type)
            const currency = accountCurrency(a, profileCurrency)
            return (
              <li key={a.id} className={`flex items-center gap-3 py-3 ${a.archived ? 'opacity-50' : ''}`}>
                <span aria-hidden className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-raised text-lg">
                  {meta?.icon ?? '▤'}
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/accounts/${a.id}`} className="block truncate text-sm font-semibold text-fg hover:underline">
                    {a.name}
                  </Link>
                  <p className="text-xs text-fg-subtle">
                    {meta?.label ?? a.type} · {currency}
                    {a.committed && ' · committed'}
                    {a.archived && ' · archived'}
                  </p>
                </div>
                <span className="flex-none text-right">
                  {/* Same reading as the tile: what is free to amass, then how it splits. */}
                  <Money
                    amountMinor={(balances.get(a.id) ?? 0) - (earmarks.get(a.id) ?? 0)}
                    currency={currency}
                    className="text-sm font-semibold"
                  />
                  {(earmarks.get(a.id) ?? 0) > 0 && (
                    <span className="block text-xs text-fg-subtle">
                      <Money amountMinor={balances.get(a.id) ?? 0} currency={currency} /> held
                      <span className="block">
                        <Money amountMinor={earmarks.get(a.id) ?? 0} currency={currency} /> earmarked
                      </span>
                    </span>
                  )}
                </span>
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

function NewAccountForm({ defaultCurrency, onSaved }: { defaultCurrency: string; onSaved: () => void }) {
  const user = useUser()
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('mobile_money')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [opening, setOpening] = useState('')
  const [committed, setCommitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Offer the profile's currency even if it is not in the fixed list.
  const currencyOptions = CURRENCIES.includes(defaultCurrency as (typeof CURRENCIES)[number])
    ? CURRENCIES
    : [defaultCurrency, ...CURRENCIES]

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
    void createAccount(user.uid, { name: name.trim(), type, currency, openingBalanceMinor, committed })
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
      <div className="grid gap-4 sm:grid-cols-3">
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
          <span className={label}>Currency</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={field}>
            {currencyOptions.map((c) => (
              <option key={c} value={c}>
                {c}
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
      <label className="flex items-start gap-2 text-sm text-fg-muted">
        <input type="checkbox" checked={committed} onChange={(e) => setCommitted(e.target.checked)} className="mt-1" />
        <span>
          Committed money
          <span className="block text-xs text-fg-subtle">
            Promised to someone else, like a tithe or parents account. Left out of the monthly budget.
          </span>
        </span>
      </label>
      <p className="text-xs text-fg-subtle">
        The currency is fixed once the account exists. Money changes currency by moving between accounts.
      </p>
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
