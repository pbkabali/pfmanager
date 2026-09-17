import type { Timestamp } from 'firebase/firestore'

/** Where money physically sits. Mobile money is first-class: it is how most
 *  day-to-day spending happens here. */
export type AccountType = 'cash' | 'mobile_money' | 'bank' | 'card' | 'savings' | 'other'

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'mobile_money', label: 'Mobile money', icon: '📱' },
  { value: 'bank', label: 'Bank account', icon: '🏦' },
  { value: 'card', label: 'Card', icon: '💳' },
  { value: 'savings', label: 'Savings', icon: '🐖' },
  { value: 'other', label: 'Other', icon: '▤' },
]

export type Account = {
  id: string
  name: string
  type: AccountType
  /** Balance before any recorded transaction, in minor units. */
  openingBalanceMinor: number
  archived: boolean
  createdAt: Timestamp | null
}

export const DEFAULT_ACCOUNT_ID = 'cash'
