// intakeStore.ts — Multi-tenant intake token management
// ─────────────────────────────────────────────────────────────────────────────
// Every firm gets ONE permanent intake_token (a short random slug).
// Their public link is: casebuddy.live/start/<token>
//
// Security model:
//   • The token is stored in Supabase `firm_settings` table, keyed by auth user id
//   • Public intake page resolves token → firm_id (read-only, anon key)
//   • Every submitted intake is tagged with firm_id
//   • RLS policy: attorneys can only SELECT intakes WHERE firm_id = their firm_id
//   • No cross-firm data leakage is possible at the DB level regardless of UI

import { supabase } from './supabaseClient';
import { getSession } from './authStore';

// ── Firm settings row shape ───────────────────────────────────────────────────
export interface FirmSettings {
  user_id:       string;   // owner's Supabase auth uid
  firm_id:       string;   // same as user_id (1 user = 1 firm for now)
  intake_token:  string;   // public URL slug  e.g. "abc123"
  firm_name:     string;
  created_at:    string;
}

// ── Generate a short random token (8 chars, url-safe) ────────────────────────
function generateToken(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'; // no ambiguous chars
  let t = '';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  arr.forEach(b => { t += chars[b % chars.length]; });
  return t;
}

// ── Get or create this firm's settings row ────────────────────────────────────
export async function getOrCreateFirmSettings(): Promise<FirmSettings | null> {
  if (!supabase) return null;
  const session = getSession();
  if (!session?.user) return null;
  const uid = session.user.id;

  // Try to load existing
  const { data, error } = await supabase
    .from('firm_settings')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle();

  if (data) return data as FirmSettings;

  // First login — create the row with a fresh token
  const token = generateToken();
  const { data: created, error: createErr } = await supabase
    .from('firm_settings')
    .insert({
      user_id:      uid,
      firm_id:      uid,
      intake_token: token,
      firm_name:    '',
    })
    .select()
    .single();

  if (createErr) {
    console.error('[intakeStore] create firm_settings failed:', createErr);
    return null;
  }
  return created as FirmSettings;
}

// ── Resolve a public token → firm_id (called from public intake page) ─────────
// Uses anon key — no auth needed, but only returns firm_id (nothing sensitive)
export async function resolveFirmToken(token: string): Promise<{ firm_id: string; firm_name: string } | null> {
  if (!supabase || !token) return null;
  const { data, error } = await supabase
    .from('firm_settings')
    .select('firm_id, firm_name')
    .eq('intake_token', token)
    .maybeSingle();
  if (error || !data) return null;
  return data as { firm_id: string; firm_name: string };
}

// ── Save an intake submission tagged to a firm ─────────────────────────────────
export interface IntakeSubmission {
  firm_id:      string;
  client_name:  string;
  client_email: string;
  client_phone: string;
  case_type:    string;
  summary:      string;
  transcript:   string;     // full Maya conversation
  case_ref:     string;     // the CaseFile id
  source:       'client-link' | 'attorney';
}

export async function saveIntakeSubmission(s: IntakeSubmission): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('intakes')
    .insert({
      firm_id:      s.firm_id,
      client_name:  s.client_name,
      client_email: s.client_email  || '',
      client_phone: s.client_phone  || '',
      case_type:    s.case_type     || 'General',
      summary:      s.summary       || '',
      transcript:   s.transcript    || '',
      case_ref:     s.case_ref,
      source:       s.source,
      status:       'new',
      submitted_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) { console.error('[intakeStore] save failed:', error); return null; }
  return data?.id ?? null;
}

// ── Load all intakes for the current firm (attorney dashboard) ────────────────
export async function loadFirmIntakes(): Promise<any[]> {
  if (!supabase) return [];
  const session = getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('intakes')
    .select('*')
    .eq('firm_id', session.user.id)
    .order('submitted_at', { ascending: false });

  if (error) { console.error('[intakeStore] load failed:', error); return []; }
  return data || [];
}

// ── Update intake status ──────────────────────────────────────────────────────
export async function updateIntakeStatus(
  id: string,
  status: 'new' | 'reviewed' | 'converted' | 'declined'
): Promise<void> {
  if (!supabase) return;
  await supabase.from('intakes').update({ status }).eq('id', id);
}
