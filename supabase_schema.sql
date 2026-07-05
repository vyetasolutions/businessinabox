-- ============================================================================
-- VYETA BUSINESS HUB — SUPABASE SCHEMA
-- ============================================================================
-- Run this entire file once in Supabase Dashboard -> SQL Editor -> New Query.
-- Safe to re-run: it drops and recreates policies, but NOT tables/data.
-- ============================================================================

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. ORGANIZATIONS  (the "tenant" — one row per business using the platform)
-- ============================================================================
create table if not exists public.organizations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  phone             text,
  tpin              text,
  address           text,
  banking_details   text,
  logo_url          text,
  plan              text not null default 'free' check (plan in ('free','pro')),
  created_at        timestamptz not null default now()
);

-- ============================================================================
-- 2. PROFILES  (extends auth.users — one row per person, linked to an org)
-- ============================================================================
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  full_name         text,
  role              text not null default 'employee' check (role in ('platform_admin','manager','employee')),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists idx_profiles_org on public.profiles(organization_id);

-- ============================================================================
-- 3. INVENTORY  (stock items belonging to an organization)
-- ============================================================================
create table if not exists public.inventory (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  name              text not null,
  sku               text,
  category          text,
  unit_price        numeric(12,2) not null default 0,
  quantity_on_hand  integer not null default 0,
  low_stock_alert   integer not null default 5,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_inventory_org on public.inventory(organization_id);
create index if not exists idx_inventory_name on public.inventory using gin (to_tsvector('english', name));

-- ============================================================================
-- 4. DOCUMENTS  (invoices, quotations, receipts, delivery notes)
-- ============================================================================
create table if not exists public.documents (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  created_by          uuid references public.profiles(id),
  sync_token          uuid not null default gen_random_uuid(), -- used for offline dedupe
  doc_type            text not null check (doc_type in ('Invoice','Quotation','Receipt','Delivery Note')),
  customer_name       text not null,
  customer_phone      text,
  customer_address    text,
  items               jsonb not null default '[]'::jsonb,
  subtotal            numeric(12,2) not null default 0,
  discount_rate       numeric(5,2) not null default 0,
  discount_amount     numeric(12,2) not null default 0,
  tax_rate            numeric(5,2) not null default 0,
  tax_amount          numeric(12,2) not null default 0,
  total               numeric(12,2) not null default 0,
  pdf_url             text,
  status              text not null default 'issued' check (status in ('issued','paid','void')),
  created_at          timestamptz not null default now()
);

create unique index if not exists idx_documents_sync_token on public.documents(sync_token);
create index if not exists idx_documents_org on public.documents(organization_id);
create index if not exists idx_documents_customer on public.documents(organization_id, customer_name);

-- ============================================================================
-- 5. WHATSAPP MESSAGE QUEUE  (fed by a Supabase webhook -> Node backend -> Twilio)
-- ============================================================================
create table if not exists public.whatsapp_messages_queue (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  document_id       uuid references public.documents(id) on delete set null,
  to_phone          text not null,
  message_body      text not null,
  status            text not null default 'pending' check (status in ('pending','sent','failed')),
  provider_sid      text,
  error_message     text,
  created_at        timestamptz not null default now(),
  sent_at           timestamptz
);

create index if not exists idx_whatsapp_queue_status on public.whatsapp_messages_queue(status);

-- ============================================================================
-- 6. HELPER FUNCTIONS  (used inside RLS policies — avoids recursive lookups)
-- ============================================================================

-- Returns the organization_id of the currently authenticated user.
-- SECURITY DEFINER + fixed search_path so it can read profiles regardless of
-- the caller's own row-level policies (prevents infinite recursion).
create or replace function public.current_org_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

-- Returns the role of the currently authenticated user: 'platform_admin' | 'manager' | 'employee'
create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) in ('manager','platform_admin'), false);
$$;

-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================================
alter table public.organizations           enable row level security;
alter table public.profiles                enable row level security;
alter table public.inventory               enable row level security;
alter table public.documents               enable row level security;
alter table public.whatsapp_messages_queue enable row level security;

-- ---------------- ORGANIZATIONS ----------------
drop policy if exists "org_select_own" on public.organizations;
create policy "org_select_own" on public.organizations
  for select using (
    id = public.current_org_id() or public.current_role() = 'platform_admin'
  );

drop policy if exists "org_update_manager" on public.organizations;
create policy "org_update_manager" on public.organizations
  for update using (
    id = public.current_org_id() and public.current_role() in ('manager','platform_admin')
  );

-- Organizations are normally created by the backend using the service_role key
-- (which bypasses RLS entirely), so no public insert policy is required.

-- ---------------- PROFILES ----------------
drop policy if exists "profiles_select_same_org" on public.profiles;
create policy "profiles_select_same_org" on public.profiles
  for select using (
    organization_id = public.current_org_id() or public.current_role() = 'platform_admin'
  );

drop policy if exists "profiles_update_self_or_manager" on public.profiles;
create policy "profiles_update_self_or_manager" on public.profiles
  for update using (
    id = auth.uid()
    or (organization_id = public.current_org_id() and public.current_role() in ('manager','platform_admin'))
  );

-- Employee account creation happens via the backend's /api/create-employee
-- endpoint using the service_role key, so client-side inserts are not allowed.

-- ---------------- INVENTORY ----------------
drop policy if exists "inventory_select_same_org" on public.inventory;
create policy "inventory_select_same_org" on public.inventory
  for select using (organization_id = public.current_org_id());

drop policy if exists "inventory_insert_manager_only" on public.inventory;
create policy "inventory_insert_manager_only" on public.inventory
  for insert with check (
    organization_id = public.current_org_id() and public.is_manager_or_admin()
  );

drop policy if exists "inventory_update_manager_only" on public.inventory;
create policy "inventory_update_manager_only" on public.inventory
  for update using (
    organization_id = public.current_org_id() and public.is_manager_or_admin()
  );

drop policy if exists "inventory_delete_manager_only" on public.inventory;
create policy "inventory_delete_manager_only" on public.inventory
  for delete using (
    organization_id = public.current_org_id() and public.is_manager_or_admin()
  );

-- NOTE: Employees still need to DECREMENT stock quantity automatically when they
-- complete a sale on the POS screen. Rather than widen the UPDATE policy (which
-- would let employees edit price/name too), the frontend calls the
-- `public.pos_decrement_stock()` function below, which runs with elevated
-- privileges and only ever touches quantity_on_hand.
drop function if exists public.pos_decrement_stock(uuid, integer);
create or replace function public.pos_decrement_stock(p_inventory_id uuid, p_qty integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.inventory where id = p_inventory_id;
  if v_org is null or v_org <> public.current_org_id() then
    raise exception 'Not authorized for this inventory item';
  end if;
  update public.inventory
    set quantity_on_hand = greatest(0, quantity_on_hand - p_qty),
        updated_at = now()
    where id = p_inventory_id;
end;
$$;

grant execute on function public.pos_decrement_stock(uuid, integer) to authenticated;

-- ---------------- DOCUMENTS ----------------
drop policy if exists "documents_select_same_org" on public.documents;
create policy "documents_select_same_org" on public.documents
  for select using (organization_id = public.current_org_id());

-- Both managers and employees may CREATE documents (receipts/quotes/invoices),
-- but only for their own organization and marked as created by themselves.
drop policy if exists "documents_insert_same_org" on public.documents;
create policy "documents_insert_same_org" on public.documents
  for insert with check (
    organization_id = public.current_org_id() and created_by = auth.uid()
  );

-- Only managers may edit/void a document after the fact (e.g. mark as paid).
drop policy if exists "documents_update_manager_only" on public.documents;
create policy "documents_update_manager_only" on public.documents
  for update using (
    organization_id = public.current_org_id() and public.is_manager_or_admin()
  );

drop policy if exists "documents_delete_manager_only" on public.documents;
create policy "documents_delete_manager_only" on public.documents
  for delete using (
    organization_id = public.current_org_id() and public.is_manager_or_admin()
  );

-- ---------------- WHATSAPP QUEUE ----------------
-- Only accessed by the Node backend using the service_role key, which bypasses
-- RLS entirely. We still lock it down for any authenticated client access.
drop policy if exists "whatsapp_select_same_org" on public.whatsapp_messages_queue;
create policy "whatsapp_select_same_org" on public.whatsapp_messages_queue
  for select using (
    organization_id = public.current_org_id() and public.is_manager_or_admin()
  );

drop policy if exists "whatsapp_insert_same_org" on public.whatsapp_messages_queue;
create policy "whatsapp_insert_same_org" on public.whatsapp_messages_queue
  for insert with check (organization_id = public.current_org_id());

-- ============================================================================
-- 8. AUTO-QUEUE A WHATSAPP MESSAGE WHENEVER A DOCUMENT IS CREATED
-- ============================================================================
-- This is what the Node backend's webhook endpoint listens for via Supabase's
-- "Database Webhooks" feature (Dashboard -> Database -> Webhooks), OR you can
-- rely on this trigger to pre-populate the queue and have the backend simply
-- poll/act on new 'pending' rows. We use the webhook approach in this build
-- (see backend/index.js), so this trigger just keeps the queue table populated
-- for record-keeping even if the webhook fails.
create or replace function public.queue_whatsapp_on_new_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_phone is not null and length(trim(new.customer_phone)) > 0 then
    insert into public.whatsapp_messages_queue (organization_id, document_id, to_phone, message_body, status)
    values (
      new.organization_id,
      new.id,
      new.customer_phone,
      'Thank you for your business! Your ' || new.doc_type || ' is ready: ' || coalesce(new.pdf_url, '(link pending)'),
      'pending'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_queue_whatsapp on public.documents;
create trigger trg_queue_whatsapp
  after insert on public.documents
  for each row execute function public.queue_whatsapp_on_new_document();

-- ============================================================================
-- 9. STORAGE BUCKET FOR GENERATED PDF DOCUMENTS
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

drop policy if exists "documents_bucket_read_public" on storage.objects;
create policy "documents_bucket_read_public" on storage.objects
  for select using (bucket_id = 'documents');

drop policy if exists "documents_bucket_write_authenticated" on storage.objects;
create policy "documents_bucket_write_authenticated" on storage.objects
  for insert with check (bucket_id = 'documents' and auth.role() = 'authenticated');

-- ============================================================================
-- DONE. Next steps:
--   1. Create your first organization + manager manually (see deployment guide),
--      OR sign up normally and promote yourself via SQL, e.g.:
--        insert into public.organizations (name) values ('My Company') returning id;
--        insert into public.profiles (id, organization_id, full_name, role)
--          values ('<auth-user-uuid>', '<organization-id>', 'Your Name', 'manager');
--   2. Copy your Project URL + anon key + service_role key into the frontend
--      and backend .env files (see DEPLOYMENT_GUIDE.md).
-- ============================================================================
