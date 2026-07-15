-- ============================================================================
-- VYETA BUSINESS HUB — MIGRATION 004: PLANS, BILLING, MARGIN, BRANCHES, EXPENSES
-- ============================================================================
-- Run this in Supabase SQL Editor AFTER migration 003.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Plan + subscription fields on organizations
-- ----------------------------------------------------------------------------
alter table public.organizations
  add column if not exists plan text not null default 'starter'
    check (plan in ('starter', 'professional', 'business_plus')),
  add column if not exists subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column if not exists current_period_end timestamptz,
  add column if not exists logo_url text;

-- Existing organizations created before this migration get a permanent pass —
-- don't suddenly cut off businesses you already approved.
update public.organizations
  set subscription_status = 'active', plan = coalesce(nullif(plan, 'starter'), 'business_plus')
  where subscription_status = 'trialing' and status = 'active';

-- ----------------------------------------------------------------------------
-- 2. Cost price on inventory, for margin visibility
-- ----------------------------------------------------------------------------
alter table public.inventory
  add column if not exists cost_price numeric(12,2) not null default 0;

-- ----------------------------------------------------------------------------
-- 3. Branches (Business Plus feature — every org gets one free "primary" branch)
-- ----------------------------------------------------------------------------
create table if not exists public.branches (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  name              text not null,
  address           text,
  phone             text,
  is_primary        boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists idx_branches_org on public.branches(organization_id);

alter table public.inventory add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.documents add column if not exists branch_id uuid references public.branches(id) on delete set null;

-- Give every existing organization a primary branch so nothing breaks
insert into public.branches (organization_id, name, is_primary)
select id, name, true from public.organizations o
where not exists (select 1 from public.branches b where b.organization_id = o.id);

-- ----------------------------------------------------------------------------
-- 4. Expenses (Professional + Business Plus feature)
-- ----------------------------------------------------------------------------
create table if not exists public.expenses (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  branch_id         uuid references public.branches(id) on delete set null,
  category          text not null,
  description       text,
  amount            numeric(12,2) not null,
  expense_date      date not null default current_date,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_expenses_org on public.expenses(organization_id, expense_date);

-- ----------------------------------------------------------------------------
-- 5. Subscription payments (Lenco mobile money collections)
-- ----------------------------------------------------------------------------
create table if not exists public.subscription_payments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  plan              text not null check (plan in ('starter', 'professional', 'business_plus')),
  amount            numeric(12,2) not null,
  reference         text not null unique,
  lenco_reference   text,
  phone             text,
  operator          text,
  status            text not null default 'pending' check (status in ('pending', 'successful', 'failed')),
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create index if not exists idx_subscription_payments_org on public.subscription_payments(organization_id);

-- ----------------------------------------------------------------------------
-- 6. Plan feature-gating helper — single source of truth used inside RLS
-- ----------------------------------------------------------------------------
create or replace function public.plan_allows(feature text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case feature
    when 'inventory'        then plan in ('professional', 'business_plus')
    when 'delivery_note'    then plan in ('professional', 'business_plus')
    when 'expense_tracking' then plan in ('professional', 'business_plus')
    when 'reports'          then plan in ('professional', 'business_plus')
    when 'multi_user'       then plan = 'business_plus'
    when 'multi_branch'     then plan = 'business_plus'
    when 'custom_branding'  then plan = 'business_plus'
    else false
  end
  from public.organizations where id = public.current_org_id();
$$;

-- ----------------------------------------------------------------------------
-- 7. Enforce gating at the database level
-- ----------------------------------------------------------------------------
drop policy if exists "inventory_insert_manager_only" on public.inventory;
create policy "inventory_insert_manager_only" on public.inventory
  for insert with check (
    organization_id = public.current_org_id()
    and public.is_manager_or_admin()
    and (public.is_org_active() or public.current_role() = 'platform_admin')
    and public.plan_allows('inventory')
  );

drop policy if exists "documents_insert_same_org" on public.documents;
create policy "documents_insert_same_org" on public.documents
  for insert with check (
    organization_id = public.current_org_id()
    and created_by = auth.uid()
    and (public.is_org_active() or public.current_role() = 'platform_admin')
    and (doc_type <> 'Delivery Note' or public.plan_allows('delivery_note'))
  );

alter table public.branches enable row level security;
alter table public.expenses enable row level security;
alter table public.subscription_payments enable row level security;

drop policy if exists "branches_select_same_org" on public.branches;
create policy "branches_select_same_org" on public.branches
  for select using (organization_id = public.current_org_id());

drop policy if exists "branches_insert_gated" on public.branches;
create policy "branches_insert_gated" on public.branches
  for insert with check (
    organization_id = public.current_org_id()
    and public.is_manager_or_admin()
    and (
      public.plan_allows('multi_branch')
      or not exists (select 1 from public.branches b where b.organization_id = public.current_org_id())
    )
  );

drop policy if exists "branches_update_manager_only" on public.branches;
create policy "branches_update_manager_only" on public.branches
  for update using (organization_id = public.current_org_id() and public.is_manager_or_admin());

drop policy if exists "branches_delete_manager_only" on public.branches;
create policy "branches_delete_manager_only" on public.branches
  for delete using (organization_id = public.current_org_id() and public.is_manager_or_admin() and not is_primary);

drop policy if exists "expenses_select_same_org" on public.expenses;
create policy "expenses_select_same_org" on public.expenses
  for select using (organization_id = public.current_org_id() and public.is_manager_or_admin());

drop policy if exists "expenses_insert_gated" on public.expenses;
create policy "expenses_insert_gated" on public.expenses
  for insert with check (
    organization_id = public.current_org_id()
    and public.is_manager_or_admin()
    and public.plan_allows('expense_tracking')
    and created_by = auth.uid()
  );

drop policy if exists "expenses_delete_manager_only" on public.expenses;
create policy "expenses_delete_manager_only" on public.expenses
  for delete using (organization_id = public.current_org_id() and public.is_manager_or_admin());

drop policy if exists "subscription_payments_select_same_org" on public.subscription_payments;
create policy "subscription_payments_select_same_org" on public.subscription_payments
  for select using (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- No client insert/update policy for subscription_payments — only the backend,
-- using the service_role key, is allowed to write payment records. This is
-- deliberate: a payment's status must never be something the browser can set.

-- ----------------------------------------------------------------------------
-- 8. Branding storage bucket (logo uploads)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

drop policy if exists "branding_bucket_read_public" on storage.objects;
create policy "branding_bucket_read_public" on storage.objects
  for select using (bucket_id = 'branding');

drop policy if exists "branding_bucket_write_authenticated" on storage.objects;
create policy "branding_bucket_write_authenticated" on storage.objects
  for insert with check (bucket_id = 'branding' and auth.role() = 'authenticated');

drop policy if exists "branding_bucket_update_authenticated" on storage.objects;
create policy "branding_bucket_update_authenticated" on storage.objects
  for update using (bucket_id = 'branding' and auth.role() = 'authenticated');

-- ============================================================================
-- DONE. See PLATFORM_DOCUMENTATION.md for the full plan/feature matrix, and
-- DEPLOYMENT_GUIDE.md for the Lenco environment variables to set on the backend.
-- ============================================================================
