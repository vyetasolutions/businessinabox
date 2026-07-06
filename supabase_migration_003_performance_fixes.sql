-- ============================================================================
-- VYETA BUSINESS HUB — MIGRATION 003: SEARCH PERFORMANCE FIX
-- ============================================================================
-- Run this in Supabase SQL Editor AFTER migration 002.
--
-- WHY: the original schema indexed inventory.name with a GIN index over
-- to_tsvector(name), intended for full-text search. But the app actually
-- searches with `ilike '%term%'` (partial substring match, e.g. typing
-- "ric" to find "Rice"), which that index type cannot accelerate at all.
-- Every stock search was silently doing a full table scan. This fixes it
-- with a trigram index, the correct index type for ILIKE partial matches.
-- ============================================================================

create extension if not exists pg_trgm;

drop index if exists public.idx_inventory_name;

create index if not exists idx_inventory_name_trgm
  on public.inventory using gin (name gin_trgm_ops);

-- Same fix for searching documents by customer name (used on the Customers
-- page as data grows beyond what fits in a single fetch).
create index if not exists idx_documents_customer_trgm
  on public.documents using gin (customer_name gin_trgm_ops);
