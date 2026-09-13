import { useOnlineStatus } from '../lib/hooks/useOnlineStatus'

/**
 * Persistent connectivity strip.
 *
 * Reassuring rather than alarming: the app genuinely keeps working offline,
 * so this explains the state instead of warning about it.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-40 bg-accent px-4 py-2 text-center text-sm font-semibold text-accent-fg"
    >
      Offline. Anything you record is saved on this device and syncs when you reconnect.
    </div>
  )
}
