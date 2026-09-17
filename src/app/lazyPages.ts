import { lazy } from 'react'

/*
 * Screens split out of the entry bundle. The dashboard and transactions list
 * are what people open ten times a day, so they stay in the entry chunk;
 * everything else loads on first visit and is then precached by the worker.
 */
export const LoginPage = lazy(() =>
  import('../features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
)

export const AccountsPage = lazy(() =>
  import('../features/accounts/AccountsPage').then((m) => ({ default: m.AccountsPage })),
)

export const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
