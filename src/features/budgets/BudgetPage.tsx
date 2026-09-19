import { useMemo, useState } from 'react'

import { useUser } from '../../app/providers/useAuth'
import { Money } from '../../components/Money'
import { PageHeader } from '../../components/PageHeader'
import { useAccounts } from '../accounts/useAccounts'
import { useCategories } from '../categories/useCategories'
import { formatPercent } from './allocate'
import { FundBudgetForm } from './FundBudgetForm'
import { daysRemaining, isLastDayOfMonth, monthKey, monthLabelFor, shiftMonth } from './months'
import { PlanEditor } from './PlanEditor'
import { deleteBudget, useMonthStatus } from './useBudget'

/**
 * The month's envelope: what was set aside, how it was split, what is left
 * per item, and for the daily item what that leaves per remaining day.
 * Browse back to see past months; forward one to fund the next.
 */
export function BudgetPage() {
  const user = useUser()
  const [offset, setOffset] = useState(() => (isLastDayOfMonth() ? 1 : 0))
  const month = shiftMonth(monthKey(), offset)
  const { budget, status, loading, fromCache } = useMonthStatus(month)
  const { categories, byId } = useCategories()
  const { byId: accounts } = useAccounts()
  const [editingPlan, setEditingPlan] = useState(false)

  const items = useMemo(
    () =>
      status
        ? [...status.items].sort(
            (a, b) => (byId.get(a.categoryId)?.sortOrder ?? 0) - (byId.get(b.categoryId)?.sortOrder ?? 0),
          )
        : [],
    [status, byId],
  )
  const daily = items.find((i) => byId.get(i.categoryId)?.daily)
  const remaining = daysRemaining(month)
  const isCurrent = offset === 0
  const nextMonth = shiftMonth(monthKey(), 1)

  return (
    <>
      <PageHeader
        title="Budget"
        subtitle={fromCache ? 'Showing saved copy' : undefined}
        action={
          <div className="flex items-center gap-1 rounded-md border border-edge">
            <button
              type="button"
              onClick={() => setOffset((o) => o - 1)}
              aria-label="Previous month"
              className="px-3 py-2 text-sm text-fg-muted hover:text-fg"
            >
              ‹
            </button>
            <span className="min-w-[9rem] text-center text-sm font-semibold text-fg">{monthLabelFor(month)}</span>
            <button
              type="button"
              onClick={() => setOffset((o) => o + 1)}
              disabled={offset >= 1}
              aria-label="Next month"
              className="px-3 py-2 text-sm text-fg-muted hover:text-fg disabled:opacity-30"
            >
              ›
            </button>
          </div>
        }
      />

      {loading && budget === undefined ? (
        <p className="text-sm text-fg-subtle">Loading…</p>
      ) : budget === null ? (
        offset < 0 ? (
          <p className="rounded-lg border border-dashed border-edge p-8 text-center text-sm text-fg-subtle">
            No budget was set for {monthLabelFor(month)}.
          </p>
        ) : (
          <FundBudgetForm month={month} categories={categories} onDone={() => undefined} />
        )
      ) : budget && status ? (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-3" aria-label="Month summary">
            <Tile label="Lumpsum">
              <Money amountMinor={status.totalMinor} currency={budget.currency} className="text-xl font-bold" />
              <p className="mt-1 text-xs text-fg-subtle">
                <Money amountMinor={budget.fundedMinor} currency={budget.currency} /> new
                {budget.carriedMinor > 0 && (
                  <>
                    {' + '}
                    <Money amountMinor={budget.carriedMinor} currency={budget.currency} /> carried
                  </>
                )}
              </p>
            </Tile>
            <Tile label="Spent">
              <Money
                amountMinor={status.spentMinor}
                currency={budget.currency}
                direction="out"
                className="text-xl font-bold"
              />
            </Tile>
            <Tile label="Available">
              <Money
                amountMinor={status.availableMinor}
                currency={budget.currency}
                className={`text-xl font-bold ${status.availableMinor < 0 ? 'text-negative-text' : 'text-fg'}`}
              />
              {remaining > 0 && <p className="mt-1 text-xs text-fg-subtle">{remaining} day{remaining === 1 ? '' : 's'} left</p>}
            </Tile>
          </section>

          {daily && (
            <section className="rounded-lg border border-accent/40 bg-accent/5 p-4" aria-label="Daily expenses">
              <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
                {byId.get(daily.categoryId)?.icon} {byId.get(daily.categoryId)?.name ?? 'Daily expenses'}
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-fg-subtle">Available</p>
                  <Money
                    amountMinor={daily.availableMinor}
                    currency={budget.currency}
                    className={`text-2xl font-bold ${daily.availableMinor < 0 ? 'text-negative-text' : 'text-fg'}`}
                  />
                </div>
                <div>
                  <p className="text-xs text-fg-subtle">
                    {remaining > 0 ? `Per day for the next ${remaining} day${remaining === 1 ? '' : 's'}` : 'Per day'}
                  </p>
                  {remaining > 0 ? (
                    <Money
                      amountMinor={Math.floor(Math.max(daily.availableMinor, 0) / remaining)}
                      currency={budget.currency}
                      className="text-2xl font-bold text-fg"
                    />
                  ) : (
                    <p className="text-sm text-fg-subtle">The month is over.</p>
                  )}
                </div>
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">Items</h2>
            <ul className="divide-y divide-edge rounded-lg border border-edge bg-surface px-4">
              {items.map((item) => {
                const c = byId.get(item.categoryId)
                const used = item.allocatedMinor > 0 ? Math.min(item.spentMinor / item.allocatedMinor, 1) : item.spentMinor > 0 ? 1 : 0
                const over = item.availableMinor < 0
                return (
                  <li key={item.categoryId} className="py-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-semibold text-fg">
                        {c?.icon ?? '•'} {c?.name ?? item.categoryId}
                        <span className="ml-2 text-xs font-normal text-fg-subtle">{formatPercent(item.shareBp)}%</span>
                      </span>
                      <span className="flex-none text-right">
                        <Money
                          amountMinor={item.availableMinor}
                          currency={budget.currency}
                          className={`font-semibold ${over ? 'text-negative-text' : 'text-fg'}`}
                        />
                        <span className="block text-xs text-fg-subtle">
                          of <Money amountMinor={item.allocatedMinor} currency={budget.currency} />
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised" aria-hidden>
                      <div
                        className={`h-full rounded-full ${over ? 'bg-danger' : 'bg-accent'}`}
                        style={{ width: `${Math.round(used * 100)}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
            {(status.unbudgetedMinor > 0 || status.unconvertedCount > 0) && (
              <p className="mt-2 text-xs text-fg-subtle">
                {status.unbudgetedMinor > 0 && (
                  <>
                    <Money amountMinor={status.unbudgetedMinor} currency={budget.currency} /> spent on items outside
                    the plan.{' '}
                  </>
                )}
                {status.unconvertedCount > 0 &&
                  `${status.unconvertedCount} expense${status.unconvertedCount === 1 ? '' : 's'} in another currency not counted.`}
              </p>
            )}
          </section>

          <section className="rounded-lg border border-edge bg-surface p-4 text-sm">
            <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Taken from</p>
            <ul className="mt-1 space-y-0.5">
              {budget.sources.map((s) => (
                <li key={s.accountId} className="flex justify-between gap-3 text-fg">
                  <span className="min-w-0 flex-1 truncate">{accounts.get(s.accountId)?.name ?? s.accountId}</span>
                  <Money amountMinor={s.amountMinor} currency={budget.currency} className="font-semibold" />
                </li>
              ))}
              {budget.sources.length === 0 && <li className="text-fg-subtle">Carried over only.</li>}
            </ul>
            <p className="mt-2 text-xs text-fg-subtle">
              Cap was {budget.capPercent}%. If this month ended now,{' '}
              <Money amountMinor={status.carryOverMinor} currency={budget.currency} /> would carry into the next.
            </p>
            {isCurrent && (
              <p className="mt-2 text-xs text-fg-subtle">
                Ready for {monthLabelFor(nextMonth)}?{' '}
                <button type="button" onClick={() => setOffset(1)} className="font-semibold text-accent-text hover:underline">
                  Fund next month
                </button>
              </p>
            )}
            {offset >= 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Undo ${monthLabelFor(month)}'s budget? Spending stays; only the earmark is removed.`)) {
                    void deleteBudget(user.uid, month)
                  }
                }}
                className="mt-3 text-xs font-semibold text-fg-subtle hover:text-danger-text"
              >
                Undo this month's funding
              </button>
            )}
          </section>
        </div>
      ) : null}

      <div className="mt-8">
        {editingPlan ? (
          <PlanEditor categories={categories} onClose={() => setEditingPlan(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setEditingPlan(true)}
            className="w-full rounded-lg border border-dashed border-edge py-3 text-sm font-semibold text-fg-muted hover:text-fg"
          >
            Edit the monthly plan
          </button>
        )}
      </div>
    </>
  )
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-edge bg-surface p-4">
      <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}
