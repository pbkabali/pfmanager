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
}
