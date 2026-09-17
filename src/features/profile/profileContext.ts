import { createContext, useContext } from 'react'

import type { Profile } from './types'

/** Non-null by construction: ProfileGate only renders children once it exists. */
export const ProfileContext = createContext<Profile | null>(null)

export function useProfile(): Profile {
  const profile = useContext(ProfileContext)
  if (!profile) throw new Error('useProfile() called outside ProfileGate')
  return profile
}
