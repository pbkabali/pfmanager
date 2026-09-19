# pfmanager

Personal finances manager: record income and spending, see where the money
goes, and never wait for a connection to do either.

A mobile-first PWA that also earns its place on a laptop screen. Works fully
offline after the first sign-in: every transaction you record lands on the
device at once and syncs when there is signal.

## Stack

Same foundation as [racewire](../racewire), a sibling project, so the two stay
easy to maintain together. What differs is the data model: racewire is public
data scoped per event, pfmanager is private data scoped per person.

| Layer | Choice |
| --- | --- |
| App | React 19 + TypeScript, Vite 8 (SPA) |
| Styling | Tailwind CSS v4, semantic tokens over a swappable palette |
| Data | Firestore with persistent multi-tab offline cache |
| Auth | Firebase Auth: Google sign-in and email/password |
| PWA | vite-plugin-pwa (injectManifest), Workbox precache + SPA fallback |
| Hosting | Firebase Hosting |
| Lint | oxlint |

No Cloud Functions and no Storage yet, so a Firebase project on the free
**Spark plan is enough**. Both can be added later (see roadmap) and would then
need Blaze.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Firebase web app config
npm run setup:hooks          # refuse direct commits to main/staging
npm run dev                  # http://localhost:5411
```

The app throws a clear error on startup if the Firebase config is missing;
that is deliberate.

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Vite dev server on port 5411, service worker disabled |
| `npm run build` | Typecheck (`tsc -b`) then production build |
| `npm run preview` | Serve the production build locally, service worker enabled |
| `npm run lint` | oxlint |
| `npm run check:contrast` | WCAG audit of both themes. Run after any colour change |
| `npm run setup:hooks` | Point git at `.githooks/` |

## Layout

```
src/
  app/              router, route protection, auth + theme providers
  components/       shared UI, responsive app shell, Money renderer
  features/
    auth/           login (Google + email)
    profile/        users/{uid} document, first-run seeding, ProfileGate
    accounts/       cash, mobile money, bank... with derived balances
    budgets/        the monthly envelope: plan shares, funding, per-item balances
    categories/     income/expense categories, seeded defaults, plan shares
    transactions/   the ledger: types, live query hook, form, list
    dashboard/      this-month totals and top spending
    settings/       currency, theme, sign out
  lib/firebase/     config, app, auth, db (paths live here)
  lib/money.ts      integer minor-unit amounts, Intl formatting/parsing
  styles/           palette.css (edit to rebrand), theme.css (roles)
  sw.ts             service worker: precache + SPA navigation fallback
```

## Data model

Everything a person owns lives under `users/{uid}`:

```
users/{uid}                     profile: currency (default for new accounts),
                                displayName, schemaVersion
users/{uid}/accounts/{id}       name, type, currency, openingBalanceMinor, archived
users/{uid}/categories/{id}     name, kind (income|expense), icon, sortOrder,
                                shareBp? (plan share, 10000 = 100%), daily?
users/{uid}/transactions/{id}   type, amountMinor, currency, accountId,
                                accountAmountMinor?, toAccountId?, toAmountMinor?,
                                categoryId?, groupId?, date, note, createdAt,
                                updatedAt
users/{uid}/budgets/{YYYY-MM}   currency, fundedMinor, carriedMinor,
                                carriedByItem{}, sources[], shares{},
                                allocations{}, capPercent
```

**Why subcollections.** `firestore.rules` protects the lot with one check,
`request.auth.uid == uid`, and a query physically cannot return another
person's rows. A flat collection with an ownerId field relies on every query
and every rule remembering to filter.

**Why integer amounts.** `amountMinor` is an integer in the currency's minor
unit: cents for USD, whole shillings for UGX. Floats never touch the ledger.
The rules refuse a non-integer amount at the boundary. Conversion to and from
decimals happens in `src/lib/money.ts` and nowhere else.

**Why currency lives on the account.** A USD savings account and a UGX
mobile money wallet hold different things, so each account has one fixed
currency and every amount that touches it is in that currency. Totals are
shown per currency and never added across currencies; there is no reporting
currency and no exchange-rate table. A transfer between accounts of
different currencies records both sides (`amountMinor` out, `toAmountMinor`
in), which is exactly what the bank did. Every transaction also copies its
account's `currency` so a row renders correctly on its own.

**Why an expense has its own currency.** Spending is recorded in the currency
it was priced in, defaulting to the profile currency and changeable per
entry, because that is the figure a person remembers and budgets against. A
USD subscription paid from a UGX wallet is a USD expense with
`accountAmountMinor` holding what the wallet was actually debited; balances
use that, spending reports use the price. Incomes and transfers are always in
their account's currency since they have no separate price.

**Why a split income is several transactions.** A salary that lands partly
in a bank account and partly in mobile money is recorded once in the form
but stored as one income transaction per destination, each in its account's
currency, sharing a `groupId`. Balances, filters and per-currency totals then
need no special case, and the batch write means a person never sees half a
salary.

**The monthly envelope.** The workflow the app is built around: income
lands in accounts in whatever currency it arrives in; on the last day of the
month a lumpsum is earmarked for the next month from the accounts in the
profile currency, capped at a configurable percentage (`budgetCapPercent`,
default 50) of their combined balance; that lumpsum plus whatever last month
left unspent is split between the expense categories that carry a share
(`shareBp`, totalling 100%); each expense recorded against a category draws
down that item's balance, shown on the form as you record it; the item
flagged `daily` also shows its balance divided over the days left in the
month. Funding writes no transactions -- money stays where it is and the
budget document records what it is for. Shares are copied into the month's
document at funding time so editing the plan affects the next month only.
Carry-over is per item, taken at the moment the next month is funded: an
item's unspent balance is added on top of that same item's share
(`carriedByItem`); a leftover whose item has since left the plan has no home
and joins the pool, so it is split by the shares like new money. Expenses in another currency than the budget's cannot be
counted without a rate and are reported as such.

**Why balances are derived.** An account's balance is its opening balance plus
every movement, computed on the device. Storing a running balance would mean
two things to keep in sync on every write, and queued offline writes make
that genuinely hard to get right.

**First run.** `ProfileGate` listens to `users/{uid}`. On a server-confirmed
"does not exist" it seeds the profile, default categories and a Cash account
in one batch with fixed ids, so two tabs racing is harmless. It deliberately
does not seed on a cache miss: offline with an empty cache looks identical to
a new user, and seeding then would overwrite a real profile on reconnect. So
the first sign-in on a device needs a connection; every later open does not.

## How the main requirements are met

**Offline first.** Firestore runs with `persistentLocalCache` and a multi-tab
manager, so reads resolve from IndexedDB and writes queue locally. Mutations
are not awaited by the UI: the local write is instant and the listener fires
from cache, so a form can reset immediately. Firebase Auth restores the
session from IndexedDB, so the app opens signed-in with no network. The
service worker precaches the shell and serves it for every navigation, so
deep links open cold.

**Mobile and desktop.** One `AppShell`, two layouts: a fixed bottom tab bar on
phones (thumb reach, safe-area aware) and a left sidebar from `md` up so the
dashboard gets the full height for charts and tables. Both render the same
nav items, so a route cannot exist on one form factor and not the other.

**Money is legible.** Amounts use `font-variant-numeric: tabular-nums` so
columns line up. Income is `positive-text`, spending is `negative-text`.
These are distinct semantic roles from `accent` and `danger` even though they
share hues today, so a colour-blind-safe variant swaps only those two.

**Theme.** Light, dark and system, persisted under `pfmanager:theme` and
applied before first paint by the inline script in `index.html`.

### Rebranding

Edit **`src/styles/palette.css`** and nothing else, then run
`npm run check:contrast`. It mirrors the palette values (keep them in step)
and checks every role against the page *and* the card surface, in both
themes. The green fill and the red fill were both darkened during setup for
exactly the failures it exists to catch.

## Firebase setup & deployment

**→ Step-by-step: [docs/firebase-setup.md](docs/firebase-setup.md)**

Two projects (`pfmanager-stg`, `pfmanager-live`), with GitHub Actions
deploying on push:

| Event | Result |
| --- | --- |
| Any PR | Verify + Hosting-only preview URL, expires in 7 days |
| Push to `staging` | Verify + deploy hosting, rules and indexes to staging |
| Push to `main` | Verify + deploy to production |

```bash
npx firebase-tools deploy --only hosting,firestore:rules,firestore:indexes --project staging
```

The composite indexes in `firestore.indexes.json` back the account and
category filters in `useTransactions`; deploy them before using those filters
in production.

## Roadmap

- Charts: spending by category, month-over-month, cash-flow over time. The
  dashboard already computes the by-category data; choose a charting approach
  before adding a dependency.
- Recurring transactions (needs Cloud Functions, therefore Blaze).
- Edit a transaction in place; today it is delete and re-add.
- Receipt photos (needs Storage, therefore Blaze).
- Exchange rates and a reporting currency, if a single "net worth" figure is
  ever wanted. Today totals are per currency on purpose.
- Export to CSV.
- Test suite. None yet, same as racewire.

## Known gaps

- Not connected to a Firebase project yet; `.env.local` must be filled in.
- Untested against live Firebase. Everything typechecks, lints and builds.
