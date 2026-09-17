import type { ReactNode } from 'react'

/** Consistent page title row with an optional action slot on the right. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-fg md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-fg-subtle">{subtitle}</p>}
      </div>
      {action && <div className="flex-none">{action}</div>}
    </div>
  )
}
