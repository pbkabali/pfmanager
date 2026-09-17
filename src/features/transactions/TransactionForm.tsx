import { Timestamp } from 'firebase/firestore'
import { useState, type FormEvent } from 'react'

import { useUser } from '../../app/providers/useAuth'
import { parseAmount } from '../../lib/money'
import { useOnlineStatus } from '../../lib/hooks/useOnlineStatus'
import { accountCurrency, type Account } from '../accounts/types'
import { useAccounts } from '../accounts/useAccounts'
import { useCategories } from '../categories/useCategories'
import { useProfile } from '../profile/profileContext'
import { fromDateInputValue, toDateInputValue } from './periods'
import type { TransactionType } from './types'
import { createIncome, createTransaction } from './useTransactions'

const TYPES: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Spent' },
  { value: 'income', label: 'Received' },
  { value: 'transfer', label: 'Moved' },
]

const field = 'mt-1 w-full rounded-md border border-edge bg-bg px-3 py-2 text-fg'
const label = 'text-xs font-semibold tracking-wide text-fg-muted uppercase'

/** One destination of an income: which account, and how much landed there. */
type Part = { key: number; accountId: string; amount: string }

let nextKey = 1
function newPart(accountId = ''): Part {
  return { key: nextKey++, accountId, amount: '' }
}

/**
 * Record one transaction. Optimised for the phone-in-a-shop case: amount
 * first and focused, type as three big toggles, sensible defaults for the
 * rest so most entries are amount + category + save.
 *
 * Every amount is typed in the currency of the account it touches. An income
 * can be split across several accounts, each part in that account's currency;
 * a transfer between accounts of different currencies asks for both sides.
 * No exchange rates: the numbers recorded are the numbers that happened.
 */
export function TransactionForm({ onSaved }: { onSaved?: () => void }) {
  const user = useUser()
  const { currency: profileCurrency } = useProfile()
  const online = useOnlineStatus()
  const { active: accounts } = useAccounts()
  const { categories } = useCategories()

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [parts, setParts] = useState<Part[]>(() => [newPart()])
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(() => toDateInputValue(new Date()))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const kind = type === 'income' ? 'income' : 'expense'
  const categoryOptions = categories.filter((c) => c.kind === kind && !c.archived)
  const currencyOf = (id: string) =>
    accountCurrency(
      accounts.find((a) => a.id === id),
      profileCurrency,
    )

  // Fall back to the first option so an untouched select still submits a value.
  const account = accountId || accounts[0]?.id || ''
  const toAccount = toAccountId || accounts.find((a) => a.id !== account)?.id || ''
  const category = categoryOptions.some((c) => c.id === categoryId)
    ? categoryId
    : (categoryOptions[0]?.id ?? '')
  const crossCurrency = type === 'transfer' && !!toAccount && currencyOf(account) !== currencyOf(toAccount)

  // Each part defaults to the first account not already used by an earlier part.
  const resolvedParts = parts.map((p, i) => {
    if (p.accountId) return { ...p, accountId: p.accountId }
    const taken = new Set(parts.slice(0, i).map((q) => q.accountId))
    const free = accounts.find((a) => !taken.has(a.id)) ?? accounts[0]
    return { ...p, accountId: free?.id ?? '' }
  })

  function updatePart(key: number, patch: Partial<Part>) {
    setParts((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  }

  function reset() {
    setAmount('')
    setToAmount('')
    setNote('')
    setParts([newPart()])
  }

  function fail(message: string) {
    setError(message)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!account) return fail('Add an account first.')
    if (type !== 'transfer' && !category) return fail('Choose a category.')
    const when = Timestamp.fromDate(fromDateInputValue(date))
    const shared = { categoryId: category, date: when, note: note.trim() }

    // Deliberately not awaited: offline, the promise only settles when the
    // server is reached, which could be hours. The local write is instant and
    // the list updates from the cache, so the form can reset right away.
    // A rejection reaches .catch only on a server-side rules failure.
    const report = (cause: unknown) =>
      setError(cause instanceof Error ? cause.message : 'Could not save.')

    if (type === 'income') {
      const seen = new Set<string>()
      const saved: { accountId: string; currency: string; amountMinor: number }[] = []
      for (const p of resolvedParts) {
        if (!p.accountId) return fail('Choose an account for every part.')
        if (seen.has(p.accountId)) return fail('Each account can appear once. Combine the amounts.')
        seen.add(p.accountId)
        const currency = currencyOf(p.accountId)
        const amountMinor = parseAmount(p.amount, currency)
        if (amountMinor === null || amountMinor <= 0) {
          return fail(
            resolvedParts.length > 1
              ? 'Every part needs an amount greater than zero.'
              : 'Enter an amount greater than zero.',
          )
        }
        saved.push({ accountId: p.accountId, currency, amountMinor })
      }
      createIncome(user.uid, shared, saved).catch(report)
      reset()
      onSaved?.()
      return
    }

    const currency = currencyOf(account)
    const amountMinor = parseAmount(amount, currency)
    if (amountMinor === null || amountMinor <= 0) return fail('Enter an amount greater than zero.')

    if (type === 'transfer') {
      if (!toAccount || toAccount === account) return fail('Choose two different accounts for a transfer.')
      let toAmountMinor: number | undefined
      if (crossCurrency) {
        const landed = parseAmount(toAmount, currencyOf(toAccount))
        if (landed === null || landed <= 0) {
          return fail(`Enter the amount received in ${currencyOf(toAccount)}.`)
        }
        toAmountMinor = landed
      }
      createTransaction(user.uid, {
        type,
        amountMinor,
        currency,
        accountId: account,
        toAccountId: toAccount,
        toAmountMinor,
        date: when,
        note: note.trim(),
      }).catch(report)
    } else {
      createTransaction(user.uid, {
        type,
        amountMinor,
        currency,
        accountId: account,
        categoryId: category,
        date: when,
        note: note.trim(),
      }).catch(report)
    }

    reset()
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

      {type === 'income' ? (
        <IncomeParts
          parts={resolvedParts}
          accounts={accounts}
          currencyOf={currencyOf}
          onChange={updatePart}
          onAdd={() => setParts((ps) => [...ps, newPart()])}
          onRemove={(key) => setParts((ps) => (ps.length > 1 ? ps.filter((p) => p.key !== key) : ps))}
        />
      ) : (
        <label className="block">
          <span className={label}>Amount ({currencyOf(account)})</span>
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
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {type !== 'income' && (
          <label className="block">
            <span className={label}>From</span>
            <select value={account} onChange={(e) => setAccountId(e.target.value)} className={field}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {accountCurrency(a, profileCurrency)}
                </option>
              ))}
            </select>
          </label>
        )}

        {type === 'transfer' ? (
          <>
            <label className="block">
              <span className={label}>To</span>
              <select value={toAccount} onChange={(e) => setToAccountId(e.target.value)} className={field}>
                {accounts
                  .filter((a) => a.id !== account)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {accountCurrency(a, profileCurrency)}
                    </option>
                  ))}
              </select>
            </label>
            {crossCurrency && (
              <label className="block sm:col-span-2">
                <span className={label}>Received as ({currencyOf(toAccount)})</span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="0"
                  value={toAmount}
                  onChange={(e) => setToAmount(e.target.value)}
                  className={`${field} tabular`}
                />
                <span className="mt-1 block text-xs text-fg-subtle">
                  The accounts use different currencies. Enter what actually arrived.
                </span>
              </label>
            )}
          </>
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

/**
 * Where an income landed. One line is the common case and looks like the
 * plain amount field; "Split across another account" adds a line per extra
 * destination, each amount in its own account's currency.
 */
function IncomeParts({
  parts,
  accounts,
  currencyOf,
  onChange,
  onAdd,
  onRemove,
}: {
  parts: Part[]
  accounts: Account[]
  currencyOf: (accountId: string) => string
  onChange: (key: number, patch: Partial<Part>) => void
  onAdd: () => void
  onRemove: (key: number) => void
}) {
  const single = parts.length === 1
  const canAdd = parts.length < accounts.length

  return (
    <fieldset className="space-y-3">
      <legend className={label}>{single ? 'Amount' : 'Received into'}</legend>
      {parts.map((p, i) => (
        <div key={p.key} className={single ? 'space-y-3' : 'grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto]'}>
          <label className={`block ${single ? '' : 'sm:order-2'}`}>
            <span className="sr-only">Amount ({currencyOf(p.accountId)})</span>
            <input
              type="text"
              inputMode="decimal"
              autoFocus={i === 0}
              required
              placeholder={`0 ${currencyOf(p.accountId)}`}
              aria-label={`Amount in ${currencyOf(p.accountId)}`}
              value={p.amount}
              onChange={(e) => onChange(p.key, { amount: e.target.value })}
              className={`${field} tabular ${single ? 'text-2xl font-bold' : ''}`}
            />
          </label>
          <label className={`block ${single ? '' : 'col-span-2 sm:order-1 sm:col-span-1'}`}>
            <span className={single ? label : 'sr-only'}>Into</span>
            <select
              value={p.accountId}
              onChange={(e) => onChange(p.key, { accountId: e.target.value })}
              className={field}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {currencyOf(a.id)}
                </option>
              ))}
            </select>
          </label>
          {!single && (
            <button
              type="button"
              onClick={() => onRemove(p.key)}
              aria-label="Remove this part"
              className="mt-1 self-start rounded-md border border-edge px-3 py-2 text-sm text-fg-subtle hover:text-danger-text sm:order-3"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {canAdd && (
        <button type="button" onClick={onAdd} className="text-sm font-semibold text-accent hover:underline">
          + Split across another account
        </button>
      )}
    </fieldset>
  )
}
