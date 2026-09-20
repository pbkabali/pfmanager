import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'

import { db, userCollections, userDocPath, userPath } from '../../lib/firebase/db'
import type { SetAside } from '../profile/types'

export type NewDestination = { currency: string; name: string }

/**
 * Write the whole rules list back to the profile, creating any dedicated
 * accounts the rule asked for in the same batch so a rule never points at an
 * account that does not exist. Created accounts are marked committed: the
 * money in them is promised, so the budget leaves them alone.
 */
export function saveSetAsides(
  uid: string,
  rules: SetAside[],
  create: { ruleId: string; destinations: NewDestination[] }[] = [],
) {
  const batch = writeBatch(db)
  const accounts = collection(db, userPath(uid, userCollections.accounts))
  const next = rules.map((r) => ({ ...r, accounts: { ...r.accounts } }))

  for (const { ruleId, destinations } of create) {
    const rule = next.find((r) => r.id === ruleId)
    if (!rule) continue
    for (const d of destinations) {
      const ref = doc(accounts)
      batch.set(ref, {
        name: d.name,
        type: 'set_aside',
        currency: d.currency,
        openingBalanceMinor: 0,
        committed: true,
        archived: false,
        createdAt: serverTimestamp(),
      })
      rule.accounts[d.currency] = ref.id
    }
  }

  batch.update(doc(db, userDocPath(uid)), { setAsides: next })
  return batch.commit()
}

export function newRuleId(): string {
  return doc(collection(db, 'ids')).id
}
