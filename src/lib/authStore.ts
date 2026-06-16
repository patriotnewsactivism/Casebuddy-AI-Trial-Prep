// CaseBuddy AI — firm login.
// Every attorney/staff member at the firm authenticates with Supabase Auth
// before they can reach the case file (RequireAuth in App.tsx gates the
// whole <AppShell>). Case data itself stays one shared pool for the firm —
// this is account security (keep the case file out of strangers' hands),
// not per-seat multi-tenancy.

import { useSyncExternalStore } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabaseClient';

export const authConfigured = supabaseConfigured;

let session: Session | null = null;
let loading = supabaseConfigured; // if Supabase isn't configured there's nothing to load
// Set when Supabase fires the PASSWORD_RECOVERY auth event (user followed a
// reset-password email link). Login.tsx must show the "set a new password"
// form instead of redirecting a recovery session straight to the dashboard.
let passwordRecovery = false;
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version++;
  listeners.forEach(l => l());
}

if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    session = data.session;
    loading = false;
    notify();
  });
  supabase.auth.onAuthStateChange((event, newSession) => {
    session = newSession;
    loading = false;
    if (event === 'PASSWORD_RECOVERY') passwordRecovery = true;
    notify();
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

function useStoreVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

export function useAuth(): { session: Session | null; user: User | null; loading: boolean; passwordRecovery: boolean } {
  useStoreVersion();
  return { session, user: session?.user ?? null, loading, passwordRecovery };
}

// Called once the user has successfully set a new password from the
// recovery form, so Login.tsx falls back to the normal session redirect.
export function clearPasswordRecovery(): void {
  passwordRecovery = false;
  notify();
}

export function getSession(): Session | null {
  return session;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Authentication is not configured for this deployment.';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

export async function signUp(email: string, password: string): Promise<{ error: string | null; needsEmailConfirm: boolean }> {
  if (!supabase) return { error: 'Authentication is not configured for this deployment.', needsEmailConfirm: false };
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message, needsEmailConfirm: false };
  return { error: null, needsEmailConfirm: !data.session };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function resetPassword(email: string): Promise<string | null> {
  if (!supabase) return 'Authentication is not configured for this deployment.';
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/login',
  });
  return error ? error.message : null;
}

export async function updatePassword(newPassword: string): Promise<string | null> {
  if (!supabase) return 'Authentication is not configured for this deployment.';
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error ? error.message : null;
}
