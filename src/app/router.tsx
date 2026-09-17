import { Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import { ErrorScreen } from '../components/ErrorScreen'
import { AppShell } from '../components/layout/AppShell'
import { Loading } from '../components/Loading'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { TransactionsPage } from '../features/transactions/TransactionsPage'
import { AccountsPage, LoginPage, SettingsPage } from './lazyPages'
import { ProtectedRoute } from './ProtectedRoute'

const lazy = (element: React.ReactNode) => (
  <Suspense fallback={<Loading />}>{element}</Suspense>
)

export const router = createBrowserRouter([
  {
    /*
     * Pathless, and rendering nothing itself: this route exists only to hang
     * the error screen above every other route, so a crash anywhere in the
     * tree lands on something a person can leave rather than react-router's
     * developer-facing default.
     */
    errorElement: <ErrorScreen />,
    children: [
      { path: '/login', element: lazy(<LoginPage />) },

      {
        element: <ProtectedRoute />,
        children: [
          {
            path: '/',
            element: <AppShell />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'transactions', element: <TransactionsPage /> },
              { path: 'accounts', element: lazy(<AccountsPage />) },
              { path: 'settings', element: lazy(<SettingsPage />) },
            ],
          },
        ],
      },

      {
        path: '*',
        element: (
          <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-bg px-6 text-center">
            <p className="text-3xl font-bold text-accent-text">404</p>
            <p className="text-sm text-fg-muted">That page does not exist.</p>
            <a href="/" className="mt-2 text-sm font-semibold text-accent-text underline">
              Back to the dashboard
            </a>
          </div>
        ),
      },
    ],
  },
])
