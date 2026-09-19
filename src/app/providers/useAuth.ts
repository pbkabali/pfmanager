import { useContext } from 'react'

import { AuthContext, type AuthState } from './authContext'

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

/**
 * For screens inside ProtectedRoute, where a user is guaranteed. Throws rather
 * than returning null so the many callers need no null checks; the throw only
 * fires on a wiring mistake, never at runtime for a real user.
 */
export function useUser() {
  const { user } = useContext(AuthContext)
  if (!user) throw new Error('useUser() called outside a protected route')
  return user
}
