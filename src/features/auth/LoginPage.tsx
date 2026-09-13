import { FirebaseError } from 'firebase/app'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../../app/providers/useAuth'
import { Brand } from '../../components/Brand'
import { Loading } from '../../components/Loading'
import { resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from '../../lib/firebase/auth'

type Mode = 'signin' | 'signup'

const field = 'mt-1 w-full rounded-md border border-edge bg-bg px-3 py-2 text-fg'
const label = 'text-xs font-semibold tracking-wide text-fg-muted uppercase'

export function LoginPage() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (loading) return <Loading label="Checking sign-in" />
  // Already signed in: skip the form. Navigation happens here rather than in
  // the submit handler so the Google popup path gets it for free too.
  if (user) return <Navigate to={from} replace />

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (cause) {
      setError(describeAuthError(cause))
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void run(() => (mode === 'signin' ? signInWithEmail(email, password) : signUpWithEmail(email, password)))
  }

  function onForgot() {
    if (!email) {
      setError('Enter your email first, then tap “Forgot password”.')
      return
    }
    void run(async () => {
      await resetPassword(email)
      setNotice('Password reset email sent.')
    })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Brand size="lg" />
          <p className="mt-2 text-sm text-fg-subtle">Your money, on any device, even offline.</p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void run(signInWithGoogle)}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-2.5 text-sm font-semibold text-fg disabled:opacity-60"
        >
          <GoogleMark />
          Continue with Google
        </button>

        <div className="flex items-center gap-3 text-xs text-fg-subtle">
          <span className="h-px flex-1 bg-edge" />
          or with email
          <span className="h-px flex-1 bg-edge" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-edge bg-surface p-5">
          <label className="block">
            <span className={label}>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
          </label>

          <label className="block">
            <span className={label}>Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-danger-text">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-positive-text">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-accent py-2.5 font-bold text-accent-fg disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="font-semibold text-accent-text underline"
            >
              {mode === 'signin' ? 'Create an account' : 'I already have an account'}
            </button>
            {mode === 'signin' && (
              <button type="button" onClick={onForgot} className="text-fg-subtle underline">
                Forgot password
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
    </svg>
  )
}

/** Firebase auth errors are codes; surface something a human can act on. */
function describeAuthError(cause: unknown): string {
  if (cause instanceof FirebaseError) {
    switch (cause.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password.'
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Sign in instead.'
      case 'auth/weak-password':
        return 'Use a password of at least 8 characters.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again shortly.'
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Sign-in was cancelled.'
      case 'auth/network-request-failed':
        return 'No connection. Signing in needs internet, unlike the rest of the app.'
      default:
        return cause.message
    }
  }
  return 'Something went wrong. Try again.'
}
