/** 100% in basis points. Shares are integers so a plan can say 12.5%. */
export const BP_TOTAL = 10000

/**
 * Split a total between items by share, in whole minor units, so the parts
 * sum exactly to the total. Largest-remainder method: floor every share,
 * then hand the leftover units to the items that lost the most to flooring.
 * Deterministic, so every device computes the same split from the same plan.
 */
export function allocate(totalMinor: number, shares: Record<string, number>): Record<string, number> {
  const ids = Object.keys(shares).filter((id) => (shares[id] ?? 0) > 0)
  const out: Record<string, number> = {}
  for (const id of ids) out[id] = 0
  if (totalMinor <= 0 || ids.length === 0) return out

  let assigned = 0
  const remainders: [string, number][] = []
  for (const id of ids) {
    const exact = (totalMinor * (shares[id] ?? 0)) / BP_TOTAL
    const whole = Math.floor(exact)
    out[id] = whole
    assigned += whole
    remainders.push([id, exact - whole])
  }
  remainders.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  let left = totalMinor - assigned
  for (const [id] of remainders) {
    if (left <= 0) break
    out[id] = (out[id] ?? 0) + 1
    left--
  }
  return out
}

/**
 * How a month's money is divided, given what the previous month left.
 *
 * An item's own leftover stays with it, on top of its share. Leftovers from
 * items that have since left the plan (share removed or archived) have no
 * home, so they join the pool and are split by the shares like new money.
 */
export function planMonth(
  fundedMinor: number,
  shares: Record<string, number>,
  leftovers: Record<string, number>,
): { carriedMinor: number; carriedByItem: Record<string, number>; allocations: Record<string, number> } {
  const carriedByItem: Record<string, number> = {}
  let pooled = 0
  let carriedMinor = 0
  for (const [id, left] of Object.entries(leftovers)) {
    if (left <= 0) continue
    carriedMinor += left
    if ((shares[id] ?? 0) > 0) carriedByItem[id] = left
    else pooled += left
  }
  const allocations = allocate(fundedMinor + pooled, shares)
  for (const [id, left] of Object.entries(carriedByItem)) {
    allocations[id] = (allocations[id] ?? 0) + left
  }
  return { carriedMinor, carriedByItem, allocations }
}

export function sharesTotal(shares: Record<string, number>): number {
  return Object.values(shares).reduce((sum, bp) => sum + bp, 0)
}

/** 1250 -> "12.5", 3333 -> "33.33", 2000 -> "20". */
export function formatPercent(bp: number): string {
  return (bp / 100).toFixed(2).replace(/\.?0+$/, '')
}

/** "12.5" -> 1250; null when not a number in [0, 100]. Rounds to 0.01%. */
export function parsePercent(input: string): number | null {
  const cleaned = input.trim()
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value < 0 || value > 100) return null
  return Math.round(value * 100)
}
