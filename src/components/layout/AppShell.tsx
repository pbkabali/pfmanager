import { NavLink, Outlet } from 'react-router-dom'

import { Brand } from '../Brand'
import { InstallPrompt } from '../InstallPrompt'
import { OfflineBanner } from '../OfflineBanner'
import { ThemeToggle } from '../ThemeToggle'
import { navItems } from './nav'
import { SwipeNavigation } from './SwipeNavigation'

/**
 * App chrome that adapts to the screen rather than picking a side.
 *
 * - Phones: a fixed bottom tab bar within thumb reach, safe-area aware.
 * - `md` and up: a left sidebar, which is what a finance dashboard wants on
 *   a laptop -- the content area gets the full height for charts and tables.
 *
 * Both render the same navItems so a route is never reachable on one form
 * factor and missing on the other. On a phone in portrait, swiping left or
 * right moves through the same list.
 */
export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col overscroll-none-y md:flex-row">
      <SwipeNavigation />
      {/* ---- Sidebar (desktop) ---- */}
      <aside className="hidden w-56 flex-none flex-col border-r border-edge bg-surface md:flex">
        <div className="px-5 py-5">
          <Brand />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:bg-surface-raised hover:text-fg'
                }`
              }
            >
              <span aria-hidden className="w-4 text-center">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4">
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />

        {/* ---- Top bar (mobile only) ---- */}
        <header className="flex items-center justify-between border-b border-edge bg-surface px-4 py-3 md:hidden">
          <Brand />
          <ThemeToggle />
        </header>

        {/* pb-24 clears the fixed mobile tab bar. */}
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pt-4 pb-24 md:px-8 md:pt-8 md:pb-8">
          <InstallPrompt />
          <Outlet />
        </main>
      </div>

      {/* ---- Tab bar (mobile) ---- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-edge bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold tracking-wide uppercase transition-colors ${
                isActive ? 'text-accent-text' : 'text-fg-subtle'
              }`
            }
          >
            <span aria-hidden className="text-lg leading-none">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
