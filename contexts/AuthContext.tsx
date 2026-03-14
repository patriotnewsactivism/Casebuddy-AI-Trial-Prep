import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { User as SupabaseUser } from '@supabase/supabase-js';

export type SubscriptionPlan = 'free' | 'pro' | 'firm';

export interface UserUsage {
  cases_created: number;
  ai_generations_this_month: number;
  trial_sessions_this_month: number;
  last_reset_date: string;
}

interface User {
  id: string;
  email: string;
  fullName: string;
  firmName?: string;
  createdAt: string;
  plan: SubscriptionPlan;
  usage: UserUsage;
}

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, firmName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateUsage: (updates: Partial<UserUsage>) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const DEFAULT_USAGE: UserUsage = {
    cases_created: 0,
    ai_generations_this_month: 0,
    trial_sessions_this_month: 0,
    last_reset_date: new Date().toISOString()
  };

  useEffect(() => {
    // Check active sessions and sets up the listener
    const initAuth = async () => {
      try {
        if (!isSupabaseConfigured()) {
          console.warn('[Auth] Supabase not configured, skipping auth initialization');
          setSupabaseUser(null);
          setUser(null);
          return;
        }
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn('[Auth] Failed to get session:', sessionError.message);
        }
        setSupabaseUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user);
        }
      } catch (err) {
        console.error('[Auth] initAuth failed:', err);
        setSupabaseUser(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Add a safety timeout so loading never gets stuck
    const timeout = setTimeout(() => {
      setLoading((current) => {
        if (current) {
          console.warn('[Auth] Loading timed out after 10s, forcing complete');
          return false;
        }
        return current;
      });
    }, 10000);

    initAuth().finally(() => clearTimeout(timeout));

    let subscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setSupabaseUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user);
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      subscription = data.subscription;
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const fetchProfile = async (sUser: SupabaseUser) => {
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sUser.id)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          // Profile doesn't exist yet, create a default one
          const newProfile = {
            id: sUser.id,
            email: sUser.email || '',
            full_name: sUser.user_metadata?.full_name || sUser.email?.split('@')[0] || 'User',
            firm_name: sUser.user_metadata?.firm_name || '',
            preferences: { plan: 'free', usage: DEFAULT_USAGE }
          };
          
          const { error: insertError } = await supabase.from('profiles').insert(newProfile);
          if (insertError) throw insertError;
          
          setUser({
            id: sUser.id,
            email: sUser.email || '',
            fullName: newProfile.full_name,
            firmName: newProfile.firm_name,
            createdAt: sUser.created_at,
            plan: 'free',
            usage: DEFAULT_USAGE
          });
        } else {
          throw profileError;
        }
      } else {
        setUser({
          id: sUser.id,
          email: sUser.email || '',
          fullName: data.full_name,
          firmName: data.firm_name,
          createdAt: data.created_at,
          plan: (data.preferences?.plan as SubscriptionPlan) || 'free',
          usage: (data.preferences?.usage as UserUsage) || DEFAULT_USAGE
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      // Fallback to minimal user info if profile fetch fails
      setUser({
        id: sUser.id,
        email: sUser.email || '',
        fullName: sUser.user_metadata?.full_name || sUser.email?.split('@')[0] || 'User',
        createdAt: sUser.created_at,
        plan: 'free',
        usage: DEFAULT_USAGE
      });
    }
  };

  const updateUsage = async (updates: Partial<UserUsage>): Promise<void> => {
    if (!user || !supabaseUser) return;
    
    const newUsage = { ...user.usage, ...updates };
    const newPreferences = { plan: user.plan, usage: newUsage };
    
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ preferences: newPreferences })
        .eq('id', user.id);
        
      if (updateError) throw updateError;
      
      setUser({
        ...user,
        usage: newUsage
      });
    } catch (err) {
      console.error('Failed to update usage:', err);
      setError('Failed to update usage data');
    }
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, firmName?: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            firm_name: firmName || '',
          },
        },
      });
      if (signUpError) throw signUpError;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSupabaseUser(null);
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) throw resetError;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (newPassword: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (updateError) throw updateError;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update password';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  const value: AuthContextType = {
    user,
    supabaseUser,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateUsage,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
