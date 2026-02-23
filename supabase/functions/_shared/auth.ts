import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

// Check if we're in development mode (allow anonymous access)
const isDevelopment = Deno.env.get('ALLOW_ANONYMOUS_ACCESS') === 'true' || 
  !Deno.env.get('SUPABASE_URL') ||
  Deno.env.get('DENO_DEPLOYMENT_ID') === undefined;

/**
 * Validate authentication - optionally allows anonymous access in development
 */
export async function validateAuth(authHeader: string | null): Promise<AuthUser> {
  // In development mode, allow anonymous access
  if (isDevelopment && !authHeader) {
    console.log('[Auth] Development mode - allowing anonymous access');
    return {
      id: 'anonymous',
      email: 'anonymous@localhost',
      role: 'user',
    };
  }

  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    throw new Error('Invalid Authorization header format');
  }

  // If no Supabase configured, return anonymous user
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('[Auth] No Supabase configured - returning anonymous user');
    return {
      id: 'anonymous',
      email: 'anonymous@localhost',
      role: 'user',
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('[Auth] Token validation error:', error);
      throw new Error('Invalid or expired token');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role,
    };
  } catch (error) {
    console.error('[Auth] Auth error:', error);
    
    // In development, allow fallback to anonymous
    if (isDevelopment) {
      console.log('[Auth] Development mode - falling back to anonymous');
      return {
        id: 'anonymous',
        email: 'anonymous@localhost',
        role: 'user',
      };
    }
    
    throw error;
  }
}

/**
 * Validate auth but don't throw - return null on failure
 */
export async function optionalAuth(authHeader: string | null): Promise<AuthUser | null> {
  try {
    return await validateAuth(authHeader);
  } catch {
    return null;
  }
}

export async function getAdminClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase not configured');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
