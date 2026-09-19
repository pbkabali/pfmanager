import { createContext } from 'react'
import type { User } from 'firebase/auth'

export type AuthState = {
  user: User | null
  /** True until the first auth state resolves; routes must wait on this. */
  loading: boolean
}

export const AuthContext = createContext<AuthState>({ user: null, loading: true })
