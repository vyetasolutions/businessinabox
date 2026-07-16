-- ============================================================================
-- VYETA BUSINESS HUB — MIGRATION 005: FIX PLAN COLUMN (bug fix)
-- ============================================================================
-- Run this in Supabase SQL Editor AFTER migration 004.
--
-- WHY: organizations.plan already existed from the very first schema
-- (default 'free', check constraint allowing only 'free'/'pro'). Migration
-- 004 used `ADD COLUMN IF NOT EXISTS plan ...` intending to redefine it —
-- but Postgres silently skips the ENTIRE clause (new default, new check
-- constraint, everything) when the column already exists. Every business
-- was left sitting on the old 'free'/'pro' values, which the Billing page
-- doesn't recognize — causing it (and anything else reading `plan`) to
-- crash on load. This migration actually fixes the column.
-- ============================================================================

-- 1. Drop the old constraint (name may vary; this covers the default Postgres naming)
alter table public.organizations drop constraint if exists organizations_plan_check;

-- 2. Migrate existing data to the new vocabulary
update public.organizations set plan = 'starter' where plan = 'free';
update public.organizations set plan = 'business_plus' where plan = 'pro';

-- 3. Apply the correct constraint and default going forward
alter table public.organizations alter column plan set default 'starter';
alter table public.organizations add constraint organizations_plan_check
  check (plan in ('starter', 'professional', 'business_plus'));

-- 4. Sanity check — this should return zero rows. If it doesn't, something
-- else is writing an unexpected value into `plan` and needs investigating.
select id, name, plan from public.organizations
  where plan not in ('starter', 'professional', 'business_plus');
