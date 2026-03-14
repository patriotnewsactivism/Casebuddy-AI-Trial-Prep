import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

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
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
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
