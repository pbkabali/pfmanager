import { formatMoney } from '../lib/money'

/**
 * A money amount, coloured by direction when asked.
 *
 * `tabular` keeps digits a fixed width so a column of amounts lines up.
 */
export function Money({
  amountMinor,
  currency,
  direction,
  className = '',
}: {
  amountMinor: number
  currency: string
  /** Colour income green and spending red; omit for a neutral figure. */
  direction?: 'in' | 'out'
  className?: string
}) {
  const colour =
    direction === 'in' ? 'text-positive-text' : direction === 'out' ? 'text-negative-text' : ''
  const signed = direction !== undefined
  const value = direction === 'out' ? -Math.abs(amountMinor) : amountMinor

  return (
    <span className={`tabular ${colour} ${className}`}>
      {formatMoney(value, currency, { signed })}
    </span>
  )
}
