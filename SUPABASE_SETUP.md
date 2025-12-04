# Supabase Setup (Cases + Evidence)

Use this guide to enable cloud persistence. The app falls back to localStorage when Supabase is not configured.

## 1) Create a project and get keys
- In Supabase, create a project and grab `Project URL` and `anon` key.
- Add to `.env.local` (Vite injects as `process.env.SUPABASE_URL` / `process.env.SUPABASE_ANON_KEY`):
  ```
  SUPABASE_URL=https://your-project-id.supabase.co
  SUPABASE_ANON_KEY=your_anon_key_here
  ```

## 2) Tables
Create a single JSON-friendly table to keep the client-side shapes intact:
```sql
create table public.cases (
  id text primary key,
  title text,
  client text,
  status text,
  opposingCounsel text,
  judge text,
  nextCourtDate text,
  summary text,
  winProbability numeric,
  tags jsonb,
  evidence jsonb,
  tasks jsonb
);
```
Indexes (optional):
```sql
create index on public.cases ((lower(title)));
create index on public.cases ((lower(client)));
```

## 3) RLS policies
Enable RLS and allow anon CRUD (or tighten to your auth model):
```sql
alter table public.cases enable row level security;
create policy "public read" on public.cases for select using (true);
create policy "public insert" on public.cases for insert with check (true);
create policy "public update" on public.cases for update using (true);
create policy "public delete" on public.cases for delete using (true);
```
Lock down further if you add Auth; swap `true` with user/tenant checks.

## 4) Notes
- Evidence and tasks are stored as JSON arrays; no extra tables required.
- The app optimistically caches to localStorage even when Supabase is on, so you can work offline and keep a warm cache.
- If Supabase errors, the UI keeps local state and logs to console; refresh after fixing keys or policies.
