# Vyeta Business Hub

A premium, multi-tenant business suite for Zambian SMEs and the informal sector — sales documents, stock, staff, and customers in one place.

**Stack:** Vite + React + Tailwind (PWA, offline-first) · Node.js/Express · Supabase (Postgres + Auth + Storage, strict Row-Level Security).

## Structure
- `frontend/` — the React app (deploy as a Render Static Site)
- `backend/` — the Express API (deploy as a Render Web Service)
- `supabase_schema.sql` — full database schema + RLS policies (run once in Supabase)
- `DEPLOYMENT_GUIDE.md` — full step-by-step setup for Supabase, Render, and Twilio, written for a browser-only/Codespaces workflow

## What's included
- **Three-tier access**: Platform Admin, Manager, Employee — enforced both in the UI (conditional navigation) and in the database (Row-Level Security), so an Employee physically cannot read or write data outside their permissions, even by calling the API directly.
- **Frictionless employee onboarding**: Managers create Employee logins from inside the Dashboard; the backend uses Supabase's Admin API with the `service_role` key (never exposed to the browser) to provision the account.
- **Stock & inventory**: searchable, full CRUD for Managers, read-only/search for Employees.
- **Offline-first PWA**: installable, works with no signal. Document submissions save to `localStorage` with a UUID sync token and auto-push to Supabase the moment connectivity returns.
- **WhatsApp automation**: a Supabase Database Webhook fires on every new document, the Node backend formats the number and sends the document link via Twilio's WhatsApp Sandbox.
- **All original functionality preserved**: Invoice/Quotation/Receipt/Delivery Note generation with live totals, PDF export, a customer directory built from document history, business profile settings that brand every PDF, dark/light theme toggle, and the financial analytics dashboard (Chart.js) — all rebuilt as a multi-tenant React app instead of the original single-file/Google-Apps-Script version.

Start with **DEPLOYMENT_GUIDE.md**.
