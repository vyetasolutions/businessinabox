# Vyeta Business Hub — Performance & Compliance Audit

Scope: the platform as currently built (post self-signup/approval feature).
Findings are graded by real-world impact at your current stage (early,
free-tier, small number of pilot businesses), not by theoretical worst case.
Anything marked **Fixed in this pass** was corrected as part of this review.

---

## Performance

### 🟢 Fixed in this pass — Stock/customer search wasn't using any index

**Finding:** `Inventory.jsx` and `EmployeePos.jsx` search stock with
`ilike('name', '%term%')`. The original schema indexed `inventory.name` with
a GIN index over `to_tsvector(name)` — a full-text-search index type that
Postgres **cannot** use to accelerate an `ILIKE '%...%'` query. Every search
keystroke was silently doing a full table scan of the inventory table. Fine
at 50 items, slow at 5,000.

**Fix:** `supabase_migration_003_performance_fixes.sql` replaces it with a
`pg_trgm` trigram index, which is the correct index type for partial
substring search, and adds the same for `documents.customer_name` ahead of
the Customers page needing it. Run that migration.

### 🟡 Medium — No pagination anywhere

**Finding:** `Inventory.jsx`, `Customers.jsx`, and `ManagerDashboard.jsx` all
fetch up to 200–500 rows in one request and render them all client-side.
Fine for a small shop's first year of records; will visibly slow down page
loads once a business has several thousand documents or stock items.

**Recommendation:** add real pagination (`.range()` in Supabase queries) once
any single business's data approaches ~1,000 rows in a table. Not urgent
today — flagging so it's not forgotten at your next growth stage.

### 🟡 Medium — N+1 query pattern in admin approvals

**Finding:** `GET /api/admin/pending-organizations` loops over each pending
business and makes two more calls per business (profile lookup, then an
Auth admin lookup for their email) to build the manager's contact info.

**Impact today:** negligible — you'll review a handful of new signups at a
time, not hundreds simultaneously.
**Recommendation:** revisit if signup volume ever spikes; batch the profile
lookup into a single `IN (...)` query at minimum.

### 🟢 Low — Render free-tier cold starts

**Finding:** the backend Web Service sleeps after ~15 minutes idle; the
first request after that takes 30–60 seconds. This affects
`create-employee` and any future WhatsApp automation, not document
generation or PDF creation (both are fully client-side and unaffected).

**Recommendation:** already noted in `DEPLOYMENT_GUIDE.md` — an external
free pinger (UptimeRobot, cron-job.org) hitting `/health` every ~10 minutes
avoids this entirely if it starts to matter.

### 🟢 Low — Frontend bundle size

**Finding:** `jspdf` + `jspdf-autotable` alone account for ~400KB of the
production bundle (gzipped ~130KB). Already isolated into its own chunk via
Vite's `manualChunks` so it doesn't block the initial app shell from
loading, but it's still meaningful weight for a low-bandwidth mobile
audience.

**Recommendation:** acceptable for now given PDF generation is core to the
product; if it becomes a real problem, the PDF library could be lazy-loaded
only when a document is actually being generated, rather than bundled
upfront.

---

## Compliance & Security

### 🔴 High — No email verification on signup

**Finding:** `signup-business` sets `email_confirm: true`, meaning anyone
can register a business using an email address they don't own or control.
The admin approval step is a manual sanity check, but it's not a substitute
for confirming the person actually controls that inbox — which matters
because that email is also the password-reset destination.

**Recommendation:** before onboarding real paying businesses (versus
trusted pilots you personally know), switch to Supabase's normal
`email_confirm: false` flow with a confirmation link, or at minimum require
phone verification given WhatsApp is central to your product anyway.

### 🟠 Medium-High — No audit trail

**Finding:** there's no record of who approved/rejected a business, who
created an Employee account, or who edited/deleted a stock item beyond
Postgres's own `created_at` timestamps (and even those aren't updated on
edits/deletes). If a dispute or data issue ever arises ("who deleted this
stock item?"), there's no way to answer it.

**Recommendation:** add a simple `audit_log` table (actor, action, target
table/id, timestamp) written to by the key mutation points — organization
approval/rejection is the highest-value place to start, since it's the
one action with no user-facing confirmation trail at all today.

### 🟠 Medium-High — No rate limiting on public endpoints

**Finding:** `/api/signup-business` has no throttling. Nothing currently
stops someone from scripting hundreds of fake business signups, which would
both pollute your approvals queue and count against Supabase's free-tier
row/auth-user limits.

**Recommendation:** add `express-rate-limit` (or Render's own request
limits, if available on your plan) to `/api/signup-business` and
`/api/create-employee` before any public marketing of the signup page.
Low effort, meaningfully closes an easy abuse path.

### 🟡 Medium — Weak minimum password length

**Finding:** both signup and employee creation enforce only a 6-character
minimum, matching Supabase Auth's own default but on the low end for
production use, especially for Manager accounts that hold full control of
a business's financial documents.

**Recommendation:** raise to at least 8 characters with a basic complexity
nudge in the UI copy. Supabase's project auth settings also offer a
"leaked password protection" toggle (checks against known breach
databases) worth enabling — costs nothing, no code change required.

### 🟡 Medium — Zambian Data Protection Act (2021) considerations

**Finding:** the platform stores personal data — customer names, phone
numbers, addresses — on Supabase's infrastructure, which (depending on the
region you picked when creating the project) may physically reside outside
Zambia. The Data Protection Act generally expects data controllers to have
a lawful basis for processing, reasonable security safeguards, and
awareness of where personal data is stored/transferred, especially for
cross-border transfers.

**Recommendation:** this doesn't require an architecture change, but you
should be able to answer, for your own records and for any business
customer who asks: (1) what personal data is collected (name, phone,
address — already minimal, which helps), (2) where it's stored (check
which region your Supabase project is in), (3) how a customer's data could
be deleted on request. None of this blocks you today, but it's worth having
a one-page internal answer ready before this scales past pilot use.

### 🟢 Low — Employees never forced to change their initial password

**Finding:** a Manager sets an Employee's password directly during account
creation; nothing prompts the Employee to change it on first login. This is
a mild but real weakness if Managers reuse simple/similar passwords across
staff.

**Recommendation:** low priority given the small blast radius (Employee
accounts are already restricted to sales + read-only stock), but worth a
"change your password" nudge on first login if you build out account
settings later.

### 🟢 Low — Secrets handling

**Finding:** reviewed positively — the `service_role` key is correctly
confined to the backend's environment variables and never sent to the
browser; the frontend only ever uses the public `anon` key, which is safe
by design because RLS is enforced underneath it. No issues found here.

---

## Priority order, if you want a single list to work through

1. Run `supabase_migration_003_performance_fixes.sql` (search performance — done, just needs running).
2. Add rate limiting to `/api/signup-business` before any public marketing push.
3. Decide on email verification strategy before opening signup beyond trusted pilots.
4. Add a minimal audit log for organization approval/rejection.
5. Enable Supabase's leaked-password-protection toggle (free, no code).
6. Everything else in this document can reasonably wait until you have real usage data telling you what actually needs attention next.
