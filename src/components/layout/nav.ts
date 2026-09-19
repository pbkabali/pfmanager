/**
 * The app's sections, in the order they appear in the tab bar and sidebar,
 * which is also the order a horizontal swipe moves through them.
 */
export const navItems = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/transactions', label: 'Activity', icon: '≡', end: false },
  { to: '/budget', label: 'Budget', icon: '◎', end: false },
  { to: '/accounts', label: 'Accounts', icon: '▤', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙', end: false },
] as const

/** Which section a path belongs to; sub-pages count as their section. */
export function navIndexFor(pathname: string): number {
  if (pathname === '/') return 0
  const i = navItems.findIndex((item) => item.to !== '/' && pathname.startsWith(item.to))
  return i === -1 ? 0 : i
}
