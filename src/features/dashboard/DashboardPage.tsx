import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { Money } from '../../components/Money'
import { PageHeader } from '../../components/PageHeader'
import { useAccounts } from '../accounts/useAccounts'
import { useCategories } from '../categories/useCategories'
import { useProfile } from '../profile/profileContext'
import { monthLabel, startOfMonth, startOfNextMonth } from '../transactions/periods'
import { TransactionRow } from '../transactions/TransactionRow'
import { useTransactions } from '../transactions/useTransactions'

/**
 * This month at a glance. Totals are computed on the device from the month's
 * transactions rather than read from a server-maintained aggregate: the data
 * is already local for offline, and a few hundred rows sum in microseconds.
 * Charts land here next -- the by-category breakdown below is their data.
 */
export function DashboardPage() {
  const { currency, displayName } = useProfile()
  const range = useMemo(() => ({ from: startOfMonth(), to: startOfNextMonth() }), [])
  const { transactions, loading, fromCache } = useTransactions({ ...range, max: 1000 })
  const { byId: categories } = useCategories()
  const { byId: accounts } = useAccounts()

  const summary = useMemo(() => {
    let income = 0
    let expense = 0
    const byCategory = new Map<string, number>()
    for (const t of transactions) {
      if (t.type === 'income') income += t.amountMinor
      if (t.type === 'expense') {
        expense += t.amountMinor
        const key = t.categoryId ?? 'uncategorised'
        byCategory.set(key, (byCategory.get(key) ?? 0) + t.amountMinor)
      }
    }
    const topCategories = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    return { income, expense, net: income - expense, topCategories }
  }, [transactions])

  const firstName = displayName?.split(' ')[0]

  return (
    <>
      <PageHeader
        title={firstName ? `Hello, ${firstName}` : 'Dashboard'}
        subtitle={`${monthLabel()}${fromCache ? ' · showing saved copy' : ''}`}
        action={
          <Link to="/transactions" className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-accent-fg">
            + Add
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3" aria-label="This month">
        <Tile label="Received">
          <Money amountMinor={summary.income} currency={currency} direction="in" className="text-xl font-bold" />
        </Tile>
        <Tile label="Spent">
          <Money amountMinor={summary.expense} currency={currency} direction="out" className="text-xl font-bold" />
        </Tile>
        <Tile label="Net">
          <Money
            amountMinor={summary.net}
            currency={currency}
            className={`text-xl font-bold ${summary.net < 0 ? 'text-negative-text' : 'text-fg'}`}
          />
        </Tile>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">Top spending</h2>
          {loading ? (
            <p className="text-sm text-fg-subtle">Loading…</p>
          ) : summary.topCategories.length === 0 ? (
            <p className="rounded-lg border border-dashed border-edge p-6 text-center text-sm text-fg-subtle">
              No spending recorded this month.
            </p>
          ) : (
            <ul className="space-y-2">
              {summary.topCategories.map(([id, amount]) => {
                const category = categories.get(id)
                const share = summary.expense ? amount / summary.expense : 0
                return (
                  <li key={id} className="rounded-lg border border-edge bg-surface p-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-semibold text-fg">
                        {category?.icon ?? '•'} {category?.name ?? 'Uncategorised'}
                      </span>
                      <Money amountMinor={amount} currency={currency} className="font-semibold" />
                    </div>
                    {/* Proportion bar: the seed of the category chart to come. */}
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised" aria-hidden>
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(share * 100)}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">Recent</h2>
          {transactions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-edge p-6 text-center text-sm text-fg-subtle">
              Nothing yet this month.
            </p>
          ) : (
            <ul className="divide-y divide-edge rounded-lg border border-edge bg-surface px-4">
              {transactions.slice(0, 6).map((t) => (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  currency={currency}
                  category={t.categoryId ? categories.get(t.categoryId) : undefined}
                  account={accounts.get(t.accountId)}
                  toAccount={t.toAccountId ? accounts.get(t.toAccountId) : undefined}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-edge bg-surface p-4">
      <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">{label}</p>
      <p className="mt-1">{children}</p>
    </div>
  )
}
