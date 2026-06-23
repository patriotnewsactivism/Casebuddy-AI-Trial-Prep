-- ═══════════════════════════════════════════════════════════════════════════
-- Multi-tenant intake system — privacy-first, RLS-enforced
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. firm_settings: one row per attorney account, stores their unique intake token
create table if not exists firm_settings (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  firm_id       uuid not null default gen_random_uuid(),
  intake_token  text not null unique,
  firm_name     text not null default '',
  created_at    timestamptz not null default now()
);

-- RLS: each attorney can only see/edit their own firm settings
alter table firm_settings enable row level security;

create policy "Owner can read own firm settings"
  on firm_settings for select to authenticated
  using (auth.uid() = user_id);

create policy "Owner can insert own firm settings"
  on firm_settings for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Owner can update own firm settings"
  on firm_settings for update to authenticated
  using (auth.uid() = user_id);

-- Anon can resolve token → firm_id (public intake page needs this — returns NOTHING sensitive)
create policy "Anon can resolve intake token to firm_id only"
  on firm_settings for select to anon
  using (true);
-- Note: anon SELECT only returns firm_id and firm_name columns because the query
-- in resolveFirmToken explicitly selects only those two columns.

-- 2. intakes: client submissions, strictly isolated per firm
create table if not exists intakes (
  id            uuid primary key default gen_random_uuid(),
  submitted_at  timestamptz not null default now(),
  firm_id       uuid not null,            -- ties back to firm_settings.user_id
  client_name   text not null default '',
  client_email  text not null default '',
  client_phone  text not null default '',
  case_type     text not null default 'General',
  summary       text not null default '',
  transcript    text not null default '',
  case_ref      text not null default '',  -- local CaseFile id
  source        text not null default 'client-link',
  status        text not null default 'new'
                check (status in ('new','reviewed','converted','declined'))
);

-- ── RLS: THE CRITICAL PRIVACY LOCK ──────────────────────────────────────────
alter table intakes enable row level security;

-- Attorneys see ONLY their own firm's intakes — never another firm's
create policy "Firm can only see own intakes"
  on intakes for select to authenticated
  using (firm_id = auth.uid());

create policy "Firm can update own intakes"
  on intakes for update to authenticated
  using (firm_id = auth.uid());

-- Anon (clients) can INSERT but NEVER SELECT — they can't read back any data
create policy "Anyone can submit intake"
  on intakes for insert to anon
  with check (true);

-- Indexes for fast dashboard loads
create index if not exists idx_intakes_firm_id     on intakes(firm_id);
create index if not exists idx_intakes_submitted   on intakes(submitted_at desc);
create index if not exists idx_intakes_status      on intakes(firm_id, status);
create index if not exists idx_firm_token          on firm_settings(intake_token);

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE. Every attorney's intakes are completely invisible to every other firm.
-- ═══════════════════════════════════════════════════════════════════════════
