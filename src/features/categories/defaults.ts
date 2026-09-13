import type { Category } from './types'

/**
 * Seeded into a new profile. Ids are fixed words rather than random so the
 * seed is idempotent -- re-running it on an existing profile overwrites the
 * same documents instead of duplicating them.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'salary', name: 'Salary', kind: 'income', icon: '💼', archived: false, sortOrder: 0 },
  { id: 'business', name: 'Business', kind: 'income', icon: '🏪', archived: false, sortOrder: 1 },
  { id: 'gifts-in', name: 'Gifts received', kind: 'income', icon: '🎁', archived: false, sortOrder: 2 },
  { id: 'other-income', name: 'Other income', kind: 'income', icon: '➕', archived: false, sortOrder: 3 },

  { id: 'food', name: 'Food & groceries', kind: 'expense', icon: '🍲', archived: false, sortOrder: 10 },
  { id: 'transport', name: 'Transport', kind: 'expense', icon: '🚕', archived: false, sortOrder: 11 },
  { id: 'housing', name: 'Rent & housing', kind: 'expense', icon: '🏠', archived: false, sortOrder: 12 },
  { id: 'utilities', name: 'Utilities & airtime', kind: 'expense', icon: '💡', archived: false, sortOrder: 13 },
  { id: 'health', name: 'Health', kind: 'expense', icon: '🩺', archived: false, sortOrder: 14 },
  { id: 'education', name: 'Education', kind: 'expense', icon: '📚', archived: false, sortOrder: 15 },
  { id: 'family', name: 'Family & giving', kind: 'expense', icon: '🤝', archived: false, sortOrder: 16 },
  { id: 'leisure', name: 'Leisure', kind: 'expense', icon: '🎬', archived: false, sortOrder: 17 },
  { id: 'shopping', name: 'Shopping', kind: 'expense', icon: '🛍️', archived: false, sortOrder: 18 },
  { id: 'savings', name: 'Savings & investments', kind: 'expense', icon: '🏦', archived: false, sortOrder: 19 },
  { id: 'other-expense', name: 'Other', kind: 'expense', icon: '•', archived: false, sortOrder: 20 },
]
