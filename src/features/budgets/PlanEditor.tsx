import { useMemo, useState, type FormEvent } from 'react'

import { useUser } from '../../app/providers/useAuth'
import { cancelButton } from '../../components/buttonStyles'
import { OUT_OF_BUDGET_CATEGORY_ID, type Category } from '../categories/types'
import { savePlan, setCategoryArchived, type PlanEntry } from '../categories/useCategories'
import { BP_TOTAL, formatPercent, parsePercent } from './allocate'


type Draft = { name: string; icon: string; percent: string; daily: boolean }
type NewItem = { key: number; name: string; icon: string; percent: string }

let nextKey = 1

/**
 * Select the whole value when a share field gains focus, so a new figure
 * simply replaces the old one. iOS otherwise parks the caret at the start.
 * Deferred a tick: Safari on iOS undoes a synchronous select() on focus.
 */
function selectAllOnFocus(event: React.FocusEvent<HTMLInputElement>) {
  const input = event.currentTarget
  setTimeout(() => input.select(), 0)
}

/**
 * The list of things a month's money is for, each with its share. Shares are
 * kept on the expense categories themselves, so recording spending against an
 * item is simply choosing its category. Saved as one batch; the month can
 * only be funded once the shares total 100%.
 */
export function PlanEditor({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const user = useUser()
  const items = useMemo(
    () =>
      categories
        .filter((c) => c.kind === 'expense' && !c.archived && c.id !== OUT_OF_BUDGET_CATEGORY_ID)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  )
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      items.map((c) => [
        c.id,
        { name: c.name, icon: c.icon, percent: c.shareBp ? formatPercent(c.shareBp) : '', daily: !!c.daily },
      ]),
    ),
  )
  const [added, setAdded] = useState<NewItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const draftFor = (c: Category): Draft =>
    drafts[c.id] ?? { name: c.name, icon: c.icon, percent: '', daily: false }

  const parsed = useMemo(() => {
    let total = 0
    let invalid = false
    for (const c of items) {
      const p = (drafts[c.id]?.percent ?? '').trim()
      if (p === '') continue
      const bp = parsePercent(p)
      if (bp === null) invalid = true
      else total += bp
    }
    for (const n of added) {
      const p = n.percent.trim()
      if (p === '') continue
      const bp = parsePercent(p)
      if (bp === null) invalid = true
      else total += bp
    }
    return { total, invalid }
  }, [drafts, added, items])

  function setDaily(id: string) {
    setDrafts((d) => {
      const next: Record<string, Draft> = {}
      for (const c of items) {
        next[c.id] = { ...(d[c.id] ?? { name: c.name, icon: c.icon, percent: '', daily: false }), daily: c.id === id }
      }
      return next
    })
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (parsed.invalid) return setError('Every share must be a number between 0 and 100.')

    const entries: Record<string, PlanEntry> = {}
    for (const c of items) {
      const d = draftFor(c)
      const name = d.name.trim()
      if (!name) return setError('Every item needs a name.')
      entries[c.id] = {
        name,
        icon: d.icon.trim() || c.icon,
        shareBp: d.percent.trim() === '' ? 0 : (parsePercent(d.percent) ?? 0),
        daily: d.daily,
      }
    }
    const maxOrder = Math.max(0, ...categories.map((c) => c.sortOrder))
    const created = added
      .filter((n) => n.name.trim())
      .map((n, i) => ({
        name: n.name.trim(),
        icon: n.icon.trim() || '•',
        shareBp: n.percent.trim() === '' ? 0 : (parsePercent(n.percent) ?? 0),
        daily: false,
        sortOrder: maxOrder + 1 + i,
      }))

    savePlan(user.uid, entries, created).catch((cause: unknown) =>
      setError(cause instanceof Error ? cause.message : 'Could not save the plan.'),
    )
    onClose()
  }

  const totalOk = parsed.total === BP_TOTAL

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-edge bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">Monthly plan</h2>
        <p className={`text-sm font-semibold tabular ${totalOk ? 'text-positive-text' : 'text-fg-muted'}`}>
          {formatPercent(parsed.total)}% of 100%
        </p>
      </div>
      <p className="text-xs text-fg-subtle">
        Each item takes its share of what is earmarked for the month. Rename an item here and past spending follows
        it. Mark one as daily to see its balance per day.
      </p>

      <ul className="divide-y divide-edge">
        {items.map((c) => {
          const d = draftFor(c)
          return (
            <li key={c.id} className="grid grid-cols-[2.5rem_1fr_5.5rem_auto_auto] items-center gap-2 py-2">
              <span aria-hidden className="text-center text-lg">
                {c.icon}
              </span>
              <input
                type="text"
                required
                aria-label="Item name"
                value={d.name}
                onChange={(e) => setDrafts((all) => ({ ...all, [c.id]: { ...d, name: e.target.value } }))}
                className="min-w-0 w-full rounded-md border border-edge bg-bg px-2 py-1.5 text-sm text-fg"
              />
              <label className="block">
                <span className="sr-only">Share of {c.name}</span>
                <span className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    aria-label={`Share for ${c.name}, percent`}
                    value={d.percent}
                    onFocus={selectAllOnFocus}
                    onChange={(e) => setDrafts((all) => ({ ...all, [c.id]: { ...d, percent: e.target.value } }))}
                    className="w-full rounded-md border border-edge bg-bg px-2 py-1.5 text-right text-sm text-fg tabular"
                  />
                  <span className="text-xs text-fg-subtle">%</span>
                </span>
              </label>
              <label className="flex items-center gap-1 text-xs text-fg-muted" title="Show this item's balance per day">
                <input type="radio" name="daily" checked={d.daily} onChange={() => setDaily(c.id)} />
                daily
              </label>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Archive "${c.name}"? Past spending keeps its label; the item leaves the plan.`)) {
                    void setCategoryArchived(user.uid, c.id, true)
                  }
                }}
                aria-label={`Archive ${c.name}`}
                className="rounded p-1 text-xs text-fg-subtle hover:text-danger-text"
              >
                ✕
              </button>
            </li>
          )
        })}
        {added.map((n) => (
          <li key={n.key} className="grid grid-cols-[2.5rem_1fr_5.5rem_auto_auto] items-center gap-2 py-2">
            <input
              type="text"
              aria-label="Icon"
              placeholder="•"
              value={n.icon}
              onChange={(e) => setAdded((all) => all.map((x) => (x.key === n.key ? { ...x, icon: e.target.value } : x)))}
              className="w-full rounded-md border border-edge bg-bg px-2 py-1.5 text-center text-sm text-fg"
            />
            <input
              type="text"
              aria-label="Item name"
              placeholder="New item"
              autoFocus
              value={n.name}
              onChange={(e) => setAdded((all) => all.map((x) => (x.key === n.key ? { ...x, name: e.target.value } : x)))}
              className="w-full rounded-md border border-edge bg-bg px-2 py-1.5 text-sm text-fg"
            />
            <span className="flex items-center gap-1">
              <input
                type="text"
                inputMode="decimal"
                aria-label="Share, percent"
                placeholder="0"
                value={n.percent}
                onFocus={selectAllOnFocus}
                onChange={(e) =>
                  setAdded((all) => all.map((x) => (x.key === n.key ? { ...x, percent: e.target.value } : x)))
                }
                className="w-full rounded-md border border-edge bg-bg px-2 py-1.5 text-right text-sm text-fg tabular"
              />
              <span className="text-xs text-fg-subtle">%</span>
            </span>
            <span aria-hidden className="w-10" />
            <button
              type="button"
              onClick={() => setAdded((all) => all.filter((x) => x.key !== n.key))}
              aria-label="Remove new item"
              className="rounded p-1 text-xs text-fg-subtle hover:text-danger-text"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setAdded((all) => [...all, { key: nextKey++, name: '', icon: '', percent: '' }])}
        className="text-sm font-semibold text-accent-text hover:underline"
      >
        + Add an item
      </button>

      {!totalOk && !parsed.invalid && (
        <p className="text-xs text-fg-muted">
          Shares total {formatPercent(parsed.total)}%. You can save now, but a month can only be funded at exactly
          100%.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" className="flex-1 rounded-md bg-accent py-2.5 font-bold text-accent-fg">
          Save plan
        </button>
        <button type="button" onClick={onClose} className={cancelButton}>
          Cancel
        </button>
      </div>
    </form>
  )
}

