/**
 * Money handling.
 *
 * Amounts are stored as INTEGERS in the currency's minor unit -- cents for
 * USD, whole shillings for UGX (which has no minor unit). Floats are never
 * stored: 0.1 + 0.2 is not 0.3, and a ledger that drifts by a cent is a
 * ledger nobody trusts. Conversion to and from decimal happens only at the
 * edges, here.
 */

const digitsCache = new Map<string, number>()

/** How many decimal places a currency uses. 2 for USD, 0 for UGX, 3 for KWD. */
export function minorUnitDigits(currency: string): number {
  let digits = digitsCache.get(currency)
  if (digits === undefined) {
    try {
      digits =
        new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
          .maximumFractionDigits ?? 2
    } catch {
      digits = 2 // unknown code: assume the common case
    }
    digitsCache.set(currency, digits)
  }
  return digits
}

/** Minor units -> display string, e.g. 123456 UGX -> "UGX 123,456". */
export function formatMoney(
  amountMinor: number,
  currency: string,
  options: { signed?: boolean; locale?: string } = {},
): string {
  const digits = minorUnitDigits(currency)
  const major = amountMinor / 10 ** digits
  return new Intl.NumberFormat(options.locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    signDisplay: options.signed ? 'exceptZero' : 'auto',
  }).format(major)
}

/**
 * User-typed decimal string -> minor units, or null if it is not a number.
 *
 * Accepts "1,250.50", "1250", "  75 ". Rounds to the currency's precision
 * rather than refusing extra digits, since keypads make "12.345" easy to type.
 */
export function parseAmount(input: string, currency: string): number | null {
  const cleaned = input.replace(/[\s,]/g, '')
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') return null
  const major = Number(cleaned)
  if (!Number.isFinite(major)) return null
  return Math.round(major * 10 ** minorUnitDigits(currency))
}

/** Minor units -> plain decimal string for an input's value, no grouping. */
export function toInputValue(amountMinor: number, currency: string): string {
  const digits = minorUnitDigits(currency)
  return (amountMinor / 10 ** digits).toFixed(digits)
}
