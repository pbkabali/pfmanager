import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { useUser } from '../../app/providers/useAuth'
import { dangerButton } from '../../components/buttonStyles'
import { Money } from '../../components/Money'
import { PageHeader } from '../../components/PageHeader'
import { accountCurrency } from '../accounts/types'
import { useAccounts } from '../accounts/useAccounts'
import { useCategories } from '../categories/useCategories'
import { useProfile } from '../profile/profileContext'
import { deleteTransaction, useTransaction, useTransactionGroup } from './useTransactions'

/** One label-and-value line. Values that are absent drop the whole line. */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === false) return null
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2.5">
      <dt className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-fg">{children}</dd>
    </div>
  )
}

const TYPE_LABEL = { income: 'Received', expense: 'Spent', transfer: 'Moved' } as const

/**
 * One transaction in full: everything the list row has to truncate or leave
 * out -- the whole note, both sides of a currency change, when it was typed
 * in as against when it happened, and the other parts of a split income.
 */
export function TransactionDetailPage() {
  const user = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const { transactionId = '' } = useParams()
  const profile = useProfile()
  const { currency: profileCurrency } = profile
  const { transaction, loading, error } = useTransaction(transactionId)
  const { byId: categories } = useCategories()
  const { byId: accounts } = useAccounts()
  const siblings = useTransactionGroup(transaction?.groupId)

  // `key` is react-router's marker for the entry the app opened on: going
  // back from there would leave the app, so a deep link falls back to the list.
  const canGoBack = location.key !== 'default'
  const back = (
    <button
      type="button"
      onClick={() => (canGoBack ? navigate(-1) : navigate('/transactions'))}
      className="text-sm font-semibold text-fg-muted hover:text-fg"
    >
      ‹ Back
    </button>
  )

  if (loading) return <p className="text-sm text-fg-subtle">Loading…</p>

  if (error || !transaction) {
    return (
      <>
        <PageHeader title="Activity" action={back} />
        <div className="rounded-lg border border-dashed border-edge p-8 text-center">
          <p className="text-sm text-fg-muted">
            {error ? error.message : 'That transaction no longer exists.'}
          </p>
          <Link to="/transactions" className="mt-2 inline-block text-sm font-semibold text-accent-text underline">
            All activity
          </Link>
        </div>
      </>
    )
  }

  const t = transaction
  const category = t.categoryId ? categories.get(t.categoryId) : undefined
  const account = accounts.get(t.accountId)
  const toAccount = t.toAccountId ? accounts.get(t.toAccountId) : undefined
  const rule = t.setAsideId ? profile.setAsides?.find((r) => r.id === t.setAsideId) : undefined
  const rowCurrency = t.currency ?? accountCurrency(account, profileCurrency)
  const direction = t.type === 'income' ? 'in' : t.type === 'expense' ? 'out' : undefined
  const title =
    t.type === 'transfer'
      ? (rule?.name ?? `${account?.name ?? '?'} → ${toAccount?.name ?? '?'}`)
      : (category?.name ?? 'Uncategorised')
  const icon = t.type === 'transfer' ? (t.setAsideId ? '🤲' : '⇄') : (category?.icon ?? '•')
  const others = siblings.filter((s) => s.id !== t.id)

  const fullDate = t.date.toDate().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const stamp = (value: typeof t.createdAt) =>
    value ? value.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null

  return (
    <>
      <PageHeader title={title} subtitle={`${TYPE_LABEL[t.type]} · ${fullDate}`} action={back} />

      <div className="mb-4 flex items-center gap-4 rounded-lg border border-edge bg-surface p-5">
        <span aria-hidden className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-surface-raised text-3xl">
          {icon}
        </span>
        <div className="min-w-0">
          <Money
            amountMinor={t.amountMinor}
            currency={rowCurrency}
            direction={direction}
            className="text-2xl font-bold"
          />
          {t.toAmountMinor !== undefined && (
            <p className="mt-0.5 text-sm text-fg-subtle">
              arrived as <Money amountMinor={t.toAmountMinor} currency={accountCurrency(toAccount, profileCurrency)} />
            </p>
          )}
        </div>
      </div>

      <dl className="divide-y divide-edge rounded-lg border border-edge bg-surface px-4">
        <Detail label="Date">{fullDate}</Detail>

        {t.type === 'transfer' ? (
          <>
            <Detail label="From">
              <Link to={`/accounts/${t.accountId}`} className="font-semibold text-accent-text underline">
                {account?.name ?? 'Unknown account'}
              </Link>
            </Detail>
            <Detail label="To">
              {toAccount ? (
                <Link to={`/accounts/${toAccount.id}`} className="font-semibold text-accent-text underline">
                  {toAccount.name}
                </Link>
              ) : (
                'Unknown account'
              )}
            </Detail>
            {rule && <Detail label="Set aside">{rule.name}</Detail>}
          </>
        ) : (
          <>
            <Detail label={t.type === 'income' ? 'Into' : 'Paid from'}>
              <Link to={`/accounts/${t.accountId}`} className="font-semibold text-accent-text underline">
                {account?.name ?? 'Unknown account'}
              </Link>
            </Detail>
            <Detail label={t.type === 'income' ? 'Category' : 'Budget item'}>
              {category ? (
                // Straight into the filtered list: "what else went here?"
                <Link
                  to={`/transactions?cat=${encodeURIComponent(category.id)}`}
                  className="font-semibold text-accent-text underline"
                >
                  {category.icon} {category.name}
                </Link>
              ) : (
                <span className="text-fg-muted">Uncategorised</span>
              )}
            </Detail>
          </>
        )}

        {t.accountAmountMinor !== undefined && (
          <Detail label="Charged">
            <Money amountMinor={t.accountAmountMinor} currency={accountCurrency(account, profileCurrency)} />
            <span className="text-fg-subtle"> left {account?.name ?? 'the account'}</span>
          </Detail>
        )}

        <Detail label="Note">
          {t.note ? t.note : <span className="text-fg-subtle">None</span>}
        </Detail>

        <Detail label="Recorded">
          {stamp(t.createdAt) ?? <span className="text-fg-subtle">Not yet synced to the server</span>}
        </Detail>

        {t.updatedAt && stamp(t.updatedAt) !== stamp(t.createdAt) && (
          <Detail label="Changed">{stamp(t.updatedAt)}</Detail>
        )}
      </dl>

      {others.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-fg">Recorded at the same time</h2>
          <p className="mb-2 text-xs text-fg-subtle">
            This was one entry split across several accounts. Deleting this part leaves the rest.
          </p>
          <ul className="divide-y divide-edge rounded-lg border border-edge bg-surface px-4">
            {others.map((s) => {
              const sAccount = accounts.get(s.accountId)
              const sTo = s.toAccountId ? accounts.get(s.toAccountId) : undefined
              const sRule = s.setAsideId ? profile.setAsides?.find((r) => r.id === s.setAsideId) : undefined
              return (
                <li key={s.id} className="py-2.5">
                  <Link to={`/transactions/${s.id}`} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-fg">
                      {s.type === 'transfer'
                        ? `${sRule?.name ?? 'Moved'} → ${sTo?.name ?? '?'}`
                        : (sAccount?.name ?? 'Unknown account')}
                    </span>
                    <Money
                      amountMinor={s.amountMinor}
                      currency={s.currency ?? accountCurrency(sAccount, profileCurrency)}
                      className="flex-none text-sm font-semibold"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={() => {
          if (!confirm('Delete this transaction?')) return
          void deleteTransaction(user.uid, t.id)
          // Straight back to the list: this row is about to vanish from under us.
          navigate('/transactions', { replace: true })
        }}
        className={`mt-6 ${dangerButton}`}
      >
        Delete this transaction
      </button>
    </>
  )
}
