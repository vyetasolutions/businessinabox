# Vyeta Business Hub — Deployment Guide (Free-Tier Stack)

This guide assumes exactly your usual workflow: everything from the browser,
using **GitHub Codespaces** and the **GitHub web UI** — no local machine needed.

The repo is a **monorepo**:
```
vyeta-business-hub/
  frontend/                                     -> deployed as a Render Static Site
  backend/                                      -> deployed as a Render Web Service (free tier)
  supabase_schema.sql                           -> run first, in the Supabase SQL Editor
  supabase_migration_002_signup_approval.sql    -> run second
  supabase_migration_003_performance_fixes.sql  -> run third
  supabase_migration_004_plans_billing.sql      -> run fourth
  PLATFORM_DOCUMENTATION.md                     -> architecture, roles, data model, API reference
  AUDIT_FINDINGS.md                             -> performance/compliance findings + priorities
```

This file covers *deploying* the platform. For how it actually works once it's live, see `PLATFORM_DOCUMENTATION.md`.

---

## PART 1 — Push this project to GitHub

1. Create a new **empty** repository on GitHub, e.g. `vyeta-business-hub` (no README, no .gitignore — we already have those).
2. Open a **Codespace** on that empty repo (Code -> Codespaces -> Create codespace).
3. Upload/copy all the files from this delivery into the Codespace, preserving the folder structure (`frontend/`, `backend/`, `supabase_schema.sql`, this guide). The easiest way: drag-and-drop the folders straight into the Codespaces file explorer panel.
4. In the Codespace terminal, run (paste only the fenced block below, exactly as-is, to avoid stray characters being pasted into your terminal):

```
git add .
git commit -m "Initial Vyeta Business Hub build"
git push origin main
```

> **Always commit before closing a Codespace.** If the Codespace times out or is deleted before you push, uncommitted work is lost.

---

## PART 2 — Supabase (Database + Auth)

1. Go to [supabase.com](https://supabase.com) → create a **free** project (pick a region close to Zambia, e.g. Europe or South Africa if offered).
2. Wait for provisioning (~2 minutes), then open **SQL Editor** → **New query**.
3. Open `supabase_schema.sql` from this delivery, copy its **entire contents**, paste into the SQL editor, and click **Run**. This creates every table, RLS policy, function, trigger, and the `documents` storage bucket in one shot.
4. Now open a **second** new query, paste in the entire contents of `supabase_migration_002_signup_approval.sql`, and run it. This adds the business self-signup + approval workflow (see "Self-service signup" section below) on top of the base schema.
5. Open a **third** new query, paste in the entire contents of `supabase_migration_003_performance_fixes.sql`, and run it. This fixes a search-indexing issue found during a later performance audit — without it, the Stock and Customer search boxes still work, just slower as data grows.
6. Open a **fourth** new query, paste in the entire contents of `supabase_migration_004_plans_billing.sql`, and run it. This adds Starter/Professional/Business Plus plans, Lenco mobile money billing, cost price/margin tracking, multi-branch support, and expense tracking.
7. Go to **Project Settings → API**. Copy three values — you'll need them shortly:
   - `Project URL`
   - `anon public` key
   - `service_role` key (⚠️ keep this one secret — it goes ONLY in the backend, never the frontend)

### Create your first Platform Admin account

With self-signup in place, ordinary businesses create themselves from the app's `/signup` page — but someone has to be the very first Platform Admin to approve them. Create that one manually, once:

1. In Supabase, go to **Authentication → Users → Add user** → create your own admin email/password. Copy the generated **User UID**.
2. In **SQL Editor**, run:

```sql
insert into public.organizations (name, status)
values ('Vyeta Platform Admin', 'active')
returning id;
```

Copy the returned `id`, then run:

```sql
insert into public.profiles (id, organization_id, full_name, role)
values ('PASTE-USER-UID-HERE', 'PASTE-ORGANIZATION-ID-HERE', 'Your Name', 'platform_admin');
```

Logging in with this account takes you straight to the **Approvals** screen — nothing else. This is your control panel for approving or rejecting new businesses as they sign up.

### How self-service signup works

- A new business visits `/signup`, enters their business name and their own Manager login, and submits.
- This creates their organization with `status = 'pending'` and their Manager account works immediately — but every protected page shows a "Pending Approval" screen instead of real content until you approve them.
- This isn't just a frontend message: the database itself refuses to let a `pending` business create documents or stock (enforced via Row-Level Security), so there's no way to route around the approval step.
- Once you approve them from `/admin/approvals`, their dashboard just starts working on their next click — no separate action needed from them.
- If you don't want a business at all, **Reject** sets their status to `suspended`, which shows a "contact us" screen instead of a "pending" one. You can flip a business back to `active` any time by re-running the approve action or updating `organizations.status` directly in SQL.

---

## PART 3 — Twilio WhatsApp Sandbox (OPTIONAL — currently shelved)

**Skip this entire section for now.** WhatsApp automation was deliberately shelved (see `PLATFORM_DOCUMENTATION.md` §7) — Supabase's Database Webhooks feature hit a setup snag on this project, and the Twilio Sandbox has real limitations for real customer use anyway. None of the rest of the platform depends on this. The "Share on WhatsApp" button people see after generating a document is a simple `wa.me` link that opens their own WhatsApp app directly — it needs no Twilio account, no backend involvement, and works today with zero setup.

Leave `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, and `BACKEND_SHARED_SECRET` unset in the backend's environment variables in Part 4 — the backend handles their absence gracefully.

If you want to revive this later, the steps below still work, with one correction: Supabase moved this feature — it's now under **Integrations → Database Webhooks**, not **Database → Webhooks** as older guides say.

<details>
<summary>Expand for the original Twilio Sandbox setup steps (not needed right now)</summary>

1. Sign up at [twilio.com](https://www.twilio.com) (free trial account is enough for the Sandbox).
2. Console → **Messaging → Try it out → Send a WhatsApp message**. Follow the on-screen instructions to join the Sandbox (you send a join code from your own WhatsApp number to Twilio's sandbox number — do this from every phone number you want to test with, since the Sandbox only messages numbers that have joined it).
3. Note down:
   - **Account SID**
   - **Auth Token**
   - The **Sandbox WhatsApp number**, formatted like `whatsapp:+14155238886`

> **Free-tier limitation:** the Sandbox only sends WhatsApp messages to numbers that have joined it, and messages are prefixed with a Twilio sandbox notice. To message customers who haven't joined the sandbox, you'd eventually need Twilio's paid **WhatsApp Business API** approval.

</details>

---

## PART 4 — Deploy the Backend (Render Web Service, free)

1. Go to [render.com](https://render.com) → **New → Web Service** → connect your GitHub repo.
2. Configure:
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
3. Under **Environment**, add these variables (copy from `backend/.env.example`):

| Key | Value |
|---|---|
| `SUPABASE_URL` | your Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service_role key |
| `LENCO_API_KEY` | your Lenco secret API key |
| `ALLOWED_ORIGINS` | leave blank for now — you'll add your frontend URL after Part 5 |
| `PORT` | `10000` |

> **Wire up Lenco's webhook** so successful payments activate a plan automatically even if the browser closes mid-payment: in your Lenco dashboard, set the webhook URL to `https://your-backend.onrender.com/api/webhooks/lenco`. No shared secret needed — this endpoint verifies Lenco's own `X-Lenco-Signature` header instead.

> Leave `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, and `BACKEND_SHARED_SECRET` **unset** — see Part 3. The backend runs fine without them; only the unused WhatsApp-automation endpoint would need them.

4. Click **Create Web Service**. Wait for the first deploy to finish, then copy your backend's URL, e.g. `https://vyeta-business-hub-backend.onrender.com`.

> **Free-tier note:** Render's free Web Services "spin down" after ~15 minutes of no traffic, and the next request takes 30–60 seconds to "wake up." This mainly affects the Add Employee and Sign Up buttons — the first call after inactivity will feel slow. If this matters to you, set up a free external pinger (e.g. UptimeRobot, cron-job.org) to hit `https://your-backend.onrender.com/health` every 10 minutes to keep it warm.

---

## PART 5 — Deploy the Frontend (Render Static Site, free)

1. Render → **New → Static Site** → same GitHub repo.
2. Configure:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
3. Under **Environment**, add (copy from `frontend/.env.example`):

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon public key |
| `VITE_BACKEND_URL` | your Render backend URL from Part 4 |

4. Click **Create Static Site**. Once deployed, copy the frontend URL, e.g. `https://vyeta-business-hub.onrender.com`.
5. Go back to your **Backend** service on Render → Environment → set `ALLOWED_ORIGINS` to that frontend URL (comma-separate multiple origins if needed, e.g. also `http://localhost:5173` for local testing) → save (this triggers a redeploy).

> Render Static Sites also handle client-side routing automatically for Vite/React apps, but if you ever see a 404 on refresh at a route like `/dashboard`, add a rewrite rule in Render: **Redirects/Rewrites → Add Rule** → Source `/*` → Destination `/index.html` → Action `Rewrite`.

---

## PART 6 — Try it out

1. Open your frontend URL and go to `/signup` to create a real test business (this exercises the actual path your future customers will use). Check the consent checkbox (it links to your live Privacy Policy at `/privacy-policy`), submit, then confirm you land on the "pending approval" success screen.
2. Log in with your Platform Admin account (created in Part 2), go to **Approvals**, and approve the business you just created.
3. Log out, log back in as that business's Manager — you should now see the full Dashboard instead of the pending screen.
4. Go to **Stock** and add a few inventory items.
5. Go to **Dashboard → Add Employee** and create an Employee login. Log out, log back in as that Employee — you should land on the **Sell** (POS) screen only, with Dashboard/Settings/Create Doc hidden.
6. From the POS screen, add stock items to a sale, fill in customer details, and generate a Receipt — a PDF is created in your browser, uploaded to Supabase Storage, and a "Share on WhatsApp" link (a manual `wa.me` link, no backend involved) is prepared.
7. Turn off your device's WiFi/data, repeat step 6 — the document still saves (to `localStorage`), shows a "queued for sync" badge, and will automatically push to Supabase the moment you're back online.
8. On mobile, confirm the sign-out icon in the top header actually logs you out (it's separate from the desktop sidebar's sign-out, which lives in a different spot).
9. From the Login page, click **Forgot password?**, submit your own email, and confirm the reset email arrives and the link takes you to a working "set new password" screen.

---

## Ongoing free-tier considerations

- **Supabase free tier**: 500 MB database, 1 GB file storage, 50,000 monthly active users, project pauses after 7 days of total inactivity (just visit the dashboard occasionally, or make any API call, to keep it active).
- **Render free tier**: Static Sites are always-on and free with no sleep. Web Services (the backend) sleep after inactivity as noted above — the `/health` pinger trick avoids this.
- **Twilio**: not currently in use (see Part 3) — no account needed unless you revive WhatsApp automation later.
- All three services can be managed entirely from the browser — no local installs required, consistent with your Codespaces-only workflow.

---

## Making changes later (from Codespaces)

1. Open your Codespace on the repo.
2. Make edits in `frontend/src/...` or `backend/index.js`.
3. Test locally inside the Codespace if you like:
   - Frontend: `cd frontend && npm install && npm run dev` (Codespaces will offer to forward port 5173 — make it public if you want to preview on your phone).
   - Backend: `cd backend && npm install && npm start`.
4. Commit and push — paste terminal commands only from inside triple-backtick code blocks to avoid stray characters:

```
git add .
git commit -m "Describe your change"
git push origin main
```

5. Render auto-deploys both services on every push to `main`.
