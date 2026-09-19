import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { Loading } from '../components/Loading'
import { ProfileGate } from '../features/profile/ProfileGate'
import { useAuth } from './providers/useAuth'

/**
 * Gates everything: there is no public content in a personal finance app.
 *
 * Convenience only -- it hides UI, it does not protect data. firestore.rules
 * enforces ownership server-side with the same uid.
 */
export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loading label="Checking sign-in" />

  if (!user) {
    // Remember where they were headed so login can bounce them back.
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  // Children only mount once the profile exists, so every screen inside can
  // rely on a currency and a set of categories being there.
  return (
    <ProfileGate>
      <Outlet />
    </ProfileGate>
  )
}
