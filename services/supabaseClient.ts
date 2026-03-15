import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Public Supabase credentials (anon key is designed for client-side use with RLS)
// These can be overridden via environment variables
const DEFAULT_SUPABASE_URL = 'https://czrqlvvjrwizwdyefldo.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cnFsdnZqcndpendkeWVmbGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzA4NjYsImV4cCI6MjA4MTcwNjg2Nn0.XRrrK__fvHMqaLDq_oRF_8-VvNPb-Hz_D2CNL_Hmc2A';

const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const isValidConfig = supabaseUrl && supabaseAnonKey && isValidUrl(supabaseUrl);

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);

export const getSupabaseClient = (): SupabaseClient | null => {
  return isValidConfig ? supabase : null;
};

export const isSupabaseConfigured = (): boolean => isValidConfig;

export const getSupabaseUrl = (): string => supabaseUrl;
export const getSupabaseAnonKey = (): string => supabaseAnonKey;

// Direct auth functions that bypass the Supabase client's internal lock mechanism.
// The Supabase JS client uses navigator.locks to serialize auth operations.
// If getSession() hangs during init, it holds the lock and blocks all subsequent
// auth calls (signInWithPassword, signUp, etc.) indefinitely.

export const directSignIn = async (email: string, password: string): Promise<{ data: any; error: any }> => {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json();
    if (!response.ok) {
      return { data: null, error: { message: body.msg || body.error_description || body.message || 'Sign in failed', status: response.status } };
    }
    // Set the session on the Supabase client so subsequent operations work
    if (body.access_token) {
      await supabase.auth.setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });
    }
    return { data: body, error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error', status: 0 } };
  }
};

export const directSignUp = async (email: string, password: string, metadata?: Record<string, string>): Promise<{ data: any; error: any }> => {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ email, password, data: metadata || {} }),
    });
    const body = await response.json();
    if (!response.ok) {
      return { data: null, error: { message: body.msg || body.error_description || body.message || 'Sign up failed', status: response.status } };
    }
    // Set the session if auto-confirmed
    if (body.access_token) {
      await supabase.auth.setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });
    }
    return { data: body, error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error', status: 0 } };
  }
};

// Health check to detect unreachable/paused Supabase projects
let healthStatus: 'unknown' | 'reachable' | 'unreachable' = 'unknown';

export const checkSupabaseHealth = async (): Promise<boolean> => {
  if (!isValidConfig) {
    healthStatus = 'unreachable';
    return false;
  }
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    healthStatus = response.ok || response.status === 400 ? 'reachable' : 'unreachable';
    return healthStatus === 'reachable';
  } catch {
    healthStatus = 'unreachable';
    return false;
  }
};

export const getHealthStatus = (): string => healthStatus;

export const translateAuthError = (message: string): string => {
  if (healthStatus === 'unreachable') {
    return 'Unable to connect to the authentication service. The server may be temporarily unavailable. Please try again later.';
  }

  const errorMap: Record<string, string> = {
    'Invalid login credentials': 'Incorrect email or password. Please try again or create a new account.',
    'Email not confirmed': 'Your email address has not been verified. Please check your inbox for a verification link.',
    'User already registered': 'An account with this email already exists. Please sign in instead.',
    'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
    'Unable to validate email address: invalid format': 'Please enter a valid email address.',
    'Signups not allowed for this instance': 'New account registration is currently disabled.',
    'Email rate limit exceeded': 'Too many attempts. Please wait a few minutes before trying again.',
  };

  for (const [key, friendly] of Object.entries(errorMap)) {
    if (message.includes(key)) return friendly;
  }

  if (message.includes('fetch') || message.includes('network') || message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Unable to connect to the authentication service. Please check your internet connection and try again.';
  }

  return message;
};
