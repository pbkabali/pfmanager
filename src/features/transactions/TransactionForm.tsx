import { Timestamp } from 'firebase/firestore'
import { useState, type FormEvent } from 'react'

import { useUser } from '../../app/providers/useAuth'
import { Money } from '../../components/Money'
import { parseAmount } from '../../lib/money'
import { useOnlineStatus } from '../../lib/hooks/useOnlineStatus'
import { accountCurrency, type Account } from '../accounts/types'
import { useAccounts } from '../accounts/useAccounts'
import { daysRemaining, monthKey } from '../budgets/months'
import { useMonthStatus } from '../budgets/useBudget'
import { useCategories } from '../categories/useCategories'
import { useProfile } from '../profile/profileContext'
import { CURRENCIES } from '../profile/types'
import { isActionable, setAsideLines, type SetAsideLine } from '../setAsides/rules'
import { fromDateInputValue, toDateInputValue } from './periods'
import type { TransactionType } from './types'
import { createIncome, createTransaction, type SetAsideTransfer } from './useTransactions'

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
 * Incomes and transfers are typed in the currency of the account they touch.
 * An expense is typed in the currency it was priced in -- the profile's
 * default unless changed -- and when that differs from the paying account's
 * currency the form also asks what the account was charged. An income can be
 * split across several accounts, each part in that account's currency; a
 * transfer between accounts of different currencies asks for both sides.
 * No exchange rates: the numbers recorded are the numbers that happened.
 */
export function TransactionForm({ onSaved, onCancel }: { onSaved?: () => void; onCancel?: () => void }) {
  const user = useUser()
  const profile = useProfile()
  const { currency: profileCurrency } = profile
  const online = useOnlineStatus()
  const { active: accounts } = useAccounts()
  const { categories } = useCategories()

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [expenseCurrency, setExpenseCurrency] = useState(profileCurrency)
  const [accountAmount, setAccountAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [parts, setParts] = useState<Part[]>(() => [newPart()])
  // Set-aside lines the person unticked for this entry, keyed `${part.key}:${rule.id}`.
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set())
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(() => toDateInputValue(new Date()))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const kind = type === 'income' ? 'income' : 'expense'
  const categoryOptions = categories.filter((c) => c.kind === kind && !c.archived)

  // The month's budget, for showing what the chosen item still has. Follows
  // the date field, so back-dating an expense shows that month's balance.
  const budgetMonth = monthKey(fromDateInputValue(date))
  const monthStatus = useMonthStatus(budgetMonth)
  const currencyOf = (id: string) =>
    accountCurrency(
      accounts.find((a) => a.id === id),
      profileCurrency,
    )

  // Fall back to the first option so an untouched select still submits a value.
  // For an expense, prefer an account in the expense's currency: paying a UGX
  // bill from the UGX wallet is the common case and should need no extra field.
  const preferredAccount =
    type === 'expense' ? accounts.find((a) => accountCurrency(a, profileCurrency) === expenseCurrency) : undefined
  const account = accountId || preferredAccount?.id || accounts[0]?.id || ''
  const toAccount = toAccountId || accounts.find((a) => a.id !== account)?.id || ''
  const category = categoryOptions.some((c) => c.id === categoryId)
    ? categoryId
    : (categoryOptions[0]?.id ?? '')
  const crossCurrency = type === 'transfer' && !!toAccount && currencyOf(account) !== currencyOf(toAccount)
  const chargedInOtherCurrency = type === 'expense' && !!account && currencyOf(account) !== expenseCurrency

  const item = type === 'expense' ? monthStatus.status?.items.find((i) => i.categoryId === category) : undefined
  const itemCurrency = monthStatus.budget?.currency ?? profileCurrency
  const itemIsDaily = !!item && !!categories.find((c) => c.id === item.categoryId)?.daily
  const daysLeft = daysRemaining(budgetMonth)

  // Currencies offered for an expense: the profile default first, then any an
  // account uses, then the standard list. Whatever the price tag said.
  const expenseCurrencies = [
    ...new Set([
      profileCurrency,
      ...accounts.map((a) => accountCurrency(a, profileCurrency)),
      ...CURRENCIES,
    ]),
  ]

  // Each part defaults to the first account not already used by an earlier part.
  const resolvedParts = parts.map((p, i) => {
    if (p.accountId) return { ...p, accountId: p.accountId }
    const taken = new Set(parts.slice(0, i).map((q) => q.accountId))
    const free = accounts.find((a) => !taken.has(a.id)) ?? accounts[0]
    return { ...p, accountId: free?.id ?? '' }
  })

  // What each rule would move for each part, recomputed as amounts are typed.
  const linesByPart = new Map<number, SetAsideLine[]>()
  if (type === 'income') {
    for (const p of resolvedParts) {
      const currency = currencyOf(p.accountId)
      const amountMinor = parseAmount(p.amount, currency) ?? 0
      linesByPart.set(p.key, setAsideLines(profile.setAsides, { accountId: p.accountId, currency, amountMinor }))
    }
  }

  function toggleSkipped(partKey: number, ruleId: string) {
    setSkipped((prev) => {
      const next = new Set(prev)
      const k = `${partKey}:${ruleId}`
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  function updatePart(key: number, patch: Partial<Part>) {
    setParts((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  }

  function reset() {
    setAmount('')
    setToAmount('')
    setAccountAmount('')
    setNote('')
    setParts([newPart()])
    setSkipped(new Set())
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
      const transfers: SetAsideTransfer[] = []
      for (const p of resolvedParts) {
        for (const line of linesByPart.get(p.key) ?? []) {
          if (!isActionable(line) || skipped.has(`${p.key}:${line.rule.id}`)) continue
          transfers.push({
            setAsideId: line.rule.id,
            accountId: p.accountId,
            toAccountId: line.toAccountId,
            currency: currencyOf(p.accountId),
            amountMinor: line.amountMinor,
          })
        }
      }
      createIncome(user.uid, shared, saved, transfers).catch(report)
      reset()
      onSaved?.()
      return
    }

    const currency = type === 'expense' ? expenseCurrency : currencyOf(account)
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
      let accountAmountMinor: number | undefined
      if (chargedInOtherCurrency) {
        const charged = parseAmount(accountAmount, currencyOf(account))
        if (charged === null || charged <= 0) {
          return fail(`Enter what the account was charged in ${currencyOf(account)}.`)
        }
        accountAmountMinor = charged
      }
      createTransaction(user.uid, {
        type,
        amountMinor,
        currency,
        accountId: account,
        accountAmountMinor,
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
          linesByPart={linesByPart}
          skipped={skipped}
          onToggleSkipped={toggleSkipped}
          onChange={updatePart}
          onAdd={() => setParts((ps) => [...ps, newPart()])}
          onRemove={(key) => setParts((ps) => (ps.length > 1 ? ps.filter((p) => p.key !== key) : ps))}
        />
      ) : type === 'expense' ? (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="block">
            <span className={label}>Amount</span>
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
          <label className="block">
            <span className={label}>Currency</span>
            <select
              value={expenseCurrency}
              onChange={(e) => setExpenseCurrency(e.target.value)}
              aria-label="Currency the expense was priced in"
              className={`${field} text-2xl font-bold`}
            >
              {expenseCurrencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
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
          <>
            <label className="block">
              <span className={label}>Category</span>
              <select value={category} onChange={(e) => setCategoryId(e.target.value)} className={field}>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
              {item && (
                <span
                  className={`mt-1 block text-xs ${item.availableMinor < 0 ? 'text-negative-text' : 'text-fg-subtle'}`}
                >
                  {item.availableMinor < 0 ? 'Over by ' : 'Available this month: '}
                  <Money amountMinor={Math.abs(item.availableMinor)} currency={itemCurrency} />
                  {itemIsDaily && item.availableMinor > 0 && daysLeft > 0 && (
                    <>
                      {' · '}
                      <Money amountMinor={Math.floor(item.availableMinor / daysLeft)} currency={itemCurrency} />
                      /day for {daysLeft} day{daysLeft === 1 ? '' : 's'}
                    </>
                  )}
                </span>
              )}
              {type === 'expense' && monthStatus.budget === null && (
                <span className="mt-1 block text-xs text-fg-subtle">No budget set for this month.</span>
              )}
            </label>
            {chargedInOtherCurrency && (
              <label className="block sm:col-span-2">
                <span className={label}>Charged to account as ({currencyOf(account)})</span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="0"
                  value={accountAmount}
                  onChange={(e) => setAccountAmount(e.target.value)}
                  className={`${field} tabular`}
                />
                <span className="mt-1 block text-xs text-fg-subtle">
                  The account uses a different currency. Enter what it was actually debited.
                </span>
              </label>
            )}
          </>
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

      <div className="flex gap-2">
        <button type="submit" className="flex-1 rounded-md bg-accent py-2.5 font-bold text-accent-fg">
          Save
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-md border border-edge px-4 py-2.5 text-sm text-fg-muted">
            Cancel
          </button>
        )}
      </div>

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
  linesByPart,
  skipped,
  onToggleSkipped,
  onChange,
  onAdd,
  onRemove,
}: {
  parts: Part[]
  accounts: Account[]
  currencyOf: (accountId: string) => string
  linesByPart: Map<number, SetAsideLine[]>
  skipped: Set<string>
  onToggleSkipped: (partKey: number, ruleId: string) => void
  onChange: (key: number, patch: Partial<Part>) => void
  onAdd: () => void
  onRemove: (key: number) => void
}) {
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '?'
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
          {(linesByPart.get(p.key)?.length ?? 0) > 0 && (
            <ul className={`space-y-1 text-xs ${single ? '' : 'col-span-2 sm:order-4 sm:col-span-3'}`}>
              {(linesByPart.get(p.key) ?? []).map((line) => {
                const key = `${p.key}:${line.rule.id}`
                const actionable = isActionable(line)
                return (
                  <li key={line.rule.id} className="flex items-center gap-2 text-fg-muted">
                    {actionable ? (
                      <label className="flex flex-1 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!skipped.has(key)}
                          onChange={() => onToggleSkipped(p.key, line.rule.id)}
                        />
                        <span className={skipped.has(key) ? 'line-through opacity-60' : ''}>
                          {line.rule.name} {formatShareLabel(line.rule.shareBp)}:{' '}
                          <Money amountMinor={line.amountMinor} currency={currencyOf(p.accountId)} /> to{' '}
                          {accountName(line.toAccountId)}
                        </span>
                      </label>
                    ) : line.selfDirected ? (
                      <span className="opacity-70">
                        {line.rule.name}: skipped, this already goes into {accountName(p.accountId)}
                      </span>
                    ) : !line.toAccountId ? (
                      <span className="opacity-70">
                        {line.rule.name}: no {currencyOf(p.accountId)} account set, nothing will move
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
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

function formatShareLabel(bp: number): string {
  return `${(bp / 100).toFixed(2).replace(/\.?0+$/, '')}%`
}
