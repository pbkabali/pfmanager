import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { navIndexFor, navItems } from './nav'

/** Horizontal travel that counts as a swipe, in CSS pixels. */
const MIN_DISTANCE = 60
/** Vertical travel that marks the gesture as a scroll and ends the attempt. */
const SCROLL_TOLERANCE = 30
/** Strip at each side reserved for the OS back/forward gesture. */
const EDGE_ZONE = 24

/**
 * Swipe left or right on a phone to move to the next or previous section, in
 * tab-bar order. Nothing happens on wider screens, where the sidebar makes
 * the gesture pointless, or in landscape, where a horizontal swipe is more
 * often a scroll through a wide table.
 *
 * The gesture yields to anything that already owns it: a swipe that starts
 * inside a form (half-typed entries must not vanish), on an input, inside a
 * horizontally scrolling element, or in the OS edge zones is ignored. A
 * gesture that goes vertical first is a scroll and is dropped.
 */
export function SwipeNavigation() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    let start: { x: number; y: number } | null = null

    const phonePortrait = () =>
      window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches

    const claimedElsewhere = (target: EventTarget | null): boolean => {
      for (let el = target as HTMLElement | null; el; el = el.parentElement) {
        const tag = el.tagName
        if (tag === 'FORM' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true
        if (el.isContentEditable) return true
        if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') return true
      }
      return false
    }

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      start = null
      if (!touch || event.touches.length > 1 || !phonePortrait()) return
      if (touch.clientX < EDGE_ZONE || touch.clientX > window.innerWidth - EDGE_ZONE) return
      if (claimedElsewhere(event.target)) return
      start = { x: touch.clientX, y: touch.clientY }
    }

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!start || !touch) return
      const dx = Math.abs(touch.clientX - start.x)
      const dy = Math.abs(touch.clientY - start.y)
      // Vertical intent shown before horizontal: this is a scroll.
      if (dy > SCROLL_TOLERANCE && dy > dx) start = null
    }

    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0]
      if (!start || !touch) return
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      start = null
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return

      const current = navIndexFor(pathname)
      const next = dx < 0 ? current + 1 : current - 1
      const target = navItems[next]
      if (target) navigate(target.to)
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [navigate, pathname])

  return null
}
