import { onAuthStateChanged } from 'firebase/auth'
import { useEffect, useState, type ReactNode } from 'react'

import { auth } from '../../lib/firebase/auth'
import { rememberCurrent } from '../../lib/firebase/sessions'
import { AuthContext, type AuthState } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    // Fires once from the persisted session (works offline), then on every
    // sign-in and sign-out.
    return onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false })
      // Park a copy of this session so the account stays one tap away after a
      // switch to another one. Deliberately not awaited: parking is a
      // convenience and must never hold up rendering the signed-in app.
      if (user) void rememberCurrent(user)
    })
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
