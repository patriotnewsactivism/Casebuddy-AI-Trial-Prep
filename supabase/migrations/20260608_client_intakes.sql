-- client_intakes table for public intake submissions
create table if not exists client_intakes (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  submitted_at  timestamptz default now(),
  case_type     text not null,
  client_name   text,
  client_email  text,
  client_phone  text,
  summary       text,
  status        text default 'new' check (status in ('new','reviewed','converted','declined')),
  answers       jsonb default '{}',
  transcript    jsonb default '[]'
);

-- Allow public (anon) inserts for client submissions
alter table client_intakes enable row level security;

create policy "Anyone can submit intake"
  on client_intakes for insert
  to anon
  with check (true);

create policy "Authenticated users can view and update intakes"
  on client_intakes for select
  to authenticated
  using (true);

create policy "Authenticated users can update intake status"
  on client_intakes for update
  to authenticated
  using (true);

-- Index for fast inbox loading
create index if not exists idx_intakes_submitted on client_intakes(submitted_at desc);
create index if not exists idx_intakes_status    on client_intakes(status);
