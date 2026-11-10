import { formatMoney } from '../../lib/money'
import type { Account } from '../accounts/types'
import type { Category } from '../categories/types'
import type { SetAside } from '../profile/types'
import type { Transaction, TransactionType } from './types'

/**
 * Searching and filtering the activity log, kept out of the component so the
 * matching rules can be read -- and corrected -- without reading JSX.
 *
 * All of it runs on the device. The ledger is small enough that scanning it
 * is instant, it keeps working with no connection, and it can match on things
 * Firestore cannot query at all: free text in a note, a category's name, an
 * account's name. A server-side `where` would need an index per combination
 * and would still not search text.
 */

/** The activity-type presets, in the order they appear as chips. */
export const TYPE_PRESETS = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Received' },
  { value: 'expense', label: 'Spent' },
  { value: 'transfer', label: 'Moved' },
] as const

export type TypeFilter = (typeof TYPE_PRESETS)[number]['value']

export function isTypeFilter(value: string | null): value is TypeFilter {
  return TYPE_PRESETS.some((p) => p.value === value)
}

/** What the type chip reads as in a row's searchable text. */
const TYPE_WORDS: Record<TransactionType, string> = {
  income: 'received income in',
  expense: 'spent expense out',
  transfer: 'moved transfer',
}

export type ActivityQuery = {
  text: string
  type: TypeFilter
  /** Budget item (category) id, or '' for any. */
  categoryId: string
}

export const EMPTY_QUERY: ActivityQuery = { text: '', type: 'all', categoryId: '' }

export function isFiltering(query: ActivityQuery): boolean {
  return query.text.trim() !== '' || query.type !== 'all' || query.categoryId !== ''
}

/** Everything a row needs to describe itself in words. */
export type Lookups = {
  categories: Map<string, Category>
  accounts: Map<string, Account>
  setAsides: SetAside[]
  /** Profile currency, for rows written before currencies were per-account. */
  currency: string
}

/** A transaction paired with the lowercased text a search is matched against. */
export type IndexedTransaction = { transaction: Transaction; text: string }

/**
 * Digits only, so a typed "45000" finds "UGX 45,000" and a typed "45,000"
 * finds it too. Both sides go through this, so neither has to guess how the
 * other was punctuated.
 */
function digits(value: string): string {
  return value.replace(/\D+/g, '')
}

function describe(t: Transaction, lookups: Lookups): string {
  const { categories, accounts, setAsides, currency } = lookups
  const category = t.categoryId ? categories.get(t.categoryId) : undefined
  const account = accounts.get(t.accountId)
  const toAccount = t.toAccountId ? accounts.get(t.toAccountId) : undefined
  const rule = t.setAsideId ? setAsides.find((r) => r.id === t.setAsideId) : undefined
  const date = t.date.toDate()

  return [
    t.note,
    category?.name,
    account?.name,
    toAccount?.name,
    rule?.name,
    TYPE_WORDS[t.type],
    // Month and year as words: "nov" or "november 2026" finds the month.
    date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    digits(formatMoney(t.amountMinor, t.currency ?? currency)),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/**
 * Build the searchable text once per row. Kept separate from `applyQuery` so
 * typing re-filters without re-describing every transaction on each keystroke.
 */
export function indexTransactions(transactions: Transaction[], lookups: Lookups): IndexedTransaction[] {
  return transactions.map((transaction) => ({ transaction, text: describe(transaction, lookups) }))
}

/**
 * Every word must appear somewhere in the row, in any order: "food nov"
 * finds November's groceries. Words rather than the whole phrase, because
 * nobody remembers whether they wrote "airtime MTN" or "MTN airtime".
 */
function matchesText(text: string, needle: string): boolean {
  const words = needle.toLowerCase().split(/\s+/).filter(Boolean)
  // A word that is only digits and separators is an amount, and is compared
  // digits-to-digits so "45,000" and "45000" are the same search.
  return words.every((word) => text.includes(/^[\d.,]+$/.test(word) ? digits(word) : word))
}

export function applyQuery(rows: IndexedTransaction[], query: ActivityQuery): Transaction[] {
  const needle = query.text.trim()
  return rows
    .filter(({ transaction, text }) => {
      if (query.type !== 'all' && transaction.type !== query.type) return false
      if (query.categoryId && transaction.categoryId !== query.categoryId) return false
      if (needle && !matchesText(text, needle)) return false
      return true
    })
    .map((row) => row.transaction)
}

/**
 * The matched total, but only when adding the rows up means something: one
 * direction (all received, or all spent) and one currency. Mixing income with
 * spending, or shillings with dollars, would produce a confident wrong number,
 * so those cases get nothing rather than a figure nobody should trust.
 */
export function matchedTotal(
  rows: Transaction[],
  query: ActivityQuery,
  fallbackCurrency: string,
): { amountMinor: number; currency: string } | null {
  if (query.type !== 'income' && query.type !== 'expense') return null
  if (rows.length === 0) return null
  const first = rows[0]
  if (!first) return null
  const currency = first.currency ?? fallbackCurrency
  let amountMinor = 0
  for (const row of rows) {
    if ((row.currency ?? fallbackCurrency) !== currency) return null
    amountMinor += row.amountMinor
  }
  return { amountMinor, currency }
}
