import { Money } from '../../components/Money'
import type { Account } from '../accounts/types'
import { accountCurrency } from '../accounts/types'
import type { Category } from '../categories/types'
import { useProfile } from '../profile/profileContext'
import type { Transaction } from './types'

export function TransactionRow({
  transaction,
  currency,
  category,
  account,
  toAccount,
  perspectiveAccountId,
  onDelete,
}: {
  transaction: Transaction
  /** Profile currency: the fallback for rows and accounts written before currencies were per-account. */
  currency: string
  category?: Category
  account?: Account
  toAccount?: Account
  /** When listing one account's ledger: colour transfers as in or out of it. */
  perspectiveAccountId?: string
  onDelete?: () => void
}) {
  const t = transaction
  const profile = useProfile()
  const rule = t.setAsideId ? profile.setAsides?.find((r) => r.id === t.setAsideId) : undefined
  const rowCurrency = t.currency ?? accountCurrency(account, currency)
  const route = `${account?.name ?? '?'} → ${toAccount?.name ?? '?'}`
  const title =
    t.type === 'transfer'
      ? t.setAsideId
        ? `${rule?.name ?? 'Set aside'}`
        : route
      : (category?.name ?? 'Uncategorised')
  const icon = t.type === 'transfer' ? (t.setAsideId ? '🤲' : '⇄') : (category?.icon ?? '•')
  const incoming = t.type === 'transfer' && !!perspectiveAccountId && t.toAccountId === perspectiveAccountId
  const direction =
    t.type === 'income'
      ? 'in'
      : t.type === 'expense'
        ? 'out'
        : perspectiveAccountId
          ? incoming
            ? 'in'
            : 'out'
          : undefined
  // Seen from the receiving account, a cross-currency transfer is the landed amount.
  const shownAmount = incoming && t.toAmountMinor !== undefined ? t.toAmountMinor : t.amountMinor
  const shownCurrency = incoming && t.toAmountMinor !== undefined ? accountCurrency(toAccount, currency) : rowCurrency
  // Pending server ack: createdAt is still null. Shown subtly so a person
  // knows the row has not left the device yet.
  const pending = t.createdAt === null
  // A transfer that changed currency shows both sides, since neither number
  // alone says what happened.
  const landed =
    t.type === 'transfer' && t.toAmountMinor !== undefined && !perspectiveAccountId ? (
      <>
        {' → '}
        <Money amountMinor={t.toAmountMinor} currency={accountCurrency(toAccount, currency)} />
      </>
    ) : null

  return (
    <li className="flex items-center gap-3 py-3">
      <span aria-hidden className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-raised text-lg">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">{title}</p>
        <p className="truncate text-xs text-fg-subtle">
          {t.date.toDate().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          {t.type !== 'transfer' && account && ` · ${account.name}`}
          {t.type === 'transfer' && t.setAsideId && ` · ${route}`}
          {t.type === 'expense' && t.accountAmountMinor !== undefined && (
            <>
              {' · charged '}
              <Money amountMinor={t.accountAmountMinor} currency={accountCurrency(account, currency)} />
            </>
          )}
          {t.groupId && t.type === 'income' && ' · part of a split'}
          {t.note && ` · ${t.note}`}
          {pending && ' · not yet synced'}
        </p>
      </div>
      <span className="text-sm font-semibold">
        <Money amountMinor={shownAmount} currency={shownCurrency} direction={direction} />
        {landed}
      </span>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete"
          className="flex-none rounded p-1 text-fg-subtle hover:text-danger-text"
        >
          ✕
        </button>
      )}
    </li>
  )
}
