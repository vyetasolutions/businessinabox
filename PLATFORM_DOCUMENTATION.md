# Vyeta Business Hub — Platform Documentation

## 1. What this is

A multi-tenant business management platform for SMEs and the informal sector in
Zambia: point-of-sale document generation (invoices, quotations, receipts,
delivery notes), stock inventory, a customer directory, and role-based staff
access — usable offline, installable as an app on a phone.

"Multi-tenant" means many unrelated businesses share the same running
application and database, but each business's data is invisible to every
other business. This is enforced by Postgres Row-Level Security (RLS), not by
application code — even a bug in the frontend cannot leak one business's data
to another, because the database itself refuses the query.

---

## 2. Architecture at a glance

```
┌─────────────────────┐      ┌──────────────────────┐      ┌────────────────────┐
│   Frontend (PWA)     │      │   Backend (Express)   │      │     Supabase        │
│  React + Vite +      │─────▶│  Node.js, 2 privileged │─────▶│  Postgres + Auth +  │
│  Tailwind, deployed  │      │  endpoints only        │      │  Storage + RLS      │
│  as Render Static    │◀─────│  deployed as Render    │◀─────│                     │
│  Site                │      │  Web Service           │      │                     │
└─────────────────────┘      └──────────────────────┘      └────────────────────┘
        │                                                             ▲
        │  reads/writes documents, inventory, profiles directly       │
        └─────────────────────────────────────────────────────────────┘
        (using the public "anon" key + the logged-in user's session,
         with every query filtered by Row-Level Security)
```

**Why a backend exists at all**, given the frontend can talk to Supabase
directly: two operations are too privileged to ever run in a browser —
creating another person's login (Employee accounts, and now business
signups) and (previously) sending WhatsApp messages via Twilio. Both need
Supabase's `service_role` key, which bypasses every security rule and must
never be shipped to a browser. The backend exists specifically to hold that
key and perform only those two narrow, checked operations.

Everything else — reading/writing documents, inventory, customer history,
business settings — goes straight from the frontend to Supabase, protected
by RLS.

---

## 3. Roles and permissions

| Capability | Platform Admin | Manager | Employee |
|---|---|---|---|
| Approve/reject new business signups | ✅ | ❌ | ❌ |
| View/edit their own business profile | — (has no ordinary business) | ✅ | ❌ |
| Create Employee logins | ❌ | ✅ | ❌ |
| Create/edit/delete stock items | ❌ | ✅ | ❌ (read + search only) |
| View stock | — | ✅ | ✅ |
| Generate Invoice / Delivery Note | ❌ | ✅ | ❌ |
| Generate Receipt / Quotation | ❌ | ✅ | ✅ |
| View financial analytics dashboard | ❌ | ✅ | ❌ |
| View customer directory | — | ✅ | ✅ |

This table is enforced in **three independent layers**, deliberately
redundant:

1. **Navigation** (`Sidebar.jsx`) — different roles see different menu items at all.
2. **Routing** (`ProtectedRoute.jsx`) — visiting a URL directly (e.g. typing
   `/settings` into the address bar) redirects away if your role isn't allowed there.
3. **Database** (Row-Level Security policies in `supabase_schema.sql`) — the
   real backstop. Even if someone bypassed the UI entirely and called the
   Supabase API by hand, an Employee's request to edit inventory or a
   Manager's request to read another business's documents is rejected by
   Postgres itself.

Layer 3 is what actually matters for security; layers 1 and 2 are for a good
user experience.

---

## 4. Data model

**`organizations`** — one row per business ("tenant"). Holds branding info
(name, phone, TPIN, address, banking details, logo), plus **two independent
gates**: `status` (`pending` / `active` / `suspended` — Vyeta's manual vetting
of the business) and `plan` + `subscription_status` + `trial_ends_at` +
`current_period_end` (billing — see §6). A business can be approved but
locked out for non-payment at the same time; these don't move together.

**`profiles`** — one row per human, extending Supabase's built-in
`auth.users`. Carries `organization_id` (which business they belong to) and
`role` (`platform_admin` / `manager` / `employee`).

**`inventory`** — stock items, scoped to an organization (and optionally a
`branch_id`). Carries both `unit_price` (sell price) and `cost_price`, so
margin can be shown per item and, cumulatively, on the dashboard.

**`documents`** — every Invoice/Quotation/Receipt/Delivery Note ever
generated. Includes a `sync_token` (a UUID) used to safely re-submit a
document created while offline without ever creating a duplicate. Each line
item in `items` (jsonb) snapshots `costPrice` at the time of sale *only*
when it came from a POS sale against inventory — free-form Manager invoices
don't have a known cost, so margin reporting only covers POS-driven sales.

**`branches`** — a business's physical locations. Every organization gets
one `is_primary` branch automatically; additional branches are a Business
Plus feature, enforced in RLS (`branches_insert_gated`).

**`expenses`** — simple expense records (category, amount, date), a
Professional+ feature.

**`subscription_payments`** — one row per Lenco mobile money collection
attempt, successful or not. This is the payment audit trail — see §6.

**`whatsapp_messages_queue`** — present in the schema for a WhatsApp
delivery feature that is currently **shelved** (see §8). Harmless to leave
in place; nothing writes meaningful data to it beyond the automatic trigger
that populates it, and nothing currently sends from it.

---

## 5. Business lifecycle: signup → approval → active

1. A new business visits `/signup`, submits their business name and their
   own Manager login. This calls `POST /api/signup-business` on the backend.
2. The backend creates the `organizations` row (`status = 'pending'`), the
   Auth user, and their `profiles` row (`role = 'manager'`) — using the
   service_role key, since a public visitor obviously can't be trusted with
   that key themselves. The organization also gets `plan = 'starter'`,
   `subscription_status = 'trialing'`, and `trial_ends_at = now() + 14 days`
   automatically.
3. The Manager's login works immediately, but every page they visit shows a
   **Pending Approval** screen instead of real content (`ProtectedRoute.jsx`
   checks `organization.status !== 'active'`).
4. This isn't just a UI message — the RLS policies added in migration 002
   (`is_org_active()`) refuse to let a `pending` organization insert
   documents or inventory, even via a direct API call.
5. A Platform Admin reviews pending businesses at `/admin/approvals` and
   approves or rejects. Approving flips `status` to `active`; rejecting
   flips it to `suspended`.
6. Once `status = 'active'`, the Manager sees the real app — but now the
   *separate* billing gate (§6) takes over: their 14-day Starter trial is
   running, and once it (or a paid period) ends, `SubscriptionRequired.jsx`
   takes over from `PendingApproval.jsx` as the blocking screen.

**Bootstrapping problem**: someone has to be the very first Platform Admin,
and nobody can self-signup into that role (correctly — it would defeat the
purpose). This one account is created by hand, once, directly in Supabase
(see `DEPLOYMENT_GUIDE.md` Part 2). Every business after that goes through
self-signup.

---

## 6. Billing & subscriptions — how it actually works

**This is not auto-renewing, recurring billing.** There is no card on file,
no automatic monthly charge. Each payment is a one-off mobile money
collection the Manager triggers themselves from `/billing`. A successful
payment sets `current_period_end = now() + 30 days`. When that date passes
with no new payment, access lapses automatically — the business isn't
charged again, they're just locked out until they pay again.

**How the lapse is enforced — deliberately without a cron job.** A
free-tier stack shouldn't depend on a scheduled job existing and firing
reliably to gate revenue. Instead, `hasActiveAccess(organization)` in
`frontend/src/lib/plans.js` computes access *live*, on every protected page
load: trialing businesses check `trial_ends_at` against now; active
businesses check `current_period_end` against now. Nothing needs to run in
the background for this to work correctly — the check just re-evaluates
every time. The tradeoff: `subscription_status` in the database can still
say `'active'` for a business whose period has technically already ended
(the column itself isn't flipped to `'past_due'` automatically) — the
*access decision* is always correct, but the raw column value can lag
reality slightly until their next payment attempt or an admin looks
closely. The Admin Billing Overview (`/admin/billing`) shows the computed
access alongside the raw status specifically so this gap is visible, not
hidden.

**Where to see who's paid up:** `/admin/billing` (Platform Admin only) —
shows every business's plan, billing status, trial/renewal date, computed
access (paid vs. locked out), estimated monthly revenue, and full payment
history from `subscription_payments`. This is the operational source of
truth; querying Supabase directly works too but shouldn't be necessary
day-to-day.

**The payment flow, end to end:**
1. Manager picks a plan on `/billing`, enters their mobile money number + network.
2. Frontend calls `POST /api/billing/initiate-payment` (server prices the
   plan — a payment amount is never trusted from the browser).
3. Backend calls Lenco's Collections API, records a `subscription_payments`
   row (`status: 'pending'`), returns a reference to the frontend.
4. Frontend polls `GET /api/billing/payment-status/:reference` every 3
   seconds while the customer approves on their phone.
5. Lenco sends a webhook to `POST /api/webhooks/lenco` on success/failure
   (signature-verified) — this is the primary path. The polling in step 4
   is a fallback in case the webhook is delayed, re-querying Lenco directly.
6. On success, `activateSubscription()` sets `plan`, `subscription_status =
   'active'`, and `current_period_end = now() + 30 days` on the organization.

**Feature gating**, separate from the access gate above: `plan_allows()`
(Postgres, migration 004) and `planAllows()` (frontend, `lib/plans.js`) are
two independently-maintained copies of the same feature matrix — inventory/
delivery notes/expenses/reports need Professional+; multi-user/multi-branch/
custom branding need Business Plus. The frontend copy is UX only (hides
buttons); the Postgres copy is the real enforcement. If you change pricing
or features, **both must be updated** — there's no single source of truth
enforced by tooling, only by convention (flagged in `AUDIT_FINDINGS.md`).

**What's genuinely missing, on purpose (not yet built):** payment retry
reminders, dunning emails/SMS before a trial or period ends, prorated
plan changes mid-cycle, refunds, and invoice/receipt generation for the
subscription payment itself (as opposed to the business's own customer
documents, which is unrelated and already works). These are reasonable
next steps once real usage data shows which of them actually matters.

---

## 7. Offline-first behavior

The frontend is a installable Progressive Web App (`vite-plugin-pwa`). Two
independent mechanisms make it usable with no signal:

**App shell caching** — the compiled JS/CSS/HTML is cached by a service
worker, so the app itself still *opens* offline (this is standard PWA
behavior, unrelated to your business data).

**Document queueing** (`src/lib/offlineSync.js`) — this is the part that
matters for actual usage. When a Receipt/Quotation/Invoice is generated:

1. The PDF is built **entirely client-side** (`jspdf`), so it doesn't
   need the network at all.
2. If online: the PDF uploads to Supabase Storage and the document record
   is inserted immediately.
3. If offline (or the network drops mid-submit): the document is saved to
   `localStorage`, tagged with a UUID `sync_token`, and the UI shows an
   "queued for sync" badge instead of failing.
4. The moment the browser's `online` event fires (i.e. connectivity
   returns), every queued document is pushed to Supabase via an `upsert`
   keyed on `sync_token` — so even if sync is triggered twice (e.g. the app
   reloads mid-sync), no duplicate document is ever created.

**What is *not* covered by offline mode**: stock quantity changes from a
completed offline sale are not queued or reconciled — the POS screen only
decrements stock live, when online (see `EmployeePos.jsx`). An offline sale
still saves the receipt correctly, but stock counts won't reflect it until
someone manually adjusts inventory, or you build proper offline stock
reconciliation (see Known Limitations).

---

## 8. WhatsApp integration (currently shelved)

The schema, database trigger, and backend endpoint
(`POST /api/trigger-whatsapp`) for automatically sending customers a
WhatsApp message when a document is created still exist in the codebase,
but the Supabase→backend webhook was never wired up, by deliberate choice —
because Supabase's Database Webhooks feature required manual dashboard setup
that turned out to be broken on this project (missing `pg_net` schema),
and Twilio's WhatsApp Sandbox has real limitations for production use
(recipients must first join the sandbox; messages carry a sandbox notice).

**What still works today, with no backend involvement**: the "Share on
WhatsApp" button shown after generating a document opens a `wa.me` link
with a prefilled message — this is a client-side, one-tap manual share, not
an automated send, and needs no Twilio account or webhook at all.

**To revive full automation later**: enable the `pg_net` Postgres extension,
attach a SQL trigger that calls `net.http_post` directly to
`/api/trigger-whatsapp` (bypassing the dashboard Webhooks UI entirely — this
was the working fix found during initial setup), and get proper Twilio
WhatsApp Business API approval instead of the Sandbox for real customer use.

---

## 9. API reference (backend)

All endpoints live in `backend/index.js`. Base URL is your Render backend
service URL.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | none | Uptime check / keep-alive ping target |
| `POST` | `/api/signup-business` | none (public) | Creates a new pending organization + Manager |
| `POST` | `/api/create-employee` | Bearer token, must be `manager`/`platform_admin` | Creates an Employee login under the caller's organization (Business Plus only) |
| `GET` | `/api/admin/pending-organizations` | Bearer token, must be `platform_admin` | Lists businesses awaiting approval |
| `POST` | `/api/admin/approve-organization` | Bearer token, must be `platform_admin` | Approves (`active`) or rejects (`suspended`) a business |
| `POST` | `/api/billing/initiate-payment` | Bearer token, must be `manager`/`platform_admin` | Starts a Lenco mobile money collection for a plan |
| `GET` | `/api/billing/payment-status/:reference` | Bearer token | Polls/reconciles a payment's status |
| `POST` | `/api/webhooks/lenco` | Lenco signature header | Lenco's server-to-server payment confirmation |
| `GET` | `/api/admin/organizations` | Bearer token, must be `platform_admin` | Billing overview — every business's plan/status |
| `GET` | `/api/admin/subscription-payments` | Bearer token, must be `platform_admin` | Payment history across all businesses |
| `POST` | `/api/trigger-whatsapp` | shared-secret header | Twilio send — currently unused, see §8 |

"Bearer token" means the frontend sends the logged-in user's Supabase
session `access_token` in the `Authorization` header; the backend verifies
it with `supabase.auth.getUser(token)` before checking the caller's role.

---

## 10. Known limitations (honest list, not marketing copy)

- **No forced password rotation for Employees.** A Manager sets an
  Employee's initial password directly; the Employee is never prompted to
  change it on first login.
- **No audit log.** Approving/rejecting a business, creating an Employee,
  editing stock — none of this is logged anywhere beyond Postgres's own
  default row timestamps. There's no "who did what, when" trail.
- **No email verification on signup.** `email_confirm: true` is set
  deliberately to reduce signup friction, meaning anyone can register with
  an email address they don't actually control. The admin approval step
  provides some manual check, but it's not a substitute for verified email.
- **No rate limiting** on `/api/signup-business` or `/api/create-employee`.
  Both are reachable by anyone who has the URL; nothing currently stops
  automated spam signups or password-guessing attempts beyond what Render's
  and Supabase's own infrastructure-level protections provide.
- **Offline stock reconciliation isn't built.** See §7.
- **The admin approvals list does a small per-business lookup loop**
  (fetching each pending business's Manager name/email individually) rather
  than one batched query. At the scale of "a handful of new businesses
  awaiting review at a time" this is irrelevant; it would need rewriting if
  hundreds of businesses ever signed up in the same hour.
- **No dunning/renewal reminders.** A business finds out their trial or
  paid period has ended when they next open the app and see
  `SubscriptionRequired.jsx` — there's no advance-warning email/SMS at, say,
  3 days before expiry. Worth building once you have real churn data to
  justify the effort.
- **Margin/gross profit only reflects POS-driven sales.** Free-form
  documents from `DocumentGenerator.jsx` (the Manager's non-POS invoice
  flow) don't know an item's cost price, so they're excluded from the
  Gross Profit figure on the dashboard by design, not by bug.
- **Plan feature gates are duplicated, not shared.** `plan_allows()` in
  Postgres and `planAllows()` in the frontend encode the same rules
  independently. Changing pricing/features means updating both by hand —
  see §6.
- See `AUDIT_FINDINGS.md` for the fuller performance/compliance pass and
  prioritized recommendations.
