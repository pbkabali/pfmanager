import { Timestamp } from 'firebase/firestore'
import { useState, type FormEvent } from 'react'

import { useUser } from '../../app/providers/useAuth'
import { dangerButton } from '../../components/buttonStyles'
import { Money } from '../../components/Money'
import { useOnlineStatus } from '../../lib/hooks/useOnlineStatus'
import { formatMoney, parseAmount, toInputValue } from '../../lib/money'
import { useUnsavedWork } from '../../lib/hooks/useUnsavedWork'
import { accountCurrency } from '../accounts/types'
import { useAccounts } from '../accounts/useAccounts'
import { monthKey } from '../budgets/months'
import { amountInCurrency } from '../budgets/status'
import { useMonthStatus } from '../budgets/useBudget'
import { useCategories } from '../categories/useCategories'
import { useProfile } from '../profile/profileContext'
import { CURRENCIES } from '../profile/types'
import { overspendMessage } from './budgetCheck'
import { field, label } from './formStyles'
import { fromDateInputValue, toDateInputValue } from './periods'
import type { Transaction } from './types'
import { editTransaction, type TransactionEdit } from './useTransactions'

/**
 * Correct a transaction that was recorded wrong.
 *
 * Deliberately separate from TransactionForm rather than a mode inside it.
 * That form's job is the phone-in-a-shop case: pick a type, split an income
 * across accounts, watch the set-aside lines appear as you type. None of it
 * applies to a correction, where the type is already settled and the entry
 * has already been written -- and threading an "editing" flag through all of
 * it would put the hot path at risk for the sake of the rare one.
 *
 * What this cannot do is edit an entry that wrote several rows at once; the
 * detail page refuses those before offering the button. See `isEditable`.
 */
export function EditTransactionForm({
  transaction,
  onSaved,
  onCancel,
}: {
  transaction: Transaction
  onSaved: () => void
  onCancel: () => void
}) {
  const t = transaction
  const user = useUser()
  // Unsaved input: nothing may navigate away from it on its own.
  useUnsavedWork()
  const { currency: profileCurrency } = useProfile()
  const online = useOnlineStatus()
  const { active: activeAccounts, byId: allAccounts } = useAccounts()
  const { categories } = useCategories()

  const currencyOf = (id: string) => accountCurrency(allAccounts.get(id), profileCurrency)
  const originalCurrency = t.currency ?? currencyOf(t.accountId)

  const [accountId, setAccountId] = useState(t.accountId)
  const [toAccountId, setToAccountId] = useState(t.toAccountId ?? '')
  const [expenseCurrency, setExpenseCurrency] = useState(originalCurrency)
  const [amount, setAmount] = useState(() => toInputValue(t.amountMinor, originalCurrency))
  const [toAmount, setToAmount] = useState(() =>
    t.toAmountMinor === undefined ? '' : toInputValue(t.toAmountMinor, currencyOf(t.toAccountId ?? '')),
  )
  const [accountAmount, setAccountAmount] = useState(() =>
    t.accountAmountMinor === undefined ? '' : toInputValue(t.accountAmountMinor, currencyOf(t.accountId)),
  )
  const [categoryId, setCategoryId] = useState(t.categoryId ?? '')
  const [date, setDate] = useState(() => toDateInputValue(t.date.toDate()))
  const [note, setNote] = useState(t.note)
  const [error, setError] = useState<string | null>(null)

  /*
   * The account that was used stays on offer even when archived since: it is
   * where the money actually went, and an edit of the note must not silently
   * move the row to a different account because the original left the list.
   */
  const accounts = activeAccounts.some((a) => a.id === t.accountId)
    ? activeAccounts
    : [...activeAccounts, ...(allAccounts.get(t.accountId) ? [allAccounts.get(t.accountId)!] : [])]

  const kind = t.type === 'income' ? 'income' : 'expense'
  const categoryOptions = categories.filter((c) => c.kind === kind && (!c.archived || c.id === t.categoryId))

  // The amount is typed in the account's currency for income and transfers,
  // and in the price's currency for an expense, exactly as when it was added.
  const typedCurrency = t.type === 'expense' ? expenseCurrency : currencyOf(accountId)
  const crossCurrency = t.type === 'transfer' && !!toAccountId && currencyOf(accountId) !== currencyOf(toAccountId)
  const chargedInOtherCurrency = t.type === 'expense' && currencyOf(accountId) !== expenseCurrency

  // The plan item this expense will land on AFTER the edit: the date decides
  // the month, so moving a row into another month checks that month's budget.
  const budgetMonth = monthKey(fromDateInputValue(date))
  const monthStatus = useMonthStatus(budgetMonth)
  const item = t.type === 'expense' ? monthStatus.status?.items.find((i) => i.categoryId === categoryId) : undefined
  const itemCurrency = monthStatus.budget?.currency ?? profileCurrency

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const fail = (message: string) => {
      setError(message)
      return undefined
    }

    if (!accountId) return fail('Choose an account.')
    if (t.type !== 'transfer' && !categoryId) return fail('Choose a category.')

    const amountMinor = parseAmount(amount, typedCurrency)
    if (amountMinor === null || amountMinor <= 0) return fail('Enter an amount greater than zero.')

    const when = Timestamp.fromDate(fromDateInputValue(date))
    // Null, not undefined: these fields must be REMOVED when they stop
    // applying. See editTransaction.
    const changes: TransactionEdit = {
      amountMinor,
      currency: typedCurrency,
      accountId,
      date: when,
      note: note.trim(),
    }

    if (t.type === 'transfer') {
      if (!toAccountId || toAccountId === accountId) {
        return fail('Choose two different accounts for a transfer.')
      }
      changes.toAccountId = toAccountId
      if (crossCurrency) {
        const landed = parseAmount(toAmount, currencyOf(toAccountId))
        if (landed === null || landed <= 0) return fail(`Enter the amount received in ${currencyOf(toAccountId)}.`)
        changes.toAmountMinor = landed
      } else {
        changes.toAmountMinor = null
      }
    } else {
      changes.categoryId = categoryId
      let accountAmountMinor: number | undefined
      if (chargedInOtherCurrency && t.type === 'expense') {
        const charged = parseAmount(accountAmount, currencyOf(accountId))
        if (charged === null || charged <= 0) {
          return fail(`Enter what the account was charged in ${currencyOf(accountId)}.`)
        }
        accountAmountMinor = charged
        changes.accountAmountMinor = charged
      } else {
        changes.accountAmountMinor = null
      }

      if (t.type === 'expense') {
        /*
         * What this row already counts towards the item it is landing on. The
         * month's status has it subtracted already, so without adding it back
         * a saved-unchanged transaction would be refused for exceeding a
         * balance its own amount had reduced. Zero when the edit moves the row
         * to another month or item, which never counted it.
         */
        const staysPut = monthKey(t.date.toDate()) === budgetMonth && t.categoryId === categoryId
        const replacing = staysPut
          ? (amountInCurrency(t, itemCurrency, allAccounts, profileCurrency) ?? 0)
          : 0
        const name = categories.find((c) => c.id === categoryId)?.name ?? 'this item'
        const message = overspendMessage(
          { amountMinor, currency: typedCurrency, accountAmountMinor, accountCurrency: currencyOf(accountId) },
          item,
          itemCurrency,
          name,
          replacing,
        )
        if (message) return fail(message)
      }
    }

    // Not awaited: offline the promise settles only when the server is
    // reached. The local write is instant and the detail view reads from it.
    editTransaction(user.uid, t.id, changes).catch((cause: unknown) =>
      setError(cause instanceof Error ? cause.message : 'Could not save.'),
    )
    onSaved()
    return undefined
  }

  const accountLabel = t.type === 'income' ? 'Into' : t.type === 'expense' ? 'Paid from' : 'From'

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-edge bg-surface p-4">
      {t.type === 'expense' ? (
        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-end gap-2">
          <label className="block">
            <span className={label}>Amount</span>
            <input
              type="text"
              inputMode="decimal"
              required
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
              {[...new Set([originalCurrency, profileCurrency, ...CURRENCIES])].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <label className="block">
          <span className={label}>Amount ({typedCurrency})</span>
          <input
            type="text"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${field} tabular text-2xl font-bold`}
          />
        </label>
      )}

      {/* [&>*]:min-w-0 keeps the date control inside its column on iOS --
          see the same note in TransactionForm. */}
      <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <label className="block">
          <span className={label}>{accountLabel}</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={field}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {accountCurrency(a, profileCurrency)}
              </option>
            ))}
          </select>
        </label>

        {t.type === 'transfer' ? (
          <>
            <label className="block">
              <span className={label}>To</span>
              <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className={field}>
                {accounts
                  .filter((a) => a.id !== accountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {accountCurrency(a, profileCurrency)}
                    </option>
                  ))}
              </select>
            </label>
            {crossCurrency && (
              <label className="block sm:col-span-2">
                <span className={label}>Received as ({currencyOf(toAccountId)})</span>
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
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
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
                  {item.availableMinor < 0 ? 'Over by ' : 'Still available this month: '}
                  <Money amountMinor={Math.abs(item.availableMinor)} currency={itemCurrency} />
                  <span className="text-fg-subtle"> (this entry included)</span>
                </span>
              )}
            </label>
            {chargedInOtherCurrency && (
              <label className="block sm:col-span-2">
                <span className={label}>Charged to account as ({currencyOf(accountId)})</span>
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
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${field} min-w-0`}
          />
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
          Save changes
        </button>
        <button type="button" onClick={onCancel} className={dangerButton}>
          Cancel
        </button>
      </div>

      <p className="text-center text-xs text-fg-subtle">
        Recorded as {formatMoney(t.amountMinor, originalCurrency)} on{' '}
        {t.date.toDate().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        {!online && ' · offline: this will be saved here and sync later'}
      </p>
    </form>
  )
}
