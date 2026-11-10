import type { Category } from './types'

/**
 * Seeded into a new profile. Ids are fixed words rather than random so the
 * seed is idempotent -- re-running it on an existing profile overwrites the
 * same documents instead of duplicating them.
 *
 * Expense categories are DELIBERATELY not seeded beyond "Out of budget".
 *
 * A monthly plan is the one thing in this app that is entirely personal --
 * what somebody's money is for, and in what proportion. Seeding a dozen
 * opinionated items ("Leisure", "Shopping", "Education") meant a new profile
 * opened its plan already full of somebody else's priorities, which read as
 * though another account's items had leaked in. The plan now starts empty and
 * is built with "+ Add an item".
 *
 * "Out of budget" stays because it is structural rather than opinionated:
 * the code refers to it by id (OUT_OF_BUDGET_CATEGORY_ID) as the one place
 * spending can go that the plan does not govern.
 *
 * Income categories stay for now because nothing in the UI can create one,
 * so seeding none would leave a new profile unable to record income at all.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'salary', name: 'Salary', kind: 'income', icon: '💼', archived: false, sortOrder: 0 },
  { id: 'business', name: 'Business', kind: 'income', icon: '🏪', archived: false, sortOrder: 1 },
  { id: 'gifts-in', name: 'Gifts received', kind: 'income', icon: '🎁', archived: false, sortOrder: 2 },
  { id: 'other-income', name: 'Other income', kind: 'income', icon: '➕', archived: false, sortOrder: 3 },

  { id: 'out-of-budget', name: 'Out of budget', kind: 'expense', icon: '🧾', archived: false, sortOrder: 99 },
]
