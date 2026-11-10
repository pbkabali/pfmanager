import { useEffect, useRef, useState } from 'react'

import { DEFAULT_ICON, ICON_GROUPS } from './icons'

/**
 * Tap the icon, choose another.
 *
 * A button rather than a text field: typing an emoji means leaving the
 * keyboard you are using, hunting through the system picker, and landing it
 * in a 2.5rem box -- which is what the plan editor asked of people before,
 * and why so many items kept the fallback dot. Every icon here is one tap.
 */
export function IconPicker({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (icon: string) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

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

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-edge bg-bg text-lg hover:border-accent"
      >
        {value || DEFAULT_ICON}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          /* Left-aligned and above the row: the picker sits in the first
             column, so opening rightwards keeps it inside the card. */
          className="absolute left-0 z-50 mt-1 max-h-72 w-64 overflow-y-auto overscroll-contain rounded-lg border border-edge bg-surface p-2 shadow-lg"
        >
          {ICON_GROUPS.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <p className="px-1 pb-1 text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">
                {group.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.icons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => {
                      onChange(icon)
                      setOpen(false)
                    }}
                    aria-label={icon}
                    aria-pressed={icon === value}
                    className={`flex h-7 w-7 items-center justify-center rounded text-base hover:bg-surface-raised ${
                      icon === value ? 'bg-accent' : ''
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
