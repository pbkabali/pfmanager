import type { SetAside } from '../profile/types'

export const BP_TOTAL = 10000

/** Whole minor units; a tithe of 12,345 at 10% is 1,235, not 1,234.5. */
export function setAsideAmount(amountMinor: number, shareBp: number): number {
  return Math.round((amountMinor * shareBp) / BP_TOTAL)
}

export type SetAsideLine = {
  rule: SetAside
  /** Destination for this currency, or undefined when the rule has none. */
  toAccountId: string | undefined
  amountMinor: number
  /** True when the income already lands in the rule's own account. */
  selfDirected: boolean
}

/**
 * What each active rule would do with one income part. Lines with no
 * destination or that are self-directed are returned so the form can say
 * why nothing will move, but must not be written.
 */
export function setAsideLines(
  rules: SetAside[] | undefined,
  part: { accountId: string; currency: string; amountMinor: number },
): SetAsideLine[] {
  return (rules ?? [])
    .filter((r) => !r.paused && r.shareBp > 0)
    .map((rule) => {
      const toAccountId = rule.accounts[part.currency]
      return {
        rule,
        toAccountId,
        amountMinor: setAsideAmount(part.amountMinor, rule.shareBp),
        selfDirected: toAccountId === part.accountId,
      }
    })
}

export function isActionable(line: SetAsideLine): line is SetAsideLine & { toAccountId: string } {
  return !!line.toAccountId && !line.selfDirected && line.amountMinor > 0
}

/** 1000 -> "10", 1250 -> "12.5". */
export function formatShare(bp: number): string {
  return (bp / 100).toFixed(2).replace(/\.?0+$/, '')
}

/** "12.5" -> 1250; null when not a number in (0, 100]. */
export function parseShare(input: string): number | null {
  const cleaned = input.trim()
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0 || value > 100) return null
  return Math.round(value * 100)
}
