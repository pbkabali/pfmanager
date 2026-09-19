/** Calendar helpers for "this month" style ranges. Local time, on purpose:
 *  a purchase at 23:30 belongs to the day the person experienced. */

export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function startOfNextMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

export function monthLabel(date = new Date()): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

/** `YYYY-MM-DD` in local time, for a date input's value. */
export function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Parse a date input's value as local midnight. `new Date('2026-01-05')` would be UTC. */
export function fromDateInputValue(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}
