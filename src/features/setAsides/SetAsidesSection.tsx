import { useMemo, useState, type FormEvent } from 'react'

import { useUser } from '../../app/providers/useAuth'
import { sortCurrencies } from '../accounts/balances'
import { accountCurrency } from '../accounts/types'
import { useAccounts } from '../accounts/useAccounts'
import { useProfile } from '../profile/profileContext'
import type { SetAside } from '../profile/types'
import { formatShare, parseShare } from './rules'
import { newRuleId, saveSetAsides, type NewDestination } from './useSetAsides'

const field = 'mt-1 w-full rounded-md border border-edge bg-bg px-3 py-2 text-fg'
const label = 'text-xs font-semibold tracking-wide text-fg-muted uppercase'

/** Sentinel option value: make a dedicated account for this rule and currency. */
const CREATE = '__create__'

/**
 * Standing rules that take a share of every income into a dedicated account.
 * Off by default: with no rules the income form shows nothing extra.
 */
export function SetAsidesSection() {
  const user = useUser()
  const profile = useProfile()
  const rules = profile.setAsides ?? []
  const [editing, setEditing] = useState<SetAside | 'new' | null>(null)
  const { byId: accounts } = useAccounts()

  function remove(rule: SetAside) {
    if (!confirm(`Remove "${rule.name}"? Past transfers keep their label; the account stays.`)) return
    void saveSetAsides(
      user.uid,
      rules.filter((r) => r.id !== rule.id),
    )
  }

  function togglePaused(rule: SetAside) {
    void saveSetAsides(
      user.uid,
      rules.map((r) => (r.id === rule.id ? { ...r, paused: !r.paused } : r)),
    )
  }

  return (
    <section className="rounded-lg border border-edge bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className={label}>Set-asides</p>
        {editing === null && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="text-sm font-semibold text-accent-text hover:underline"
          >
            + Add a rule
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-fg-subtle">
        A share of every income moved to its own account the moment you record it. Tithe, support for family,
        anything promised before it is yours.
      </p>

      {rules.length > 0 && (
        <ul className="mt-3 divide-y divide-edge">
          {rules.map((rule) => (
            <li key={rule.id} className={`flex items-center gap-3 py-2 ${rule.paused ? 'opacity-60' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">
                  {rule.name} · {formatShare(rule.shareBp)}%{rule.paused && ' · paused'}
                </p>
                <p className="truncate text-xs text-fg-subtle">
                  {Object.entries(rule.accounts)
                    .map(([cur, id]) => `${cur} → ${accounts.get(id)?.name ?? '?'}`)
                    .join(' · ') || 'no destination set'}
                </p>
              </div>
              <button type="button" onClick={() => setEditing(rule)} className="text-xs font-semibold text-fg-muted hover:text-fg">
                Edit
              </button>
              <button type="button" onClick={() => togglePaused(rule)} className="text-xs font-semibold text-fg-muted hover:text-fg">
                {rule.paused ? 'Resume' : 'Pause'}
              </button>
              <button type="button" onClick={() => remove(rule)} aria-label={`Remove ${rule.name}`} className="text-xs text-fg-subtle hover:text-danger-text">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing !== null && (
        <RuleForm
          rule={editing === 'new' ? null : editing}
          existing={rules}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}

function RuleForm({ rule, existing, onClose }: { rule: SetAside | null; existing: SetAside[]; onClose: () => void }) {
  const user = useUser()
  const { currency: profileCurrency } = useProfile()
  const { active: accounts } = useAccounts()

  const currencies = useMemo(
    () => sortCurrencies([profileCurrency, ...accounts.map((a) => accountCurrency(a, profileCurrency))], profileCurrency),
    [accounts, profileCurrency],
  )

  const [name, setName] = useState(rule?.name ?? '')
  const [share, setShare] = useState(rule ? formatShare(rule.shareBp) : '')
  const [dest, setDest] = useState<Record<string, string>>(() => ({ ...(rule?.accounts ?? {}) }))
  const [error, setError] = useState<string | null>(null)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) return setError('Give the rule a name.')
    const shareBp = parseShare(share)
    if (shareBp === null) return setError('The share must be a percentage above 0 and up to 100.')

    const chosen: Record<string, string> = {}
    const create: NewDestination[] = []
    for (const [cur, id] of Object.entries(dest)) {
      if (!id) continue
      if (id === CREATE) create.push({ currency: cur, name: `${trimmed} (${cur})` })
      else chosen[cur] = id
    }
    if (Object.keys(chosen).length + create.length === 0) {
      return setError('Choose or create a destination account for at least one currency.')
    }

    const id = rule?.id ?? newRuleId()
    const next: SetAside = { id, name: trimmed, shareBp, accounts: chosen, ...(rule?.paused ? { paused: true } : {}) }
    const rules = rule ? existing.map((r) => (r.id === rule.id ? next : r)) : [...existing, next]

    saveSetAsides(user.uid, rules, create.length ? [{ ruleId: id, destinations: create }] : []).catch(
      (cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not save.'),
    )
    onClose()
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4 rounded-md border border-edge bg-bg/40 p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <label className="block">
          <span className={label}>Name</span>
          <input
            type="text"
            required
            autoFocus
            placeholder="e.g. Tithe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>Share</span>
          <span className="flex items-center gap-1">
            <input
              type="text"
              inputMode="decimal"
              required
              placeholder="10"
              value={share}
              onChange={(e) => setShare(e.target.value)}
              className={`${field} tabular text-right`}
            />
            <span className="mt-1 text-sm text-fg-muted">%</span>
          </span>
        </label>
      </div>

      <fieldset>
        <legend className={label}>Goes into</legend>
        <p className="mb-2 text-xs text-fg-subtle">One account per currency you receive money in. Leave a currency blank to skip it.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {currencies.map((cur) => {
            const options = accounts.filter((a) => accountCurrency(a, profileCurrency) === cur)
            return (
              <label key={cur} className="block">
                <span className="text-xs font-semibold text-fg-muted">{cur}</span>
                <select
                  value={dest[cur] ?? ''}
                  onChange={(e) => setDest((d) => ({ ...d, [cur]: e.target.value }))}
                  className={field}
                >
                  <option value="">— none —</option>
                  {options.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.committed ? ' · committed' : ''}
                    </option>
                  ))}
                  <option value={CREATE}>+ New "{name.trim() || 'Set-aside'} ({cur})" account</option>
                </select>
              </label>
            )
          })}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" className="flex-1 rounded-md bg-accent py-2.5 font-bold text-accent-fg">
          {rule ? 'Save rule' : 'Add rule'}
        </button>
        <button type="button" onClick={onClose} className="rounded-md border border-edge px-4 py-2.5 text-sm text-fg-muted">
          Cancel
        </button>
      </div>
    </form>
  )
}
