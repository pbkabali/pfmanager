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
