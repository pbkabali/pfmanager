import { useMemo, useState, type FormEvent } from 'react'

import { useUser } from '../../app/providers/useAuth'
import { Money } from '../../components/Money'
import { formatMoney, parseAmount } from '../../lib/money'
import { computeBalances } from '../accounts/balances'
import { accountCurrency } from '../accounts/types'
import { useAccounts } from '../accounts/useAccounts'
import type { Category } from '../categories/types'
import { useProfile } from '../profile/profileContext'
import { budgetCapPercent } from '../profile/types'
import { useTransactions } from '../transactions/useTransactions'
import { allocate, BP_TOTAL, formatPercent, sharesTotal } from './allocate'
import { monthLabelFor, shiftMonth } from './months'
import { createBudget, useMonthStatus } from './useBudget'

const field = 'mt-1 w-full rounded-md border border-edge bg-bg px-3 py-2 text-fg'
const label = 'text-xs font-semibold tracking-wide text-fg-muted uppercase'

type Line = { key: number; accountId: string; amount: string }
let nextKey = 1

/**
 * Earmark a lumpsum for a month. Nothing moves between accounts: the amount
 * is recorded against the accounts it sits in, checked against the cap, added
 * to whatever the previous month left unspent, and split by the plan's shares.
 */
export function FundBudgetForm({
  month,
  categories,
  onDone,
}: {
  month: string
  categories: Category[]
  onDone: () => void
}) {
  const user = useUser()
  const profile = useProfile()
  const currency = profile.currency
  const capPercent = budgetCapPercent(profile)

  // Cap base: every active account in the budget currency, at its current balance.
  const { active: accounts } = useAccounts()
  const { transactions: allTransactions } = useTransactions({ max: 10000 })
  const eligible = useMemo(
    () => accounts.filter((a) => accountCurrency(a, currency) === currency && !a.committed),
    [accounts, currency],
  )
  const balances = useMemo(() => computeBalances(accounts, allTransactions), [accounts, allTransactions])
  const poolMinor = eligible.reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0)
  const capMinor = Math.max(0, Math.floor((poolMinor * capPercent) / 100))

  // Carry-over: what the previous month has left unspent, right now.
  const previous = useMonthStatus(shiftMonth(month, -1))
  const carriedMinor = previous.status?.carryOverMinor ?? 0

  const shares = useMemo(() => {
    const out: Record<string, number> = {}
    for (const c of categories) {
      if (c.kind === 'expense' && !c.archived && (c.shareBp ?? 0) > 0) out[c.id] = c.shareBp ?? 0
    }
    return out
  }, [categories])
  const planComplete = sharesTotal(shares) === BP_TOTAL

  const [lines, setLines] = useState<Line[]>(() => [{ key: nextKey++, accountId: '', amount: '' }])
  const [error, setError] = useState<string | null>(null)

  const resolved = lines.map((l, i) => {
    if (l.accountId) return l
    const taken = new Set(lines.slice(0, i).map((q) => q.accountId))
    return { ...l, accountId: (eligible.find((a) => !taken.has(a.id)) ?? eligible[0])?.id ?? '' }
  })
  const fundedMinor = resolved.reduce((sum, l) => sum + (parseAmount(l.amount, currency) ?? 0), 0)
  const totalMinor = carriedMinor + fundedMinor
  const preview = useMemo(() => allocate(totalMinor, shares), [totalMinor, shares])
  const overCap = fundedMinor > capMinor

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!planComplete) return setError('The plan must total exactly 100% before a month can be funded.')
    if (eligible.length === 0) return setError(`Add an account in ${currency} first.`)

    const sources: { accountId: string; amountMinor: number }[] = []
    const seen = new Set<string>()
    for (const l of resolved) {
      if (seen.has(l.accountId)) return setError('Each account can appear once. Combine the amounts.')
      seen.add(l.accountId)
      const amountMinor = parseAmount(l.amount, currency)
      if (amountMinor === null || amountMinor < 0) return setError('Every amount must be a number.')
      if (amountMinor === 0) continue
      const available = balances.get(l.accountId) ?? 0
      if (amountMinor > available) {
        const name = eligible.find((a) => a.id === l.accountId)?.name ?? 'That account'
        return setError(`${name} does not hold that much.`)
      }
      sources.push({ accountId: l.accountId, amountMinor })
    }
    if (fundedMinor <= 0 && carriedMinor <= 0) return setError('Enter an amount to earmark.')
    if (overCap) return setError(`That exceeds your ${capPercent}% cap. Lower the amount or raise the cap in Settings.`)

    createBudget(user.uid, {
      month,
      currency,
      fundedMinor,
      carriedMinor,
      sources,
      shares,
      allocations: allocate(totalMinor, shares),
      capPercent,
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not save.'))
    onDone()
  }

  const byId = new Map(categories.map((c) => [c.id, c]))

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-lg border border-edge bg-surface p-4">
      <div>
        <h2 className="text-base font-bold text-fg">Fund {monthLabelFor(month)}</h2>
        <p className="mt-0.5 text-xs text-fg-subtle">
          Set aside part of what you hold in {currency}. The money stays where it is; this records what it is for.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-md bg-surface-raised p-3">
          <dt className={label}>Carried over</dt>
          <dd className="mt-1 font-semibold text-fg">
            {previous.loading && previous.budget === undefined ? (
              '…'
            ) : (
              <Money amountMinor={carriedMinor} currency={currency} />
            )}
          </dd>
          <dd className="text-xs text-fg-subtle">
            {previous.budget ? `unspent in ${monthLabelFor(shiftMonth(month, -1))}` : 'no previous budget'}
          </dd>
        </div>
        <div className="rounded-md bg-surface-raised p-3">
          <dt className={label}>Cap</dt>
          <dd className="mt-1 font-semibold text-fg">
            <Money amountMinor={capMinor} currency={currency} />
          </dd>
          <dd className="text-xs text-fg-subtle">
            {capPercent}% of <Money amountMinor={poolMinor} currency={currency} /> across {eligible.length}{' '}
            {currency} account{eligible.length === 1 ? '' : 's'}
            {accounts.some((a) => a.committed) && ', committed accounts left out'}
          </dd>
        </div>
        <div className={`rounded-md p-3 ${overCap ? 'bg-danger/10' : 'bg-surface-raised'}`}>
          <dt className={label}>Lumpsum</dt>
          <dd className={`mt-1 font-semibold ${overCap ? 'text-danger-text' : 'text-fg'}`}>
            <Money amountMinor={totalMinor} currency={currency} />
          </dd>
          <dd className="text-xs text-fg-subtle">
            <Money amountMinor={fundedMinor} currency={currency} /> new{overCap && ' · over the cap'}
          </dd>
        </div>
      </dl>

      <fieldset className="space-y-2">
        <legend className={label}>Take from</legend>
        {eligible.length === 0 ? (
          <p className="text-sm text-danger-text">You have no active account in {currency}.</p>
        ) : (
          resolved.map((l) => (
            <div key={l.key} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <select
                value={l.accountId}
                onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, accountId: e.target.value } : x)))}
                aria-label="Account"
                className={`${field} col-span-2 sm:col-span-1`}
              >
                {eligible.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {formatMoney(balances.get(a.id) ?? 0, currency)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                inputMode="decimal"
                placeholder={`0 ${currency}`}
                aria-label={`Amount in ${currency}`}
                value={l.amount}
                onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, amount: e.target.value } : x)))}
                className={`${field} tabular`}
              />
              {lines.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  aria-label="Remove"
                  className="mt-1 rounded-md border border-edge px-3 text-sm text-fg-subtle hover:text-danger-text"
                >
                  ✕
                </button>
              ) : (
                <span />
              )}
            </div>
          ))
        )}
        {lines.length < eligible.length && (
          <button
            type="button"
            onClick={() => setLines((ls) => [...ls, { key: nextKey++, accountId: '', amount: '' }])}
            className="text-sm font-semibold text-accent-text hover:underline"
          >
            + Also from another account
          </button>
        )}
      </fieldset>

      <section>
        <h3 className={label}>How it will be split</h3>
        {!planComplete ? (
          <p className="mt-1 text-sm text-danger-text">
            The plan totals {formatPercent(sharesTotal(shares))}%. Edit the plan until it is exactly 100%.
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-edge text-sm">
            {Object.entries(preview)
              .sort((a, b) => (byId.get(a[0])?.sortOrder ?? 0) - (byId.get(b[0])?.sortOrder ?? 0))
              .map(([id, amount]) => (
                <li key={id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="truncate text-fg">
                    {byId.get(id)?.icon} {byId.get(id)?.name ?? id}
                    <span className="ml-2 text-xs text-fg-subtle">{formatPercent(shares[id] ?? 0)}%</span>
                  </span>
                  <Money amountMinor={amount} currency={currency} className="font-semibold" />
                </li>
              ))}
          </ul>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!planComplete || eligible.length === 0}
        className="w-full rounded-md bg-accent py-2.5 font-bold text-accent-fg disabled:opacity-50"
      >
        Fund {monthLabelFor(month)}
      </button>
    </form>
  )
}
