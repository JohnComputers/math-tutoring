# Math Tutoring Website

A mobile-first tutoring website with real online scheduling and an admin dashboard that
lets you change essentially everything on the site without touching code.

Built as a static site (React + Vite + TypeScript) deployed to GitHub Pages, with Firebase
providing the database, authentication and file storage. There is no server to run or pay
for.

---

## Contents

1. [What this is](#1-what-this-is)
2. [Technologies](#2-technologies)
3. [Quick start](#3-quick-start)
4. [Firebase setup](#4-firebase-setup) — the one part you must do by hand
5. [Creating the first admin](#5-creating-the-first-admin)
6. [Running locally](#6-running-locally)
7. [Deploying to GitHub Pages](#7-deploying-to-github-pages)
8. [Using the admin dashboard](#8-using-the-admin-dashboard)
9. [How scheduling works](#9-how-scheduling-works)
10. [Security model and its limits](#10-security-model-and-its-limits)
11. [Testing](#11-testing)
12. [Project structure](#12-project-structure)
13. [Troubleshooting](#13-troubleshooting)
14. [Costs](#14-costs)

---

## 1. What this is

**For visitors:**

- A homepage covering who you are, what you tutor, why it helps, and what it costs
- Real online booking: pick a date, pick a time, enter details, done — about a minute on a phone
- Policy pages (privacy, terms, cancellation, guardian notice, accessibility)
- Works properly on an iPhone SE, and scales up from there

**For you:**

- A password-protected dashboard at `/#/admin`
- Edit every piece of text on the site, upload your photo, set your prices
- Set your weekly availability and block off individual dates
- See, cancel, reschedule and annotate every booking
- No code editing required for any normal business change

**What it deliberately does not do:** take payments, host student accounts, submit
homework, or run video calls. It schedules sessions and presents your business well. The
architecture leaves room to add more later.

---

## 2. Technologies

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 18 + Vite + TypeScript | Fast builds, static output, types catch scheduling bugs |
| Styling | Hand-written CSS with custom properties | No framework to ship; the whole site needs ~12 primitives |
| Icons | `lucide-react` | Tree-shaken — only the icons actually used get bundled |
| Routing | `react-router-dom` (HashRouter) | Survives a page refresh on GitHub Pages with no redirect hack |
| Database | Cloud Firestore | Transactions, which is what makes double-booking impossible |
| Auth | Firebase Authentication | Email/password for the admin |
| Files | Firebase Storage | Your profile photo |
| Hosting | GitHub Pages | Free, static, no server to maintain |
| CI/CD | GitHub Actions | Builds and deploys on every push |

Total on first load: about 229 kB gzipped, of which 125 kB is the Firebase SDK (in its own
chunk, so the marketing pages are not blocked on it). The admin dashboard is a separate
109 kB chunk that is lazy-loaded and never downloaded by visitors.

---

## 3. Quick start

```bash
npm install
cp .env.example .env      # then fill it in — see section 4
npm run dev
```

The site runs at `http://localhost:5173`. Without Firebase configured it shows the default
content with a "setup needed" banner, and booking is disabled — useful for seeing the
design before wiring anything up.

---

## 4. Firebase setup

This is the only part that cannot be scripted for you. It takes about ten minutes.

### 4.1 Create the project

1. Go to <https://console.firebase.google.com> and click **Add project**
2. Name it (e.g. `math-tutoring`)
3. Google Analytics is not used by this site — turn it off unless you want it

### 4.2 Create the Firestore database

1. In the left sidebar: **Build → Firestore Database → Create database**
2. Choose **Start in production mode** — the rules in this repo replace the defaults anyway,
   and test mode leaves the database world-writable for 30 days
3. Pick the location closest to your students. **This cannot be changed later.**

### 4.3 Enable Authentication

1. **Build → Authentication → Get started**
2. Enable the **Email/Password** provider
3. Leave "Email link (passwordless sign-in)" off

> Once your own admin account exists (section 5), consider turning sign-up off entirely:
> **Authentication → Settings → User actions → uncheck "Enable create (sign-up)"**. Nobody
> can become an admin by signing up regardless, but this removes the ability to create
> accounts at all.

### 4.4 Enable Storage

1. **Build → Storage → Get started**
2. Accept the default bucket, in the same region as Firestore

> Firebase Storage now asks for a billing account (Blaze plan) on new projects. Blaze is
> pay-as-you-go with a free tier that a tutoring site will not exceed — expect $0/month —
> but if you would rather not add a card, skip Storage. Everything works except the photo
> uploader; you can instead host your photo anywhere public and paste the URL into
> **Admin → Website Content**. See [section 14](#14-costs).

### 4.5 Get your configuration values

1. **Project settings** (the gear icon) **→ General**
2. Scroll to **Your apps** → click the web icon `</>`
3. Register the app (any nickname; do **not** tick Firebase Hosting)
4. Copy the values from the `firebaseConfig` object it shows you

Fill in `.env`:

```bash
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123
```

> **On these being "secret":** they are not. A Firebase web config is embedded in every
> client that talks to the project, and Google documents it as public information. Your
> data is protected by the security rules in the next step, not by hiding these values.
> They live in `.env` so the repository is not tied to one project, and so a fork does not
> write into your database.

### 4.6 Deploy the security rules — do not skip this

The rules are what actually protect your bookings. Until they are deployed, your database
is running on Firebase's defaults.

```bash
npx firebase login
npx firebase use --add          # pick your project, alias it "default"
npm run deploy:rules
```

That publishes `firestore.rules`, `firestore.indexes.json` and `storage.rules`.

To verify, open **Firestore → Rules** in the console — the last line should be
`allow read, write: if false;`, not `allow read, write: if true;`.

The composite indexes take a minute or two to build. Until they finish, the admin bookings
page may show an error; it resolves itself.

---

## 5. Creating the first admin

Admin access cannot be granted from inside the website — that is the point. If the
dashboard could promote an account, anyone who signed up could promote themselves.

Instead it is granted from your machine with a service-account key:

1. **Firebase console → Project settings → Service accounts → Generate new private key**
2. Save the downloaded file as `serviceAccountKey.json` in the project folder
   *(already gitignored — it grants full access to your project and bypasses every
   security rule, so treat it like a password)*
3. Run:

```bash
npm run setup:admin -- --email you@example.com --create
```

It will prompt for a password (minimum 12 characters — this account can read every
booking, including students' names and parents' phone numbers).

Other things it does:

```bash
npm run setup:admin -- --list                        # who are the admins?
npm run setup:admin -- --email new@example.com       # promote an existing account
npm run setup:admin -- --email old@example.com --revoke
```

Once you are done, **delete `serviceAccountKey.json`**. You only need it to add or remove
admins.

### Loading the default content

Sign in at `/#/admin` and press **Seed default content** on the Dashboard. It writes the
starter text, scheduling rules, policies and subjects into Firestore, and never overwrites
anything that already exists.

(There is also `npm run seed` if you prefer the command line — it needs the service-account
key.)

---

## 6. Running locally

```bash
npm run dev          # dev server at localhost:5173
npm run build        # typecheck + production build into dist/
npm run preview      # serve the built site locally
npm test             # unit tests (fast, no setup)
npm run test:rules   # security + concurrency tests (needs Java)
```

### Working against the emulator

To develop without touching live data — and against the real security rules, so a rules
mistake shows up locally instead of in production:

```bash
npm run emulators                              # in one terminal
# add VITE_USE_FIREBASE_EMULATOR=true to .env
npm run dev                                    # in another
```

---

## 7. Deploying to GitHub Pages

### 7.1 Push the code

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

`.gitignore` already excludes `.env` and `serviceAccountKey.json`. Check `git status` before
your first commit and confirm neither appears.

### 7.2 Add the build secrets

**Repository → Settings → Secrets and variables → Actions → New repository secret.**

Add each of the six, with the same names as in `.env`:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Without them the site still deploys — it just shows the setup screen instead of taking
bookings, and the workflow log says so.

### 7.3 Turn on Pages

**Repository → Settings → Pages → Source: GitHub Actions.**

Push, and the workflow builds and deploys. Your site appears at
`https://YOUR-USERNAME.github.io/YOUR-REPO/`.

The base path is worked out automatically:

| Setup | Base path |
| --- | --- |
| Project site (`github.io/my-repo`) | `/my-repo/` |
| User site (repo named `username.github.io`) | `/` |
| Custom domain (a `public/CNAME` file exists) | `/` |

### 7.4 Authorise your domain in Firebase

**Firebase console → Authentication → Settings → Authorised domains → Add domain**, and add
`YOUR-USERNAME.github.io`. Without this, admin sign-in fails on the live site while working
fine locally.

### 7.5 About the URLs

The site uses hash routing, so links look like:

```
https://yourname.github.io/math-tutoring/#/schedule
```

That is deliberate. GitHub Pages serves static files with no server-side rewriting, so with
clean URLs a refresh on `/schedule` asks GitHub for a file that does not exist and returns
its 404 page. The hash is never sent to the server, so `#/schedule` survives a refresh
unconditionally. (`public/404.html` also catches anyone who types a non-hash path and
forwards them to the right place.)

### Custom domain

1. Create `public/CNAME` containing just your domain, e.g. `tutoring.example.com`
2. Point a CNAME record at `YOUR-USERNAME.github.io` with your DNS provider
3. **Settings → Pages → Custom domain**, and tick **Enforce HTTPS**
4. Add the domain to Firebase's authorised domains (see 7.4)

---

## 8. Using the admin dashboard

Sign in at `https://your-site/#/admin`. There is a discreet "Site admin" link in the footer.

| Section | What you change there |
| --- | --- |
| **Dashboard** | Today's and upcoming sessions; first-time content seeding |
| **Bookings** | Every booking. Filter, search, cancel, reschedule, mark completed or no-show, add private notes |
| **Availability** | Your weekly hours, session rules, and one-off date exceptions |
| **Website Content** | All homepage text, your photo, prices, contact details, SEO |
| **Subjects** | Add, edit, reorder, hide or delete subject cards |
| **Testimonials** | Optional. The section stays hidden until one is visible |
| **Settings** | Timezone, booking options, brand colours, maintenance |
| **Legal** | All five policy documents, with a live preview |

The dashboard is built to be used from a phone — checking tomorrow's sessions or blocking a
date while away from a computer is the common case.

### Changing your availability

**Availability** has three parts:

1. **Weekly schedule** — your normal week. Toggle days on and off; add more than one time
   block per day if you have a gap in the middle.
2. **Session rules** — how those hours become bookable slots (length, buffer, minimum
   notice, how far ahead people can book).
3. **Date exceptions** — one-off overrides:
   - *Closed all day* — a holiday or a competition
   - *Different hours than usual* — replaces that day's normal hours
   - *Extra hours on top of usual* — opens a normally-closed day

The **preview** panel shows exactly what slots the current settings produce for the next
seven days, before you save. Availability rules are hard to predict in your head; this
removes the guessing.

### Cancelling and rescheduling

Both are on each booking's **View & manage** dialog.

**Nobody is notified automatically.** The site takes bookings; it does not send email or
SMS. When you cancel or move a session, text the parent — their number is one tap away in
the booking.

Cancelling releases the time for someone else to book. Rescheduling runs the same conflict
checks a public booking does, so you cannot double-book yourself either — but it ignores
your own notice period and advance window, since those are rules for the public, not for
you.

---

## 9. How scheduling works

Worth understanding, because it is the part where "roughly right" is not good enough.

### Slots

Given your weekly hours, any date exceptions, the session length, and the buffer, the app
generates candidate start times and then filters them:

1. Does the session fit inside an open period?
2. Does it meet the minimum notice?
3. Is the date inside the booking window, and are same-day bookings allowed?
4. Does it clash with an existing booking, buffer included?

Slots that fail are still shown, greyed out and labelled ("Booked", "Too soon"). A calendar
that silently drops taken times looks broken; one that shows them struck through reads as a
real schedule.

### Buffers

A booking reserves its own time **plus the buffer after it**. With a 15-minute buffer, a
6:00–7:00 session blocks 7:00 as a start time — the next session can begin at 7:15.

The buffer is applied on one side only, deliberately: reserving it on both sides would
force a 30-minute gap between consecutive sessions, since each booking would claim the same
gap independently. The effect is still symmetric — a session *ending* at 6:00 is also
blocked when another starts at 6:00.

### Why double-booking cannot happen

Two bookings clash when their intervals **overlap**, not when they share a start time. A
90-minute session at 6:00 and a 30-minute session at 7:00 have different starts and still
cannot both happen. Comparing start times — the obvious implementation — would happily
double-book them.

So instead of reserving "the 6pm slot", a booking reserves every 5-minute *grain* of the
timeline it touches, buffer included. Two bookings conflict exactly when their grain sets
intersect. That is correct for any combination of durations, and — crucially — it turns the
conflict check into a set of document IDs, which is something a database can make atomic.

Creating a booking is a Firestore transaction that:

1. reads every grain the session needs,
2. aborts if any already exists,
3. otherwise writes the booking and all its grains **together**.

Firestore transactions are optimistic: if another client writes any document the
transaction read, the commit fails and it retries with fresh reads. The gap between "check"
and "write" — the window every naive implementation leaves open — does not exist.

There are three layers, and only the first is decorative:

| Layer | What it does | Trustworthy? |
| --- | --- | --- |
| Slot filtering in the browser | Stops people clicking a doomed button | No — cosmetic only |
| The Firestore transaction | Makes the check-and-write atomic | Yes |
| Security rules | Grains allow `create` but never `update` or `delete` from the public | Yes — server-enforced |

That third layer is the one that survives a hostile client. In Firestore, writing over an
existing document is an *update*, so even a client that skipped the transaction entirely
and issued a raw write would be rejected by the server.

This is verified, not asserted: `npm run test:rules` fires eight genuinely simultaneous
bookings at one slot and checks that exactly one succeeds and seven get a clean "that time
was just booked" error.

### Timezones

All times are shown in the timezone you set in **Settings** (default `America/New_York`),
regardless of where the visitor is.

Daylight saving is handled properly through the browser's own timezone database — never a
fixed offset, which would silently shift every booking by an hour twice a year. Times that
do not exist (the hour skipped each spring) are not offered rather than quietly moved.

---

## 10. Security model and its limits

### What is protected

- **Bookings cannot be read by anyone but you.** Not by the public, not by a signed-in
  stranger. Names and phone numbers are not reachable from a browser console.
- **Nobody can promote themselves to admin.** The `admins` collection is not client-writable
  at all — only the Admin SDK, with a service-account key on your machine, can add to it.
- **Site content, subjects, availability and policies are read-only to the public.**
- **Reservations cannot be overwritten or deleted by the public**, so a slot cannot be
  stolen or double-booked.
- **Bookings are validated server-side** — field types, lengths, a status the client does
  not get to choose, a duration that must match the interval, and no bookings in the past.
- **Uploads must be images** under 10 MB, from an admin account.
- **Everything not explicitly allowed is denied** by a catch-all rule at the bottom.

All of the above is covered by tests that run against the real Firestore emulator — 38
security-rule tests and 17 concurrency tests. See [section 11](#11-testing).

### The honest limitation

Firestore rules can validate a booking's **shape**, but they cannot run your availability
algorithm. They cannot tell that 3 AM on a Tuesday is outside your hours.

So a determined person crafting API calls directly could create a structurally valid booking
at an odd time. They **cannot** double-book, cannot read anyone's data, and cannot change
your site. The booking simply appears in your dashboard, where you cancel it.

Closing that last gap requires server-side code — a Cloud Function that validates against
your availability before writing. That needs the Blaze plan and a small backend, which is
outside what a static GitHub Pages site is. For a personal tutoring business the trade is
reasonable: the realistic failure mode is a nuisance booking, not a data breach.

If you later want it closed, the shape of the change is: move `createBooking` into a
callable Cloud Function, and change the `bookings` rule to `allow create: if false` so only
the function can write them.

### Student data

The booking form collects a parent name, student name, and phone number — plus optional
email, subject and notes. That is the minimum needed to schedule and confirm a session.

- Student names are never published on the site and never used in testimonials
- The form tells parents a first name or nickname is fine
- The notes field warns against medical, financial or other sensitive information
- No payment details are collected anywhere
- No analytics or advertising trackers are loaded

The testimonials editor carries a prominent warning against publishing student names,
because the Privacy Policy promises exactly that.

---

## 11. Testing

```bash
npm test             # 74 unit tests — pure logic, instant, no setup
npm run test:rules   # 55 tests against the Firestore emulator (needs Java 11+)
npm run test:all     # both
```

**Unit tests** cover the parts where a subtle bug is expensive and invisible: timezone
conversion across DST boundaries, interval overlap, buffer arithmetic, availability
exception precedence, and form validation.

**Emulator tests** are the ones that matter most, because they test the server rather than
the app:

- *Security rules (38)* — every permission boundary, from both an anonymous and a
  signed-in-but-not-admin perspective. Including: the public cannot read bookings, cannot
  overwrite a reservation, and cannot make themselves an admin.
- *Concurrency (17)* — real transactions against the real rules. Eight simultaneous
  bookings for one slot produce exactly one success. Overlapping durations conflict.
  Buffers are respected. Cancelling frees the time. A booking cannot release a reservation
  it does not own.

Run `npm run test:rules` after any change to `firestore.rules`. It is the difference between
believing your rules are right and knowing.

If the emulator complains that a port is taken, `npm run emulators:free` clears stale
processes (this happens on Windows, where the emulator's Java child sometimes outlives the
CLI).

---

## 12. Project structure

```
src/
├── types/              All Firestore data shapes in one file
├── firebase/
│   ├── config.ts       SDK initialisation, emulator wiring
│   └── auth.ts         Sign-in and the separate admin authorisation check
├── services/           Every Firestore operation. No UI code touches the SDK directly.
│   ├── bookings.ts     The atomic booking transaction
│   ├── settings.ts     The three settings documents
│   ├── subjects.ts     ·  testimonials.ts  ·  availability.ts  ·  storage.ts
│   └── defaults.ts     Seed content — the starting point, not the source of truth
├── utils/
│   ├── time.ts         Timezone-aware conversion. DST-correct, zero dependencies.
│   ├── slots.ts        The availability algorithm and grain scheme
│   ├── validation.ts   Form validation, mirrored by firestore.rules
│   └── errors.ts       Firebase errors → sentences a parent can act on
├── hooks/              Content loading, auth, motion, document meta
├── components/
│   ├── layout/         Header, footer, page shell
│   ├── sections/       The homepage sections
│   ├── booking/        Calendar, time slots, form, confirmation
│   └── ui/             Buttons, fields, modal, icons, math background
├── pages/              Home, schedule, legal, 404
├── admin/              The dashboard — lazy-loaded, never sent to visitors
└── styles/             Design tokens and shared CSS

firestore.rules         Server-side authorisation. Read this before changing anything.
storage.rules
scripts/setup-admin.mjs Grants admin access. Needs a service-account key.
```

The rule the structure enforces: **UI components never import the Firebase SDK.** They call
a function in `services/`. That keeps data access testable and means a schema change has one
place to happen.

---

## 13. Troubleshooting

**"Firebase is not configured" on the live site**
The GitHub Actions secrets are missing or misnamed. Check
**Settings → Secrets and variables → Actions**; names must match `.env` exactly. Re-run the
workflow after adding them — secrets are read at build time.

**Admin sign-in works locally but not on the deployed site**
Add your Pages domain to **Firebase → Authentication → Settings → Authorised domains**
(section 7.4).

**"You do not have permission to do that" after signing in**
The account exists but is not on the admin list. The screen shows your account ID; run
`npm run setup:admin -- --email you@example.com`.

**The bookings page shows an error on a new project**
The composite indexes are still building. Wait a minute and refresh. If it persists, check
**Firestore → Indexes**, or re-run `npm run deploy:rules`.

**Photo upload fails with a permission error**
Storage checks a custom auth claim, which lives in your login token and refreshes at most
hourly. Sign out and back in. If it still fails, confirm Storage is enabled and
`npm run deploy:rules` has been run.

**No time slots appear on any date**
Check **Availability**: the weekday may be switched off, weekends may be disabled in
**Settings**, or the minimum notice may exceed the window. The preview panel on the
Availability page shows what your current settings actually produce.

**A slot shows as booked but there is no booking**
Rare, but possible if a browser is closed mid-commit. **Settings → Release orphaned slots**
finds and clears reservations with no live booking attached.

**"Port taken" when running the emulator tests**
`npm run emulators:free`.

**A booking exists at an impossible time**
Cancel it. See [section 10](#10-security-model-and-its-limits) for why this is possible and
what closing it would take.

---

## 14. Costs

Expect **$0/month**.

GitHub Pages is free for public repositories. Firebase's free (Spark) tier includes 50,000
Firestore reads and 20,000 writes per day; this site uses about 5 reads per visitor and 20
writes per booking. A hundred visitors a day is roughly 1% of the free allowance.

The one caveat: **Firebase Storage now requires the Blaze (pay-as-you-go) plan** on new
projects. Blaze still includes the free tier and only charges beyond it — a single profile
photo will not come close — but it does require a card on file. If you would rather not,
skip Storage entirely: everything works except the photo uploader, and you can host your
photo anywhere public and paste the URL into **Admin → Website Content**.

Set a budget alert either way: **Firebase console → Usage and billing → Details & settings**.

---

## A note on the policy pages

The five policy documents are **useful starting templates, not legal advice**. They are
written to cover what a small tutoring service collecting parent and student details would
normally disclose, and they deliberately avoid naming specific laws or claiming compliance
with them, because a static site cannot guarantee that.

Read them through, edit them to match how you actually operate — especially the cancellation
policy — and if anything about your situation is unusual (you work with schools, take
payments online, or serve students outside the US), have a qualified lawyer review them
before relying on them.

The same note appears in the admin Legal editor, where you will actually be reading it.
