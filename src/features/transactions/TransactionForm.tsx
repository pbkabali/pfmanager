import { Timestamp } from 'firebase/firestore'
import { useState, type FormEvent } from 'react'

import { useUser } from '../../app/providers/useAuth'
import { parseAmount } from '../../lib/money'
import { useOnlineStatus } from '../../lib/hooks/useOnlineStatus'
import { useAccounts } from '../accounts/useAccounts'
import { useCategories } from '../categories/useCategories'
import { useProfile } from '../profile/profileContext'
import { fromDateInputValue, toDateInputValue } from './periods'
import type { TransactionType } from './types'
import { createTransaction } from './useTransactions'

const TYPES: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Spent' },
  { value: 'income', label: 'Received' },
  { value: 'transfer', label: 'Moved' },
]

const field = 'mt-1 w-full rounded-md border border-edge bg-bg px-3 py-2 text-fg'
const label = 'text-xs font-semibold tracking-wide text-fg-muted uppercase'

/**
 * Record one transaction. Optimised for the phone-in-a-shop case: amount
 * first and focused, type as three big toggles, sensible defaults for the
 * rest so most entries are amount + category + save.
 */
export function TransactionForm({ onSaved }: { onSaved?: () => void }) {
  const user = useUser()
  const { currency } = useProfile()
  const online = useOnlineStatus()
  const { active: accounts } = useAccounts()
  const { categories } = useCategories()

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(() => toDateInputValue(new Date()))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const kind = type === 'income' ? 'income' : 'expense'
  const categoryOptions = categories.filter((c) => c.kind === kind && !c.archived)

  // Fall back to the first option so an untouched select still submits a value.
  const account = accountId || accounts[0]?.id || ''
  const toAccount = toAccountId || accounts.find((a) => a.id !== account)?.id || ''
  const category = categoryOptions.some((c) => c.id === categoryId)
    ? categoryId
    : (categoryOptions[0]?.id ?? '')

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const amountMinor = parseAmount(amount, currency)
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (!account) {
      setError('Add an account first.')
      return
    }
    if (type === 'transfer' && (!toAccount || toAccount === account)) {
      setError('Choose two different accounts for a transfer.')
      return
    }
    if (type !== 'transfer' && !category) {
      setError('Choose a category.')
      return
    }

    // Deliberately not awaited: offline, the promise only settles when the
    // server is reached, which could be hours. The local write is instant and
    // the list updates from the cache, so the form can reset right away.
    createTransaction(user.uid, {
      type,
      amountMinor,
      accountId: account,
      toAccountId: type === 'transfer' ? toAccount : undefined,
      categoryId: type === 'transfer' ? undefined : category,
      date: Timestamp.fromDate(fromDateInputValue(date)),
      note: note.trim(),
    }).catch((cause: unknown) => {
      // Reaches here only on a server-side rejection (a rules failure), since
      // network absence merely delays the write.
      setError(cause instanceof Error ? cause.message : 'Could not save.')
    })

    setAmount('')
    setNote('')
    onSaved?.()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-edge bg-surface p-4">
      <div role="radiogroup" aria-label="Type" className="grid grid-cols-3 gap-1 rounded-md border border-edge p-0.5">
        {TYPES.map((t) => {
          const active = t.value === type
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setType(t.value)}
              className={`rounded px-2 py-2 text-sm font-semibold transition-colors ${
                active ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:text-fg'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <label className="block">
        <span className={label}>Amount ({currency})</span>
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          required
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${field} tabular text-2xl font-bold`}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>{type === 'income' ? 'Into' : 'From'}</span>
          <select value={account} onChange={(e) => setAccountId(e.target.value)} className={field}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        {type === 'transfer' ? (
          <label className="block">
            <span className={label}>To</span>
            <select value={toAccount} onChange={(e) => setToAccountId(e.target.value)} className={field}>
              {accounts
                .filter((a) => a.id !== account)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
        ) : (
          <label className="block">
            <span className={label}>Category</span>
            <select value={category} onChange={(e) => setCategoryId(e.target.value)} className={field}>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className={label}>Date</span>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>

        <label className="block">
          <span className={label}>Note</span>
          <input
            type="text"
            placeholder="Optional"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={field}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      )}

      <button type="submit" className="w-full rounded-md bg-accent py-2.5 font-bold text-accent-fg">
        Save
      </button>

      {!online && (
        <p className="text-center text-xs text-fg-subtle">
          Offline: this will be saved here and sync later.
        </p>
      )}
    </form>
  )
}
