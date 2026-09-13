import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { useUser } from '../../app/providers/useAuth'
import { Loading } from '../../components/Loading'
import { db, userDocPath } from '../../lib/firebase/db'
import { useOnlineStatus } from '../../lib/hooks/useOnlineStatus'
import { seedProfile } from './ensureProfile'
import { ProfileContext } from './profileContext'
import type { Profile } from './types'

type State =
  | { status: 'loading' }
  | { status: 'ready'; profile: Profile }
  | { status: 'seeding' }
  | { status: 'first-run-offline' }
  | { status: 'error'; error: Error }

/**
 * Resolves the signed-in user's profile, creating it on first sign-in.
 *
 * Listens rather than reads once, so a currency change in Settings reaches
 * every screen live. The seed only fires on a SERVER-confirmed "does not
 * exist": a cache miss while offline looks identical to a missing document,
 * and seeding on it would overwrite a real profile the moment the network
 * came back. First sign-in on a fresh device therefore needs a connection --
 * every later open works offline from the persisted session and cache.
 */
export function ProfileGate({ children }: { children: ReactNode }) {
  const user = useUser()
  const online = useOnlineStatus()
  const [state, setState] = useState<State>({ status: 'loading' })
  const seeding = useRef(false)

  useEffect(() => {
    return onSnapshot(
      doc(db, userDocPath(user.uid)),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.exists()) {
          setState({ status: 'ready', profile: snap.data() as Profile })
          return
        }
        if (snap.metadata.fromCache) {
          // Not yet confirmed by the server; could be a brand-new user or an
          // offline device with an empty cache. Wait, and explain if offline.
          setState({ status: navigator.onLine ? 'loading' : 'first-run-offline' })
          return
        }
        if (seeding.current) return
        seeding.current = true
        setState({ status: 'seeding' })
        seedProfile(user).catch((error: Error) => {
          seeding.current = false
          setState({ status: 'error', error })
        })
      },
      (error) => setState({ status: 'error', error }),
    )
  }, [user])

  switch (state.status) {
    case 'loading':
      return <Loading label={online ? 'Loading your profile' : 'Waiting for connection'} />
    case 'seeding':
      return <Loading label="Setting things up" />
    case 'first-run-offline':
      return (
        <Problem
          title="Connect once to get started"
          detail="The first sign-in on a device needs internet to set up your profile. After that, everything works offline."
        />
      )
    case 'error':
      return <Problem title="Could not load your profile" detail={state.error.message} />
    case 'ready':
      return <ProfileContext.Provider value={state.profile}>{children}</ProfileContext.Provider>
  }
}

function Problem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
      <h1 className="text-xl font-bold text-danger-text">{title}</h1>
      <p className="max-w-sm text-sm text-fg-muted">{detail}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-bold text-accent-fg"
      >
        Retry
      </button>
    </div>
  )
}
