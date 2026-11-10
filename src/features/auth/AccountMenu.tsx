import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useUser } from '../../app/providers/useAuth'
import {
  forget,
  rememberedAccounts,
  signOutAndForget,
  switchTo,
  type RememberedAccount,
} from '../../lib/firebase/sessions'
import { Avatar } from './Avatar'

/**
 * The account control in the app chrome.
 *
 * It lives in the shell rather than on a settings screen because sign-out was
 * previously only at the bottom of Settings, below four other sections, and
 * was effectively unfindable. Rendered in both the desktop sidebar and the
 * mobile top bar so it is reachable from every screen.
 */
export function AccountMenu({ placement = 'up' }: { placement?: 'up' | 'down' }) {
  const user = useUser()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)

  // Other accounts are read when the menu opens, not on every render: the
  // list lives in localStorage and only changes through actions taken here.
  const [others, setOthers] = useState<RememberedAccount[]>([])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function toggle() {
    if (!open) {
      setOthers(rememberedAccounts().filter((a) => a.uid !== user.uid))
      setError(null)
    }
    setOpen(!open)
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      setOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work. Try again.')
      setOthers(rememberedAccounts().filter((a) => a.uid !== user.uid))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-auto items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-surface-raised md:w-full"
      >
        <Avatar account={user} />
        <span className="hidden min-w-0 flex-1 truncate text-xs text-fg-muted md:block">
          {user.displayName ?? user.email}
        </span>
        <span aria-hidden className="hidden text-xs text-fg-subtle md:inline">
          ⌄
        </span>
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-40 w-64 overflow-hidden rounded-lg border border-edge bg-surface shadow-lg ${
            placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <div className="flex items-center gap-2 border-b border-edge px-3 py-3">
            <Avatar account={user} />
            <div className="min-w-0">
              {user.displayName && (
                <p className="truncate text-sm font-semibold text-fg">{user.displayName}</p>
              )}
              <p className="truncate text-xs text-fg-muted">{user.email}</p>
            </div>
          </div>

          {others.length > 0 && (
            <div className="border-b border-edge py-1">
              <p className="px-3 py-1 text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">
                Switch to
              </p>
              {others.map((account) => (
                <div key={account.uid} className="flex items-center">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => void run(() => switchTo(account.uid))}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-surface-raised disabled:opacity-60"
                  >
                    <Avatar account={account} />
                    <span className="min-w-0 flex-1 truncate text-sm text-fg">
                      {account.displayName ?? account.email}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    title={`Forget ${account.email ?? 'this account'} on this device`}
                    onClick={() =>
                      void run(async () => {
                        await forget(account.uid)
                        setOthers(rememberedAccounts().filter((a) => a.uid !== user.uid))
                      })
                    }
                    className="px-3 py-2 text-xs text-fg-subtle hover:text-danger-text disabled:opacity-60"
                  >
                    <span aria-hidden>✕</span>
                    <span className="sr-only">Forget {account.email ?? 'this account'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p role="alert" className="border-b border-edge px-3 py-2 text-xs text-danger-text">
              {error}
            </p>
          )}

          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                void navigate('/login', { state: { add: true } })
              }}
              className="w-full px-3 py-2 text-left text-sm text-fg hover:bg-surface-raised disabled:opacity-60"
            >
              Add another account
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => void run(signOutAndForget)}
              className="w-full px-3 py-2 text-left text-sm font-semibold text-danger-text hover:bg-danger/10 disabled:opacity-60"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

