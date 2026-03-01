import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('casebuddy_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('casebuddy_user');
      }
    }
    setLoading(false);
  }, []);

  const updateUsage = async (updates: Partial<UserUsage>): Promise<void> => {
    if (!user) return;
    const newUser = {
      ...user,
      usage: { ...user.usage, ...updates }
    };
    setUser(newUser);
    localStorage.setItem('casebuddy_user', JSON.stringify(newUser));
    
    // Also update in users list
    const storedUsers = localStorage.getItem('casebuddy_users');
    if (storedUsers) {
      const users: User[] = JSON.parse(storedUsers);
      const index = users.findIndex(u => u.id === user.id);
      if (index !== -1) {
        users[index] = newUser;
        localStorage.setItem('casebuddy_users', JSON.stringify(users));
      }
    }
  };

  const DEFAULT_USAGE: UserUsage = {
    cases_created: 0,
    ai_generations_this_month: 0,
    trial_sessions_this_month: 0,
    last_reset_date: new Date().toISOString()
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      if (password.length < 6) {
        throw new Error('Invalid email or password');
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }
      
      const storedUsers = localStorage.getItem('casebuddy_users');
      const users: User[] = storedUsers ? JSON.parse(storedUsers) : [];
      const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (!existingUser) {
        const mockUser: User = {
          id: crypto.randomUUID ? crypto.randomUUID() : `user_${Date.now()}`,
          email,
          fullName: email.split('@')[0],
          createdAt: new Date().toISOString(),
          plan: 'free',
          usage: DEFAULT_USAGE
        };
        setUser(mockUser);
        localStorage.setItem('casebuddy_user', JSON.stringify(mockUser));
      } else {
        setUser(existingUser);
        localStorage.setItem('casebuddy_user', JSON.stringify(existingUser));
      }
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!email || !password || !fullName) {
        throw new Error('All required fields must be filled');
      }
      
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }
      
      const storedUsers = localStorage.getItem('casebuddy_users');
      const users: User[] = storedUsers ? JSON.parse(storedUsers) : [];
      
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('An account with this email already exists');
      }
      
      const newUser: User = {
        id: crypto.randomUUID ? crypto.randomUUID() : `user_${Date.now()}`,
        email,
        fullName,
        firmName,
        createdAt: new Date().toISOString(),
        plan: 'free',
        usage: DEFAULT_USAGE
      };
      
      users.push(newUser);
      localStorage.setItem('casebuddy_users', JSON.stringify(users));
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
      await new Promise(resolve => setTimeout(resolve, 300));
      localStorage.removeItem('casebuddy_user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      if (!email) {
        throw new Error('Email is required');
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }
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
      await new Promise(resolve => setTimeout(resolve, 800));
      
      if (!newPassword || newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }
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
