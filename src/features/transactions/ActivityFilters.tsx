import type { Category } from '../categories/types'
import { TYPE_PRESETS, type ActivityQuery, type TypeFilter } from './filters'

/**
 * The search box and the two presets above the activity list.
 *
 * Both presets stay on screen rather than hiding behind a "Filters" button:
 * seeing "Spent" and the budget items is what reminds a person the list can
 * be narrowed at all.
 */
export function ActivityFilters({
  query,
  onChange,
  categories,
}: {
  query: ActivityQuery
  onChange: (next: ActivityQuery) => void
  categories: Category[]
}) {
  // Budget items first -- they are what people filter by -- then income
  // categories, then anything archived, which is kept so old spending on a
  // dropped item can still be found.
  const live = categories.filter((c) => !c.archived)
  const groups: { label: string; items: Category[] }[] = [
    { label: 'Budget items', items: live.filter((c) => c.kind === 'expense') },
    { label: 'Income', items: live.filter((c) => c.kind === 'income') },
    { label: 'Archived', items: categories.filter((c) => c.archived) },
  ]

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle">
          ⌕
        </span>
        <input
          type="search"
          value={query.text}
          onChange={(e) => onChange({ ...query, text: e.target.value })}
          placeholder="Search notes, categories, accounts, amounts"
          aria-label="Search activity"
          className="w-full rounded-md border border-edge bg-surface py-2.5 pr-3 pl-8 text-sm text-fg placeholder:text-fg-subtle"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Activity type" className="flex gap-1 rounded-md bg-surface-raised p-1">
          {TYPE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              aria-pressed={query.type === preset.value}
              onClick={() => onChange({ ...query, type: preset.value as TypeFilter })}
              className={
                query.type === preset.value
                  ? 'rounded px-3 py-1.5 text-xs font-bold text-accent-fg bg-accent'
                  : 'rounded px-3 py-1.5 text-xs font-semibold text-fg-muted hover:text-fg'
              }
            >
              {preset.label}
            </button>
          ))}
        </div>

        <select
          value={query.categoryId}
          onChange={(e) => onChange({ ...query, categoryId: e.target.value })}
          aria-label="Budget item"
          className="min-w-0 flex-1 rounded-md border border-edge bg-surface px-3 py-2 text-sm text-fg"
        >
          <option value="">Any budget item</option>
          {groups.map(
            (group) =>
              group.items.length > 0 && (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </optgroup>
              ),
          )}
        </select>
      </div>
    </div>
  )
}
