// CaseBuddy AI — Supabase Cloud Sync
// Best-effort mirror of the case store. localStorage stays the source of
// truth for the running app; this layer pushes every change to Supabase and
// pulls remote cases on startup (newer updatedAt wins per case). If Supabase
// isn't configured or the table doesn't exist, every call silently no-ops.
//
// Required table (run once in the Supabase SQL editor):
//   create table if not exists case_files (
//     id text primary key,
//     data jsonb not null,
//     updated_at timestamptz not null
//   );
//   alter table case_files enable row level security;
//   create policy "anon read/write case_files" on case_files
//     for all using (true) with check (true);

import { supabase, isCloudEnabled } from './supabase';
import type { CaseFile } from './caseStore';

const TABLE = 'case_files';
let pushTimer: ReturnType<typeof setTimeout> | null = null;

// Debounced so rapid mutations (e.g. intake handoffs) become one upsert.
export function schedulePush(cases: CaseFile[]) {
  if (!isCloudEnabled) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { void pushCases(cases); }, 1500);
}

export async function pushCases(cases: CaseFile[]): Promise<void> {
  if (!supabase || cases.length === 0) return;
  try {
    await supabase.from(TABLE).upsert(
      cases.map(c => ({ id: c.id, data: c, updated_at: c.updatedAt })),
      { onConflict: 'id' }
    );
  } catch {
    // Offline, table missing, or RLS denied — local store is still intact.
  }
}

export async function pullCases(): Promise<CaseFile[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from(TABLE).select('data');
    if (error || !data) return null;
    return data.map((row: { data: CaseFile }) => row.data).filter(c => c && c.id);
  } catch {
    return null;
  }
}

export async function deleteCaseRemote(id: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from(TABLE).delete().eq('id', id);
  } catch {
    // Best effort only.
  }
}

// Merge remote cases into a local list: union by id, newer updatedAt wins.
export function mergeCases(local: CaseFile[], remote: CaseFile[]): CaseFile[] {
  const byId = new Map<string, CaseFile>();
  for (const c of local) byId.set(c.id, c);
  for (const r of remote) {
    const l = byId.get(r.id);
    if (!l || new Date(r.updatedAt) > new Date(l.updatedAt)) byId.set(r.id, r);
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
