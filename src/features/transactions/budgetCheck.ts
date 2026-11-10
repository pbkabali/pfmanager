import { formatMoney } from '../../lib/money'
import type { ItemStatus } from '../budgets/status'

/**
 * The rule that a plan item cannot be spent past what it still has.
 *
 * Shared by the add and edit forms. It lives here rather than in either of
 * them because the two must agree: a form that let an edit raise an amount
 * past the item's balance would quietly undo the check the add form makes.
 */

export type PlannedExpense = {
  amountMinor: number
  /** Currency the expense was priced in. */
  currency: string
  /** What the paying account was charged, when its currency differs. */
  accountAmountMinor?: number
  /** Currency of the paying account. */
  accountCurrency: string
}

/**
 * The expense's size in the budget's currency, or null when it cannot be
 * known. The price counts when priced in that currency; failing that, what
 * the account was charged counts when the account is in it. Otherwise there
 * is no rate to compare with -- this app stores none -- and the caller must
 * let the entry through rather than block it on a conversion it cannot make.
 */
export function expenseInBudgetCurrency(expense: PlannedExpense, itemCurrency: string): number | null {
  if (expense.currency === itemCurrency) return expense.amountMinor
  if (expense.accountAmountMinor !== undefined && expense.accountCurrency === itemCurrency) {
    return expense.accountAmountMinor
  }
  return null
}

/**
 * Why this expense cannot be saved against its plan item, or null when it can.
 *
 * `replacingMinor` is what this entry ALREADY counts towards the item and is
 * about to replace. It is 0 for a new entry. On an edit it is the row's
 * current amount, which `item.availableMinor` has already subtracted -- and
 * without adding it back, re-saving an unchanged transaction would be refused
 * for exceeding a balance its own amount had reduced. An edit that moves the
 * row to another month or another item passes 0, since the item it is
 * arriving at never counted it.
 */
export function overspendMessage(
  expense: PlannedExpense,
  item: ItemStatus | undefined,
  itemCurrency: string,
  itemName: string,
  replacingMinor = 0,
): string | null {
  if (!item) return null
  const wanted = expenseInBudgetCurrency(expense, itemCurrency)
  if (wanted === null) return null
  const headroomMinor = item.availableMinor + replacingMinor
  if (wanted <= headroomMinor) return null
  return `Only ${formatMoney(Math.max(headroomMinor, 0), itemCurrency)} is still available for ${itemName} this month.`
}
