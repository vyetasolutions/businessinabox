-- ============================================================================
-- VYETA BUSINESS HUB — MIGRATION 002: SELF-SERVICE SIGNUP + ADMIN APPROVAL
-- ============================================================================
-- Run this in Supabase SQL Editor AFTER supabase_schema.sql.
-- Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add a status to organizations. New signups start 'pending' and are
--    invisible to normal use until a Platform Admin approves them.
-- ----------------------------------------------------------------------------
alter table public.organizations
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'active', 'suspended'));

-- Existing organizations (created before this migration, e.g. your first
-- manually-created business) should not suddenly get locked out.
update public.organizations set status = 'active' where status = 'pending';

-- ----------------------------------------------------------------------------
-- 2. Helper: is the current user's organization active?
-- ----------------------------------------------------------------------------
create or replace function public.is_org_active()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select status = 'active' from public.organizations where id = public.current_org_id()),
    false
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. Enforce the gate at the DATABASE level, not just the UI: a pending or
--    suspended business cannot create documents or stock, even if someone
--    calls the API directly. Platform Admins are exempt (they have no
--    ordinary business data to gate).
-- ----------------------------------------------------------------------------
drop policy if exists "documents_insert_same_org" on public.documents;
create policy "documents_insert_same_org" on public.documents
  for insert with check (
    organization_id = public.current_org_id()
    and created_by = auth.uid()
    and (public.is_org_active() or public.current_role() = 'platform_admin')
  );

drop policy if exists "inventory_insert_manager_only" on public.inventory;
create policy "inventory_insert_manager_only" on public.inventory
  for insert with check (
    organization_id = public.current_org_id()
    and public.is_manager_or_admin()
    and (public.is_org_active() or public.current_role() = 'platform_admin')
  );

-- ----------------------------------------------------------------------------
-- 4. RLS already lets a platform_admin SELECT every organization and profile
--    (see "org_select_own" / "profiles_select_same_org" in the base schema),
--    so no new policies are needed for the admin approvals screen to list
--    pending businesses. We only need to allow a platform_admin to UPDATE
--    any organization's status (the existing "org_update_manager" policy
--    already covers this — platform_admin is included there too).
-- ----------------------------------------------------------------------------
-- (No changes needed — included here for documentation purposes.)

-- ============================================================================
-- 5. Create your first Platform Admin (one-time, manual — same pattern as
--    creating your first Manager). Run this once, replacing the placeholders:
--
--   a) Authentication -> Users -> Add user -> create your own admin login,
--      copy the generated User UID.
--   b) Run:
--
--   insert into public.organizations (name, status)
--   values ('Vyeta Platform Admin', 'active')
--   returning id;
--
--   c) Copy the returned id, then run:
--
--   insert into public.profiles (id, organization_id, full_name, role)
--   values ('PASTE-USER-UID-HERE', 'PASTE-ORGANIZATION-ID-HERE', 'Your Name', 'platform_admin');
-- ============================================================================
