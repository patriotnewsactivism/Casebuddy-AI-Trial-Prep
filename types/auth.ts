import { User, Session } from '@supabase/supabase-js';

export type UserRole = 'attorney' | 'paralegal' | 'admin' | 'user';
export type SubscriptionPlan = 'free' | 'pro' | 'firm';

export interface UserUsage {
  cases_created: number;
  ai_generations_this_month: number;
  trial_sessions_this_month: number;
  last_reset_date: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  firm_name: string | null;
  role: UserRole;
  plan: SubscriptionPlan;
  usage: UserUsage;
  preferences: UserPreferences | null;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultJurisdiction: string;
  notifications: NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  caseUpdates: boolean;
  trialReminders: boolean;
}

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  fullName?: string;
  firmName?: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface AuthContextType extends AuthState {
  signUp: (credentials: SignUpCredentials) => Promise<{ error: string | null }>;
  signIn: (credentials: SignInCredentials) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  clearError: () => void;
}

export interface AuthProviderProps {
  children: React.ReactNode;
}
