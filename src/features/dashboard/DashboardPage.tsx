import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { Money } from '../../components/Money'
import { PageHeader } from '../../components/PageHeader'
import { sortCurrencies } from '../accounts/balances'
import { accountCurrency } from '../accounts/types'
import { useAccounts } from '../accounts/useAccounts'
import { useCategories } from '../categories/useCategories'
import { useProfile } from '../profile/profileContext'
import { monthLabel, startOfMonth, startOfNextMonth } from '../transactions/periods'
import { TransactionRow } from '../transactions/TransactionRow'
import { useTransactions } from '../transactions/useTransactions'

type CurrencySummary = {
  currency: string
  income: number
  expense: number
  net: number
  topCategories: [string, number][]
}

/**
 * This month at a glance. Totals are computed on the device from the month's
 * transactions rather than read from a server-maintained aggregate: the data
 * is already local for offline, and a few hundred rows sum in microseconds.
 *
 * Everything is grouped by currency. There is no reporting currency and no
 * conversion: UGX received and USD received are two facts, shown as two.
 * An expense counts in the currency it was priced in, not the currency of
 * the account that paid, so "Spent · USD" is what was bought in dollars.
 * Charts land here next -- the by-category breakdown below is their data.
 */
export function DashboardPage() {
  const { currency: profileCurrency, displayName } = useProfile()
  const range = useMemo(() => ({ from: startOfMonth(), to: startOfNextMonth() }), [])
  const { transactions, loading, fromCache } = useTransactions({ ...range, max: 1000 })
  const { byId: categories } = useCategories()
  const { byId: accounts } = useAccounts()

  const summaries = useMemo<CurrencySummary[]>(() => {
    const byCurrency = new Map<string, { income: number; expense: number; byCategory: Map<string, number> }>()
    const bucket = (currency: string) => {
      let b = byCurrency.get(currency)
      if (!b) {
        b = { income: 0, expense: 0, byCategory: new Map() }
        byCurrency.set(currency, b)
      }
      return b
    }
    for (const t of transactions) {
      if (t.type === 'transfer') continue
      const currency = t.currency ?? accountCurrency(accounts.get(t.accountId), profileCurrency)
      const b = bucket(currency)
      if (t.type === 'income') b.income += t.amountMinor
      if (t.type === 'expense') {
        b.expense += t.amountMinor
        const key = t.categoryId ?? 'uncategorised'
        b.byCategory.set(key, (b.byCategory.get(key) ?? 0) + t.amountMinor)
      }
    }
    // Always show the profile currency, even in a quiet month.
    bucket(profileCurrency)
    return sortCurrencies([...byCurrency.keys()], profileCurrency).map((currency) => {
      const b = bucket(currency)
      return {
        currency,
        income: b.income,
        expense: b.expense,
        net: b.income - b.expense,
        topCategories: [...b.byCategory.entries()].sort((a, c) => c[1] - a[1]).slice(0, 5),
      }
    })
  }, [transactions, accounts, profileCurrency])

  const firstName = displayName?.split(' ')[0]
  const multi = summaries.length > 1
  const spending = summaries.filter((s) => s.topCategories.length > 0)

  return (
    <>
      <PageHeader
        title={firstName ? `Hello, ${firstName}` : 'Dashboard'}
        subtitle={`${monthLabel()}${fromCache ? ' · showing saved copy' : ''}`}
        action={
          <Link to="/transactions?add" className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-accent-fg">
            Record activity
          </Link>
        }
      />

      <div className="space-y-3">
        {summaries.map((s) => (
          <section key={s.currency} aria-label={`This month in ${s.currency}`}>
            {multi && (
              <h2 className="mb-1 text-xs font-semibold tracking-wide text-fg-subtle uppercase">{s.currency}</h2>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <Tile label="Received">
                <Money amountMinor={s.income} currency={s.currency} direction="in" className="text-xl font-bold" />
              </Tile>
              <Tile label="Already spent">
                <Money amountMinor={s.expense} currency={s.currency} direction="out" className="text-xl font-bold" />
              </Tile>
              <Tile label="Net">
                <Money
                  amountMinor={s.net}
                  currency={s.currency}
                  className={`text-xl font-bold ${s.net < 0 ? 'text-negative-text' : 'text-fg'}`}
                />
              </Tile>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="min-w-0">
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">Top spending</h2>
          {loading ? (
            <p className="text-sm text-fg-subtle">Loading…</p>
          ) : spending.length === 0 ? (
            <p className="rounded-lg border border-dashed border-edge p-6 text-center text-sm text-fg-subtle">
              No spending recorded this month.
            </p>
          ) : (
            <div className="space-y-4">
              {spending.map((s) => (
                <div key={s.currency}>
                  {multi && <p className="mb-1 text-xs font-semibold text-fg-subtle">{s.currency}</p>}
                  <ul className="space-y-2">
                    {s.topCategories.map(([id, amount]) => {
                      const category = categories.get(id)
                      const share = s.expense ? amount / s.expense : 0
                      return (
                        <li key={id} className="rounded-lg border border-edge bg-surface p-3">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate font-semibold text-fg">
                              {category?.icon ?? '•'} {category?.name ?? 'Uncategorised'}
                            </span>
                            <Money amountMinor={amount} currency={s.currency} className="flex-none font-semibold" />
                          </div>
                          {/* Proportion bar: the seed of the category chart to come. */}
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised" aria-hidden>
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${Math.round(share * 100)}%` }}
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0">
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
                  currency={profileCurrency}
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
