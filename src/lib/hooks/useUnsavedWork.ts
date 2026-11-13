import { useEffect } from 'react'

/**
 * Marks that something on screen holds input a person has not saved.
 *
 * Read by anything that would navigate on its own -- today, the jump to
 * Budget when the app is reopened. A form keeps its answers in memory until
 * an explicit Save, so a route change the app CHOSE would discard a
 * half-entered split income at a moment of its choosing rather than the
 * person's. That is the same reasoning that keeps the update banner from
 * reloading by itself.
 *
 * Module scope rather than context: the question is only ever "is any form
 * open", nothing re-renders on the answer, and a counter cannot get out of
 * step the way a boolean shared by two open forms would.
 */
let openForms = 0

export function hasUnsavedWork(): boolean {
  return openForms > 0
}

/** Call from a form. Counted while it is mounted. */
export function useUnsavedWork(): void {
  useEffect(() => {
    openForms++
    return () => {
      openForms--
    }
  }, [])
}
