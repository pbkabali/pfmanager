/**
 * Month arithmetic on `YYYY-MM` keys, local time. A month here is the one a
 * person experienced, which is what the budget is for.
 */

const pad = (n: number) => String(n).padStart(2, '0')

export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

function parts(key: string): { year: number; month: number } {
  const [y, m] = key.split('-').map(Number)
  return { year: y ?? 1970, month: (m ?? 1) - 1 }
}

/** First instant of the month. */
export function monthStart(key: string): Date {
  const { year, month } = parts(key)
  return new Date(year, month, 1)
}

/** First instant of the following month: the exclusive upper bound. */
export function monthEnd(key: string): Date {
  const { year, month } = parts(key)
  return new Date(year, month + 1, 1)
}

export function shiftMonth(key: string, delta: number): string {
  const { year, month } = parts(key)
  return monthKey(new Date(year, month + delta, 1))
}

export function monthLabelFor(key: string): string {
  return monthStart(key).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function daysInMonth(key: string): number {
  const { year, month } = parts(key)
  return new Date(year, month + 1, 0).getDate()
}

/**
 * Days of the month still to be paid for, counting today. A whole month when
 * it has not started, none once it is over.
 */
export function daysRemaining(key: string, today = new Date()): number {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const start = monthStart(key)
  const end = monthEnd(key)
  if (day < start) return daysInMonth(key)
  if (day >= end) return 0
  return Math.round((end.getTime() - day.getTime()) / 86_400_000)
}

/** True on the last day of the month, when next month is normally funded. */
export function isLastDayOfMonth(today = new Date()): boolean {
  return daysRemaining(monthKey(today), today) === 1
}
