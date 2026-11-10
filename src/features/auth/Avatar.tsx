import type { RememberedAccount } from '../../lib/firebase/sessions'

type Identity = Pick<RememberedAccount, 'email' | 'displayName' | 'photoURL'>

/** Photo when the provider gave one, otherwise the first letter of the name. */
export function Avatar({ account }: { account: Identity }) {
  const initial = (account.displayName ?? account.email ?? '?').trim().charAt(0).toUpperCase() || '?'

  if (account.photoURL) {
    return <img src={account.photoURL} alt="" className="h-7 w-7 flex-none rounded-full object-cover" />
  }
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-fg"
    >
      {initial}
    </span>
  )
}
