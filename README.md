# Workforce Time Tracker & Payroll

A full-stack workforce management application: live time tracking, attendance and
compliance, leave management, timesheet approval, and month-end payroll with payslips.

The React client is a real application, not a prototype. Every write goes to MongoDB
through an Express API; there is no `localStorage` persistence and no demo dataset in
the default install.

- **Client** — React 18 + TypeScript + Vite + Tailwind
- **API** — Express + Mongoose, JWT session in an httpOnly cookie
- **Database** — MongoDB (local or Atlas)
- **Shared domain** — pure business rules imported by both client and server

---

## What it does

**Management portal**

- Dashboard with live team status, attendance and payroll state
- Live tracker: who is working, paused or offline, with session detail
- Attendance calendar, daily breakdowns and shortfall review workflow
- Working-hour compliance in **daily, weekly and monthly** views, per team, employee,
  project and status, with the shortfall review workflow behind it
- Timesheet review (approve / request changes)
- Employees, teams, projects and tasks
- Every project is open to every employee: any employee can see the whole project list and
  record time on any project, whether or not they are assigned to it. Only an **archived**
  project is closed for new time entries — its history stays readable
- **Project statistics**: open any project and the *Stats* tab shows who worked on it and
  for how long, which task took the most time, how the hours are spread over the weeks and
  the busiest days — with a period filter (all time / last 30 / last 90 / this month)
- Leave requests, leave calendar and leave policy settings
- Holiday calendar with year copy and publish
- Payroll: calculate → approve → confirm salary credit → generate payslips → release
- Salary structures, payslip revisions and single-payslip release
- Reports, notifications, audit log, company and policy settings

**Employee portal**

- Dashboard with today's target and progress
- Time tracker: start / pause / resume / end, switch tasks, flag a session
- Starting a timer asks for the project, then whether the task is **new** or **existing**
  (an existing task can be picked by name or by type), then the description
- Employees can create **Learning** tasks in the shared learning project and share them
  with everyone
- Work logs, weekly timesheets and submission history
- My projects and assigned tasks — the employee sees every project of the company, and the
  timer dropdown lists all of them
- Attendance with day breakdowns and correction requests
- Leave balance, apply for leave and request history
- Payslips (released only), notifications, profile

Access is role-based. Payroll screens and payroll commands additionally require the
`canManagePayroll` flag, so an engineering manager cannot see salaries.

### Sessions, portals and access

Each account lives in exactly one portal. The client enforces that, and it enforces it
without dead ends:

- A signed-in account that opens a URL belonging to the **other** portal is taken back to
  its own dashboard with a short explanation, instead of an "Access denied" page. This
  covers stale links, bookmarks and the browser back button, which is the usual way a
  wrong-portal URL is reached.
- `/access-denied` is reserved for a genuine permission boundary: a management account
  without `canManagePayroll` opening a payroll screen. It names the section that was
  refused and links back to the dashboard and to the attendance board.
- After signing in, a deep link is only followed when it belongs to the portal of the
  account that just signed in, so a link left behind by another account cannot drop the
  user on a page their role cannot open.
- A rejected session (`401`) sends the account to **Session expired → Sign in again**
  instead of leaving it on a "your data could not be loaded" card that never recovers.
  A gateway error (`502`/`503`/`504`) keeps the page and offers a retry, because the
  session is still valid.

---

## Prerequisites

- **Node.js 18.18+**
- **MongoDB 6+** — a local server on `mongodb://127.0.0.1:27017` or an Atlas cluster

The API will not start without a reachable MongoDB.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env

# 3. Seed the database (master data + accounts, no activity history)
npm run seed

# 4. Run the API and the Vite dev server together
npm run dev
```

- Client: <http://localhost:5173>
- API: <http://localhost:4000> (`GET /api/health`)

The Vite dev server proxies `/api` to the API, so the browser talks to a single origin.

### A note about PowerShell

`cp` is an alias for `Copy-Item` and works; `&&` does not. Use `;` between commands, or
run one command per line.

---

## Seeding

`server/seed.ts` is the only thing that writes sample content, and it is explicit:

| Command | Result |
| --- | --- |
| `npm run seed` | Wipes the database and writes a **blank installation**: company/leave settings plus the two management logins. No employees, teams, projects, tasks, holidays, salary structures, or any activity. |
| `npm run seed -- --demo` | Writes the sample organisation (8 employees, 3 teams, 5 projects, 16 tasks, 14 holidays, 8 salary structures, plus their logins) and a synthetic activity history (work sessions, timesheets, leave requests, two released payroll months, payslips, notifications, audit trail). |
| `npm run db:reset` | Removes every document from the domain collections, including accounts. |

Re-running either seed command **destroys all existing data**. It is a development and
first-install tool, never something you run against a live database.

A fresh install is genuinely empty. You build the organisation yourself, in this order:

1. **Teams** — an employee must belong to a team.
2. **Employees** — saving an employee also creates their sign-in account. A temporary
   password is generated and shown **once** in a copyable dialog; the employee must change
   it at first sign-in. Deactivating the employee disables that account. If the password is
   lost, open the employee's profile and choose **Reset password** to issue a new one.
3. **Projects** and **tasks**, then **salary structures**.
4. **Settings → leave policy** (leave treatment is required before payroll can approve).

Use `--demo` when you want populated dashboards for a walkthrough or screenshots.

### Working week

The company works **Monday–Friday plus the 1st and 3rd Saturday** of every month; the 2nd,
4th and 5th Saturdays are non-working days. This is a company-wide policy, configured under
**Settings → Working hours → Working Saturdays**.

The same rule is used everywhere it matters — attendance and shortfall detection, leave-day
counting and payroll scheduled days — so a working Saturday counts as a full day and an off
Saturday never creates a shortfall. Saturdays are not selected per employee.

### The end of the working day

A day ends at **23:59** by default, so a session that runs late still counts towards the
day's target. The time is configurable under **Settings → Working hours → Day end time**,
and the 8-hour daily target is enforced when the day closes, not by an early cutoff.

### Picking a date

Every date is entered through the app's own date picker (calendar, typed value and
keyboard entry). Native browser date fields are not used, so the accepted format and the
calendar behave the same in every browser.

### Picking something from a list

Every dropdown in the app is the same custom listbox (`src/components/ui/Dropdown.tsx`).
Native `<select>` elements are not used anywhere: their arrow, their option list and their
keyboard behaviour differ per browser, and they cannot be styled into the app.

The listbox works the same everywhere:

- a button shows the current choice, the list floats above the page and is never clipped by
  a scroll container
- **search** appears as soon as a list has 8 entries or more
- full keyboard support: `↑`/`↓` move, `Home`/`End` jump, `Enter` picks, `Esc` closes and
  returns to the field, `Tab` leaves
- `role="combobox"` / `listbox` / `option` with `aria-selected`, so screen readers announce
  the same way as a native control

Callers still write ordinary `<option>` children, so a form reads like plain markup:

```tsx
<Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
  <option value="">All teams</option>
  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
</Select>
```

### Which projects an employee can record time on

**All of them.** The project list is not a membership list: every employee sees every
project of the company and can start a timer on it — assigned or not, and whatever the
project status (*Planned*, *Active*, *On Hold*, *Completed*). Only an **archived**
project is closed for new time entries; its history stays readable.

The rule lives in `shared/domain/access.ts` (`canTrackProject`) and both sides use it:
the client fills the timer dropdown with it, and the server applies the same function
when it receives `timer.start`, so the dropdown can never offer something the server
would reject. The teams and employees assigned to a project record *who is working on
it* — they never hide the project from the rest of the company.

### Project statistics

Open a project in the management portal and the **Stats** tab answers the two questions
that a project list cannot: *who worked on it* and *where did the time go*.

- **Headline numbers** — total time logged, how many people contributed, how many tasks
  carry time and the average (and longest) session
- **Who worked on this project** — every person who recorded time, with their sessions,
  total time, average and longest session, the period they were active and their share of
  the total
- **Where the time went** — the project's tasks ranked by logged time, so the task that
  swallowed the most hours is the first row (badged *Longest task*)
- **Hours per week** and **Busiest days** — how the time was spread
- A **period filter** narrows everything to all time, the last 30 days, the last 90 days or
  the current month

The numbers are computed by `shared/domain/projectStats.ts`, a pure function over the app
state — the same figures for the screen, the reports and any future export.

---

## Default accounts

A clean install has exactly two logins, both management:

| Account | Email | Password | Notes |
| --- | --- | --- | --- |
| Administrator | `admin@codeneptune.in` | `Admin@12345` | Full access incl. payroll; password already final |
| Management (company inbox) | `info@codeneptune.com` | `CodeNeptune` | Full access incl. payroll; password already final |

`npm run seed -- --demo` additionally creates the sample staff logins — HR & Payroll
Manager (`neha.kapoor@…`), Engineering Manager (`arjun.mehta@…`), and one employee
account per sample person (`priya.sharma@…`, `rahul.verma@…`, `ananya.iyer@…`,
`karthik.reddy@…`, `sneha.nair@…`, `vikram.singh@…`, `meera.pillai@…`) — all on
`Welcome@123` and flagged `mustChangePassword`.

Every account except the administrator and the management inbox is flagged
`mustChangePassword`, so the first sign-in routes to a change-password screen before any
other page is reachable. The administrator and management passwords come from
`SEED_ADMIN_PASSWORD` / `SEED_MANAGER_PASSWORD` and are not forced to change.

Employee accounts created in the app are **not** given a shared default password: each one
gets a random, policy-compliant temporary password that management sees once. Change
`SEED_ADMIN_PASSWORD` and `SEED_MANAGER_PASSWORD` in `.env` **before** the first seed if the
install is shared with anyone; `SEED_DEFAULT_PASSWORD` only affects `--demo` accounts.

---

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | API (`tsx watch`) + Vite dev server, run together |
| `npm run dev:api` | API only, on `PORT` (default 4000) |
| `npm run dev:web` | Vite only, on 5173 |
| `npm run build` | Typecheck, then build the client to `dist/client` |
| `npm start` | Run the API in production mode, serving `dist/client` |
| `npm run typecheck` | `tsc --noEmit` across client, server and shared code |
| `npm run lint` | ESLint |
| `npm run seed` | Clean seed (master data + accounts) |
| `npm run seed -- --demo` | Seed with synthetic activity history |
| `npm run db:reset` | Remove all documents from the domain collections |
| `npm run preview` | Vite preview of a build |

### Production

```bash
npm run build
NODE_ENV=production npm start
```

With `SERVE_CLIENT=true` (the default) the API serves the built client, so one process
and one origin serve the whole app. In production you must set a real `JWT_SECRET` of at
least 32 characters — the server refuses to boot without it.

In production the session cookie is marked `Secure`, so the app must be served over
**HTTPS** (put nginx, Caddy or a load balancer in front of it and set
`app.set('trust proxy', 1)` behaviour accordingly — the server already trusts one proxy
hop). Signing in over plain HTTP in production will appear to succeed and then bounce
straight back to the login screen.

---

## Environment variables

Copy `.env.example` to `.env`. Every value has a development default, so only
`MONGODB_URI` is truly required in practice.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/workforce` | MongoDB connection string (SRV string for Atlas) |
| `JWT_SECRET` | dev-only secret | Signs the session cookie. Must be ≥32 chars in production |
| `SESSION_HOURS` | `8` | Session lifetime in hours |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |
| `PORT` | `4000` | API port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed browser origin(s) for CORS and reset links. Comma-separated list; the API's own origin is always allowed |
| `SERVE_CLIENT` | `true` | Serve `dist/client` from the API server |
| `SEED_ADMIN_EMAIL` | `admin@codeneptune.in` | Administrator email created by the seed |
| `SEED_ADMIN_PASSWORD` | `Admin@12345` | Administrator password created by the seed |
| `SEED_MANAGER_EMAIL` | `info@codeneptune.com` | Second management login created by the seed |
| `SEED_MANAGER_PASSWORD` | `CodeNeptune` | Password for that management login |
| `SEED_DEFAULT_PASSWORD` | `Welcome@123` | Password for the sample staff accounts created by `--demo`; new employee accounts get generated passwords |
| `RESET_TOKEN_TTL_MINUTES` | `30` | Password-reset link lifetime |

`API_ORIGIN` can also be set for the Vite dev server to proxy `/api` somewhere other than
`http://localhost:4000`.

### Password reset

No mail provider is wired up. `POST /api/auth/forgot-password` writes the reset link to
the **server log** (`[password-reset] …`). Outside production the token is also returned
in the response so the flow can be tested end to end. The endpoint answers identically
for unknown addresses so it cannot be used to enumerate accounts.

---

## Architecture

```
shared/   Pure domain logic — no React, no Express, no Mongoose.
          Types, permissions, compliance maths, payroll maths, leave rules,
          the command registry, and the seed fixtures.

server/   Express API + Mongoose models.
          Auth, command execution, MongoDB persistence, seeding, static client.

src/      React client.
          Pages, contexts, components. Calls the API; never decides a rule itself.
```

### The server is authoritative

The client never writes state directly. Every mutation is a command:

```json
POST /api/state/mutate
{ "op": "timer.start", "args": { "input": { "projectId": "p1", "taskId": "t4" } } }
```

The server looks the operation up in `shared/domain/commands.ts`, checks the caller's
scope (`employee`, `management` or `payroll`), runs the pure handler against the current
state, persists the diff to MongoDB, and returns the new state **projected for that
user** (`projectState`). An employee's state payload only contains their own sessions,
leaves, timesheets, payslips and notifications — not a filtered view of everyone's data.

Mutations are serialised through a promise queue, so two concurrent requests cannot both
read the same snapshot and have the second silently overwrite the first.

### Persistence

One Mongoose collection per aggregate (`worksessions`, `timesheets`, `leaves`,
`salarystructures`, `payslips`, …), with the domain id stored as `_id`. An in-memory
`AppState` is rebuilt on boot and used as a read cache; writes are diffed and applied
with `bulkWrite`. This keeps the whole app consistent on one server process and makes
cross-record rules (compliance, payroll, leave balances) straightforward.

If you scale to multiple API processes, each one keeps its own cache — run a single API
instance, or replace the cache with per-request reads, before scaling out.

### Authentication

- bcrypt password hashes, never plaintext
- JWT session in an httpOnly, same-site cookie — **no tokens in `localStorage`**
- `must_change_password` is enforced server-side (403 on `/api/state`,
  `/api/state/mutate` and `/api/accounts`), not just in the UI
- Rate limiting on login, forgot-password and reset-password
- All `/api` responses are `Cache-Control: no-store` and `Vary: Cookie`, so a signed-out
  401 can never be replayed after sign-in

### Keeping state fresh

The client loads state after sign-in and polls every 15 seconds, pausing while the tab is
hidden and refreshing on `visibilitychange`. Polled state is reconciled by slice, so
unchanged objects keep their identity and React does not re-render pages needlessly.

---

## API surface

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | public | Liveness probe |
| `POST` | `/api/auth/login` | public | Sign in, sets the session cookie |
| `POST` | `/api/auth/logout` | public | Clear the session cookie |
| `GET` | `/api/auth/me` | session | Current account, or 401 |
| `POST` | `/api/auth/change-password` | session | Change own password |
| `POST` | `/api/auth/forgot-password` | public | Issue a reset token (link in server log) |
| `POST` | `/api/auth/reset-password` | public | Complete a reset |
| `GET` | `/api/state` | session | Full state, projected for the caller |
| `GET` | `/api/accounts` | management | Active accounts for owner/approver pickers |
| `POST` | `/api/state/mutate` | session | Run one command |

Commands accepted by `/api/state/mutate`:

| Group | Operations |
| --- | --- |
| Employees | `employee.save`, `employee.setStatus` |
| Teams / projects / tasks | `team.save`, `project.save`, `project.setStatus`, `task.save`, `task.setStatus` |
| Holidays | `holiday.save`, `holiday.delete`, `holiday.copyYear`, `holiday.publishYear` |
| Settings | `settings.update` |
| Salary | `salary.save` |
| Timers | `timer.start`, `timer.pause`, `timer.resume`, `timer.end`, `timer.flag`, `timer.switch` |
| Timesheets | `timesheet.submit`, `timesheet.review` |
| Compliance | `shortfall.review`, `correction.request` |
| Leave | `leave.apply`, `leave.decide`, `leave.cancel` |
| Payroll | `payroll.calculate`, `payroll.approve`, `payroll.credit`, `payroll.generatePayslips`, `payroll.releasePayslips`, `payroll.reopen`, `payslip.revise`, `payslip.release` |
| Notifications | `notification.read` |

Errors are `4xx` with `{ "error": "…" }`; a failed business rule is `400`, not a crash.

### Payroll policy is deliberately gated

A payroll run cannot be approved until:

1. `casualTreatment` and `emergencyTreatment` are configured as `paid` or `unpaid`, and
2. every shortfall for the month has been reviewed.

This is intended behaviour: the app refuses to guess at pay policy or silently deduct for
unreviewed days. Configure leave treatment and review shortfalls under
**Payroll → Shortfalls** before calculating a month.

---

## Project layout

```
server/
  index.ts        Express app, CORS, no-store, rate limits, static client
  auth.ts         JWT cookie, bcrypt, requireAuth/requireRole/requirePayroll
  config.ts       Environment configuration
  db.ts           Mongoose connection
  models.ts       One schema per aggregate
  store.ts        In-memory cache, diff persistence, bulkWrite
  seed.ts         Clean + demo seeding
  accounts.ts     Provision/deactivate employee accounts
  routes/
    auth.ts       Login, logout, me, password change/reset
    api.ts        State, accounts, command execution

shared/
  types/          Domain types (AppState, Employee, PayrollRun, …)
  domain/         Pure rules and the command registry
  seed/           Master data fixtures

src/
  api/            Fetch wrapper and `ApiError`
  contexts/       AuthContext, DataContext
  components/     Layout, UI primitives, drawers, shared tables
  pages/          auth/, employee/, management/, shared/
  hooks/          Derived selectors and mutation helpers
```

---

## Troubleshooting

**`ECONNREFUSED 127.0.0.1:27017`** — MongoDB is not running, or `MONGODB_URI` points
somewhere else. Start `mongod` or fix the URI, then restart the API.

**`Request failed (502)`** — the page loaded but the API did not answer. The Vite dev
server proxies `/api` to `http://localhost:4000`, so a 502 means the API process is not
running. Start the full stack with `npm run dev` (API + client together), or run
`npm run dev:api` in a second terminal if you only started the client.

**"Your data could not be loaded"** — the API answered, but not with data. A `502`/`503`
means the API is down: start it and press **Try again**. A rejected session no longer
lands here — it sends you to **Session expired → Sign in again** instead.

**"Access denied"** — a management account without `canManagePayroll` opened a payroll
screen. This is a real permission boundary, not a bug. Open the attendance board or the
dashboard instead, and ask an administrator if you need payroll access.

**Wrong portal after clicking around** — a signed-in account that lands on a URL of the
other portal is returned to its own dashboard with a short explanation. If you expected
to be in the other portal, sign out and sign in with that account.

**Signed out on every reload** — the session cookie is scoped to the origin you are on.
Use the Vite dev server on `:5173` (which proxies `/api`) rather than mixing origins, and
make sure `CLIENT_ORIGIN` matches if the client is hosted separately.

**Payroll approve is disabled** — see *Payroll policy is deliberately gated* above.

**`JWT_SECRET must be at least 32 characters in production`** — set a real secret
(`openssl rand -base64 48`) when `NODE_ENV=production`.

**The seed wiped my data** — that is what it does. Use a separate database name in
`MONGODB_URI` for experiments.
