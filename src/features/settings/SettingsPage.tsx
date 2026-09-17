import { doc, updateDoc } from 'firebase/firestore'

import { useUser } from '../../app/providers/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { ThemeToggle } from '../../components/ThemeToggle'
import { signOut } from '../../lib/firebase/auth'
import { db, userDocPath } from '../../lib/firebase/db'
import { useProfile } from '../profile/profileContext'
import { CURRENCIES } from '../profile/types'

const label = 'text-xs font-semibold tracking-wide text-fg-muted uppercase'

export function SettingsPage() {
  const user = useUser()
  const profile = useProfile()

  return (
    <>
      <PageHeader title="Settings" />

      <div className="space-y-4">
        <section className="rounded-lg border border-edge bg-surface p-4">
          <p className={label}>Signed in as</p>
          <p className="mt-1 text-sm font-semibold text-fg">{user.displayName ?? user.email}</p>
          {user.displayName && <p className="text-xs text-fg-subtle">{user.email}</p>}
        </section>

        <section className="rounded-lg border border-edge bg-surface p-4">
          <label className="block">
            <span className={label}>Currency</span>
            <select
              value={profile.currency}
              onChange={(e) => void updateDoc(doc(db, userDocPath(user.uid)), { currency: e.target.value })}
              className="mt-1 w-full rounded-md border border-edge bg-bg px-3 py-2 text-fg"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-fg-subtle">
            Changes how amounts are shown. Existing amounts are not converted.
          </p>
        </section>

        <section className="rounded-lg border border-edge bg-surface p-4">
          <p className={label}>Appearance</p>
          <div className="mt-2">
            <ThemeToggle />
          </div>
        </section>

        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-md border border-edge py-2.5 text-sm font-semibold text-danger-text"
        >
          Sign out
        </button>
        <p className="text-center text-xs text-fg-subtle">
          Signing out clears nothing on the server. Signing back in needs a connection.
        </p>
      </div>
    </>
  )
}
