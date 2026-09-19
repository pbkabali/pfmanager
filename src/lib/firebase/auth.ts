import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
} from 'firebase/auth'

import { firebaseApp } from './app'
import { useEmulators } from './config'

/**
 * Firebase Auth persists the session in IndexedDB by default, so a returning
 * user is restored with no network -- which is what lets the whole app open
 * and work offline. Only the very first sign-in on a device needs a
 * connection.
 */
export const auth: Auth = getAuth(firebaseApp)

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
}

const google = new GoogleAuthProvider()
// Ask for the account chooser every time, so a shared laptop does not silently
// sign into whichever Google account is active.
google.setCustomParameters({ prompt: 'select_account' })

/**
 * Popup, not redirect. Redirect sign-in depends on third-party cookies between
 * the app origin and the auth domain, which Safari and Chrome are both
 * phasing out; popup has no such dependency and works in an installed PWA.
 */
export function signInWithGoogle() {
  return signInWithPopup(auth, google)
}

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password)
}

export function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email)
}

export function signOut() {
  return firebaseSignOut(auth)
}
