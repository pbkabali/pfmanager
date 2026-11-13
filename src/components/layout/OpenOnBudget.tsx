import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { hasUnsavedWork } from '../../lib/hooks/useUnsavedWork'
import { navItems } from './nav'

const BUDGET = '/budget'

/**
 * How long away counts as coming BACK to the app rather than glancing away.
 *
 * Stepping out to read the mobile-money SMS for an amount and returning is
 * the common case, and it must leave the screen exactly as it was. A gap
 * longer than this is a new sitting, and a new sitting starts at the budget.
 */
const AWAY_MS = 5 * 60 * 1000

/**
 * True until this page load has routed once. Module scope on purpose: what
 * resets it is a reload, which is precisely the event being detected.
 */
let coldStart = true

/**
 * The budget is where this app is opened to be used: what is left, and what
 * is left per day. Both ways in lead there.
 *
 * Launching goes through the manifest's start_url, which is enough on its
 * own when the platform honours it. Platforms vary: iOS in particular drops
 * a backgrounded app from memory and relaunches it at whatever page it was
 * last showing, which looks like a launch to the person and like an ordinary
 * page load to the app. `landing()` below sorts those out.
 *
 * Returning from the background is the app's own decision, so it is the
 * careful one. It waits for a real absence, and never moves off a form,
 * because everything typed into one is held in memory until Save.
 */
/** The five tab destinations. A path outside them was asked for specifically. */
const TABS = new Set<string>(navItems.map((item) => item.to))

/**
 * Whether this page load is the app being opened, as against the page it is
 * on being asked for.
 *
 * Three things have to be told apart, and the navigation type separates two
 * of them: a pull-to-refresh reports `reload` and a Back lands as
 * `back_forward`, and both plainly meant the page they are on. What is left
 * is `navigate` -- a launch, or a link somebody followed.
 *
 * The path settles that last one. A tab is where the app happened to be when
 * the system reclaimed it; a transaction or an account is somewhere a link
 * pointed at, and sending that to the budget would lose what was shared.
 */
function landing(): boolean {
  const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  if (entry && entry.type !== 'navigate') return false
  return TABS.has(window.location.pathname)
}

export function OpenOnBudget() {
  const navigate = useNavigate()

  useEffect(() => {
    if (coldStart) {
      coldStart = false
      if (window.location.pathname !== BUDGET && landing()) navigate(BUDGET, { replace: true })
    }

    let hiddenAt: number | null = null

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt
      hiddenAt = null
      if (away < AWAY_MS) return
      if (hasUnsavedWork()) return
      if (window.location.pathname === BUDGET) return
      // Pushed, not replaced: whatever was on screen is one Back away.
      navigate(BUDGET)
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [navigate])

  return null
}
