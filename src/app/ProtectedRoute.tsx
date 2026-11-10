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
  //
  // Keyed by uid so switching accounts tears the whole subtree down and
  // builds it again. Without the key, React would reuse the mounted tree and
  // every piece of state in it -- an open form, a chosen month, the profile
  // ProfileGate still holds -- would belong to the account just left, showing
  // one person's currency and figures under another's name until each
  // listener happened to catch up.
  return (
    <ProfileGate key={user.uid}>
      <Outlet />
    </ProfileGate>
  )
}
