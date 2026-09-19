export type CategoryKind = 'income' | 'expense'

export type Category = {
  id: string
  name: string
  kind: CategoryKind
  /** Emoji or short glyph shown beside the name. */
  icon: string
  /** Hidden from pickers but kept so old transactions still resolve. */
  archived: boolean
  sortOrder: number
  /**
   * Expense categories only: the share of each month's lumpsum this item
   * gets, in basis points (10000 = 100%). Absent or 0 means the category is
   * not part of the monthly plan. All budgeted items must total 10000 before
   * a month can be funded.
   */
  shareBp?: number
  /**
   * The one item whose remaining balance is also shown per day for the rest
   * of the month. At most one category carries this.
   */
  daily?: boolean
}
