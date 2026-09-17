import { Money } from '../../components/Money'
import type { Account } from '../accounts/types'
import { accountCurrency } from '../accounts/types'
import type { Category } from '../categories/types'
import type { Transaction } from './types'

export function TransactionRow({
  transaction,
  currency,
  category,
  account,
  toAccount,
  onDelete,
}: {
  transaction: Transaction
  /** Profile currency: the fallback for rows and accounts written before currencies were per-account. */
  currency: string
  category?: Category
  account?: Account
  toAccount?: Account
  onDelete?: () => void
}) {
  const t = transaction
  const rowCurrency = t.currency ?? accountCurrency(account, currency)
  const title =
    t.type === 'transfer'
      ? `${account?.name ?? '?'} → ${toAccount?.name ?? '?'}`
      : (category?.name ?? 'Uncategorised')
  const icon = t.type === 'transfer' ? '⇄' : (category?.icon ?? '•')
  const direction = t.type === 'income' ? 'in' : t.type === 'expense' ? 'out' : undefined
  // Pending server ack: createdAt is still null. Shown subtly so a person
  // knows the row has not left the device yet.
  const pending = t.createdAt === null
  // A transfer that changed currency shows both sides, since neither number
  // alone says what happened.
  const landed =
    t.type === 'transfer' && t.toAmountMinor !== undefined ? (
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
          {t.type === 'expense' && t.accountAmountMinor !== undefined && (
            <>
              {' · charged '}
              <Money amountMinor={t.accountAmountMinor} currency={accountCurrency(account, currency)} />
            </>
          )}
          {t.groupId && ' · part of a split'}
          {t.note && ` · ${t.note}`}
          {pending && ' · not yet synced'}
        </p>
      </div>
      <span className="text-sm font-semibold">
        <Money amountMinor={t.amountMinor} currency={rowCurrency} direction={direction} />
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
