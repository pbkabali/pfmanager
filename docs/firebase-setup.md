# Firebase setup & deployment

Everything needed to take pfmanager from a fresh clone to a deployed app,
once per environment. Read [racewire's guide](../../racewire/docs/firebase-setup.md)
for the long-form reasoning; this one is the shorter, pfmanager-specific
version. Where the two differ, this one wins for pfmanager.

## Contents

1. [Before you start](#0-before-you-start)
2. [Create the two projects](#1-create-the-two-projects)
3. [Enable sign-in methods](#2-enable-sign-in-methods)
4. [Create the Firestore database](#3-create-the-firestore-database)
5. [Register the web app and collect config](#4-register-the-web-app-and-collect-config)
6. [Deploy rules and indexes by hand, once](#5-deploy-rules-and-indexes-by-hand-once)
7. [Deployer service account](#6-deployer-service-account)
8. [GitHub environments](#7-github-environments)
9. [Custom domain](#8-custom-domain-optional)
10. [Troubleshooting](#troubleshooting)

## 0. Before you start

**The free Spark plan is enough.** pfmanager uses Auth, Firestore and Hosting
only. Neither Cloud Functions nor Storage is provisioned, and those are the
two that need Blaze. If a roadmap item (recurring transactions, receipt
photos) is picked up later, upgrade then, and set a budget alert at the same
time.

You need: a Google account, the `gh` CLI signed in with admin rights on the
repo, and Node 22 or newer locally.

## 1. Create the two projects

Firebase console → Add project. Do this twice:

| Purpose | Project ID | Notes |
| --- | --- | --- |
| Staging | `pfmanager-stg` | What `staging` deploys to, and what `.env.local` points at |
| Production | `pfmanager-live` | What `main` deploys to |

Google Analytics: off. It adds a script to the bundle and nothing here uses it.

The IDs above are what `.firebaserc` expects. If a name is taken and you pick
another, change `.firebaserc` to match.

## 2. Enable sign-in methods

Console → Build → Authentication → Get started → Sign-in method.

Enable **Google** (pick a support email) and **Email/Password** (leave
"Email link" off). Do this in both projects.

Under **Settings → Authorized domains**, `localhost` and
`<project-id>.firebaseapp.com` are present already. Add any custom domain
here in step 8, or Google sign-in will fail on it with
`auth/unauthorized-domain`.

Under **Settings → User actions**, leave "Enable create" on: the login page
offers "Create an account" for email users.

## 3. Create the Firestore database

Console → Build → Firestore Database → Create database.

- Mode: **production** (locked). Our rules replace the defaults in step 5.
- Location: pick once, it cannot change. `europe-west1` or `europe-west3` are
  reasonable from East Africa; there is no African region.

Same location in both projects.

## 4. Register the web app and collect config

### 4a. Get the config

Console → gear → Project settings → General → Your apps → **Web** (`</>`).

- Nickname: `pfmanager web`
- Firebase Hosting: **tick it**. Saves a step later.

Copy the `firebaseConfig` object. Then, per project:

```bash
# staging: the file you use locally
cp .env.example .env.local

# production: a scratch file, gitignored, deleted after step 7
cp .env.example .env.production.local
```

### 4b. The mapping

| Console key | Env var |
| --- | --- |
| `apiKey` | `VITE_FIREBASE_API_KEY` |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` |
| `storageBucket` | `VITE_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `VITE_FIREBASE_APP_ID` |

No quotes, no spaces around `=`. These values are not secrets: they ship in
the bundle. Firestore rules are what protect the data.

### 4c. Check it worked

```bash
npm run dev
```

Open http://localhost:5411. You should see the login page. Sign in with
Google; the dashboard should appear with a Cash account and default
categories already there (that is `ProfileGate` seeding your profile). Record
a transaction, then switch off wifi and record another: both stay, and the
second shows "not yet synced" until you reconnect.

## 5. Deploy rules and indexes by hand, once

CI does this on every deploy, but the first time you want to see it work:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project staging
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project production
```

Indexes take a few minutes to build. Until they finish, a query that filters
by account or category will error; the unfiltered list works immediately.

## 6. Deployer service account

CI needs a key that can deploy Hosting and Firestore rules. Per project:

Google Cloud console → IAM & Admin → Service Accounts → Create.

- Name: `github-deployer`
- Roles: **Firebase Hosting Admin**, **Cloud Datastore Index Admin**,
  **Firebase Rules Admin**, **Service Usage Consumer**.

Keys tab → Add key → JSON. It downloads once. It is a real credential:
`.gitignore` already excludes `*deployer*.json`, but keep it out of the repo
folder anyway (e.g. `~/.secrets/`).

## 7. GitHub environments

Repo → Settings → Environments. Create `staging` and `production`. On
`production`, add yourself as a **required reviewer** so a push to `main`
waits for a click before it deploys.

Each environment needs the same set of variables plus one secret:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `FIREBASE_PROJECT_ID` | `pfmanager-stg` / `pfmanager-live` |
| Variable | `VITE_FIREBASE_*` (six of them) | from step 4 |
| Secret | `FIREBASE_SERVICE_ACCOUNT` | full contents of the deployer JSON |

The six variables are tedious to type. The script does it from the env files:

```bash
node scripts/sync-github-env.mjs staging    .env.local
node scripts/sync-github-env.mjs production .env.production.local
rm .env.production.local
```

It sets variables only; add `FIREBASE_SERVICE_ACCOUNT` and
`FIREBASE_PROJECT_ID` by hand.

Then:

```bash
npm run setup:hooks
git switch -c staging
git push -u origin staging
```

`staging` is a deploy branch: work goes on feature branches and is merged in.
The pre-commit hook refuses direct commits to `main` and `staging`.

## 8. Custom domain (optional)

Console → Hosting → Add custom domain. Add the records it gives you at your
registrar, wait for the certificate (up to a day; the site shows a warning
meanwhile, that is normal), then **add the domain under Authentication →
Settings → Authorized domains** or Google sign-in breaks on it.

## Troubleshooting

**"Missing Firebase config" on startup.** `.env.local` is missing or has a
blank value. The error lists which. Restart `npm run dev` after editing it;
Vite reads env files at startup.

**Google popup opens then closes, `auth/unauthorized-domain`.** The domain
you are on is not in Authorized domains (step 2).

**Login works but the dashboard says "Could not load your profile" with
`permission-denied`.** Rules not deployed yet, or deployed to the other
project. Step 5.

**"Connect once to get started" on a device that is online.** The device
thinks it is offline (`navigator.onLine` is a hint, not a fact). Reload with
a working connection.

**`failed-precondition ... requires an index`** in the console. Deploy
`firestore.indexes.json` (step 5) and wait for the build to finish.

**Service worker weirdness in dev.** There is none: the worker is disabled in
`npm run dev` on purpose. Test offline behaviour with `npm run build &&
npm run preview`, or against a deployed build.

**A stale deployed build after a deploy.** `sw.js` and `index.html` are served
`no-cache`, so a reload picks up the new worker, which then takes over at once
(`skipWaiting`). If a tab looks stale, reload it twice.
