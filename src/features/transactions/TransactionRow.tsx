import { Money } from '../../components/Money'
import type { Account } from '../accounts/types'
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
  currency: string
  category?: Category
  account?: Account
  toAccount?: Account
  onDelete?: () => void
}) {
  const t = transaction
  const title =
    t.type === 'transfer'
      ? `${account?.name ?? '?'} → ${toAccount?.name ?? '?'}`
      : (category?.name ?? 'Uncategorised')
  const icon = t.type === 'transfer' ? '⇄' : (category?.icon ?? '•')
  const direction = t.type === 'income' ? 'in' : t.type === 'expense' ? 'out' : undefined
  // Pending server ack: createdAt is still null. Shown subtly so a person
  // knows the row has not left the device yet.
  const pending = t.createdAt === null

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
          {t.note && ` · ${t.note}`}
          {pending && ' · not yet synced'}
        </p>
      </div>
      <Money amountMinor={t.amountMinor} currency={currency} direction={direction} className="text-sm font-semibold" />
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
