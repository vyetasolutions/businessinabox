-- ============================================================================
-- VYETA BUSINESS HUB — MIGRATION 006: DOCUMENT INTELLIGENCE (OCR)
-- ============================================================================
-- Run this in Supabase SQL Editor AFTER migration 005.
--
-- Adds one unified table for two related but different pipelines:
--   1. Structured: receipts/invoices/delivery notes a business RECEIVES
--      (e.g. from a supplier) → OCR'd → fields guessed → reviewed by the
--      Manager → optionally committed into the existing `expenses` table.
--   2. Unstructured: contracts/certificates → text extracted (natively from
--      PDF/DOCX where possible, OCR only as a fallback for scanned images)
--      → stored and made searchable in a simple document vault. No field
--      guessing attempted here — there's no "total" in a lease agreement.
-- ============================================================================

create table if not exists public.document_uploads (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  branch_id         uuid references public.branches(id) on delete set null,
  uploaded_by       uuid references public.profiles(id),
  category          text not null check (category in ('receipt', 'invoice', 'delivery_note', 'contract', 'certificate', 'other')),
  pipeline          text not null check (pipeline in ('structured', 'vault')),
  title             text,
  file_path         text not null,       -- path inside the private 'uploads' storage bucket
  file_type         text,                -- mime type, used to pick the extraction method
  status            text not null default 'queued'
    check (status in ('queued', 'processing', 'needs_review', 'completed', 'failed')),
  extraction_method text,               -- 'native-pdf' | 'native-docx' | 'ocr' | 'ocr-fallback' — only 'ocr'/'ocr-fallback' cost an API call, used for the monthly usage cap
  extracted_text    text,                -- full raw text (vault pipeline: what gets searched)
  extracted_fields  jsonb,               -- structured pipeline: {vendor, date, total, items[]}
  error_message     text,
  linked_expense_id uuid references public.expenses(id) on delete set null,
  created_at        timestamptz not null default now(),
  processed_at      timestamptz
);

create index if not exists idx_document_uploads_org on public.document_uploads(organization_id, created_at desc);

-- Full-text search over extracted_text, for the Document Vault search box
create index if not exists idx_document_uploads_text_search
  on public.document_uploads using gin (to_tsvector('english', coalesce(extracted_text, '')));

alter table public.document_uploads enable row level security;

drop policy if exists "document_uploads_select_same_org" on public.document_uploads;
create policy "document_uploads_select_same_org" on public.document_uploads
  for select using (organization_id = public.current_org_id() and public.is_manager_or_admin());

drop policy if exists "document_uploads_insert_gated" on public.document_uploads;
create policy "document_uploads_insert_gated" on public.document_uploads
  for insert with check (
    organization_id = public.current_org_id()
    and public.is_manager_or_admin()
    and public.plan_allows('ocr_scanning')
    and uploaded_by = auth.uid()
  );

drop policy if exists "document_uploads_delete_manager_only" on public.document_uploads;
create policy "document_uploads_delete_manager_only" on public.document_uploads
  for delete using (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- The backend (service_role) is what actually updates status/extracted_fields
-- after processing — no client-side UPDATE policy is needed or granted, so a
-- browser can never fake a "completed" OCR result for itself.

-- ----------------------------------------------------------------------------
-- Extend the plan-gating function from migration 004 with the new feature
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
    when 'ocr_scanning'     then plan = 'business_plus'
    else false
  end
  from public.organizations where id = public.current_org_id();
$$;

-- ----------------------------------------------------------------------------
-- Private storage bucket for uploaded source files (receipts, contracts,
-- etc.). Unlike `documents` and `branding`, this is NOT public — these are
-- a business's own paperwork, so access is scoped per-organization via a
-- folder-prefix convention: files must be uploaded to `{organization_id}/...`
-- and the storage policy checks that prefix against the caller's own org.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

drop policy if exists "uploads_bucket_rw_same_org" on storage.objects;
create policy "uploads_bucket_rw_same_org" on storage.objects
  for all using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  )
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

-- ============================================================================
-- DONE. See PLATFORM_DOCUMENTATION.md for the extraction pipeline design and
-- honest limitations, and the backend .env.example for the OCR_SPACE_API_KEY
-- needed to activate this feature.
-- ============================================================================
