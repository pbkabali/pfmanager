import { useMemo } from 'react'

import { monthKey, shiftMonth } from './months'
import { useMonthStatus, type MonthStatus } from './useBudget'

/**
 * How much of each account's balance is spoken for by the budget, right now.
 *
 * A month's funding names the accounts it was taken from. As the month is
 * spent the earmark shrinks, but spending is recorded against items, not
 * against the account it was drawn from, so the unspent remainder is spread
 * back over the sources in proportion to what each gave. Next month's budget
 * counts too once it is funded, which is the normal state on the last day.
 * Result: accountId -> minor units of that account's currency.
 */
export function useEarmarks(): Map<string, number> {
  const thisMonth = useMonthStatus(monthKey())
  const nextMonth = useMonthStatus(shiftMonth(monthKey(), 1))

  return useMemo(() => {
    const out = new Map<string, number>()
    for (const m of [thisMonth, nextMonth]) addRemaining(out, m)
    return out
  }, [thisMonth, nextMonth])
}

function addRemaining(out: Map<string, number>, m: MonthStatus) {
  if (!m.budget || !m.status || m.budget.fundedMinor <= 0) return
  const ratio = Math.max(0, m.status.availableMinor) / m.budget.fundedMinor
  for (const s of m.budget.sources) {
    out.set(s.accountId, (out.get(s.accountId) ?? 0) + Math.round(s.amountMinor * ratio))
  }
}
