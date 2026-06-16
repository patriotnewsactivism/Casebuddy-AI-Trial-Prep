import React, { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Scale, Loader2, ShieldAlert, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth, authConfigured, signIn, signUp, resetPassword, updatePassword, clearPasswordRecovery } from '../lib/authStore';

type Mode = 'signin' | 'signup' | 'reset';

// The firm's front door. Everything past this point (the case file, every
// agent module) requires a session — only the public marketing page and the
// client intake link (/start) are reachable without logging in.
export default function Login() {
  const { session, loading, passwordRecovery } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-violet-400" size={28} />
      </div>
    );
  }

  // Supabase establishes a session straight from the reset-password email
  // link and fires PASSWORD_RECOVERY — catch it here before the generic
  // "session exists -> go to dashboard" redirect below, otherwise the user
  // never gets a chance to actually set their new password.
  if (passwordRecovery) {
    const submitNewPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setBusy(true);
      const err = await updatePassword(newPassword);
      setBusy(false);
      if (err) setError(err);
      else clearPasswordRecovery();
    };

    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="relative w-full max-w-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-2xl shadow-black/40">
            <h1 className="text-white font-bold text-xl mb-1 text-center">Set a new password</h1>
            <p className="text-slate-500 text-xs text-center mb-6">You followed a password reset link — choose a new password to finish.</p>
            <form onSubmit={submitNewPassword} className="space-y-3">
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="password" autoComplete="new-password" required minLength={8}
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password (min 8 characters)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" />
              </div>
              {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={busy}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:opacity-90 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-opacity">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <>Update password <ArrowRight size={14} /></>}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (session) {
    const from = (location.state as any)?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!email.trim() || (mode !== 'reset' && !password)) return;
    setBusy(true);
    if (mode === 'signin') {
      const err = await signIn(email.trim(), password);
      if (err) setError(err);
    } else if (mode === 'signup') {
      const { error: err, needsEmailConfirm } = await signUp(email.trim(), password);
      if (err) setError(err);
      else if (needsEmailConfirm) setNotice('Account created — check your email to confirm before signing in.');
    } else {
      const err = await resetPassword(email.trim());
      if (err) setError(err);
      else setNotice('Password reset email sent — check your inbox.');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-20 right-0 w-[28rem] h-[28rem] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <Scale size={22} className="text-violet-400" />
          <span className="font-black text-lg tracking-tight">CaseBuddy <span className="text-violet-400">AI</span></span>
        </Link>

        {!authConfigured ? (
          <div className="bg-slate-900 border border-yellow-700/50 rounded-2xl p-6 text-center">
            <ShieldAlert size={28} className="text-yellow-400 mx-auto mb-3" />
            <h1 className="text-white font-bold text-lg mb-2">Authentication not configured</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              This deployment is missing <code className="text-slate-300">REACT_APP_SUPABASE_URL</code> /
              <code className="text-slate-300"> REACT_APP_SUPABASE_ANON_KEY</code>. The firm's case file is locked
              until an administrator sets these in Vercel and configures Supabase Auth — see CLAUDE.md.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-2xl shadow-black/40">
            <h1 className="text-white font-bold text-xl mb-1 text-center">
              {mode === 'signin' ? 'Sign in to the firm' : mode === 'signup' ? 'Create your firm account' : 'Reset your password'}
            </h1>
            <p className="text-slate-500 text-xs text-center mb-6">
              {mode === 'reset' ? "We'll email you a reset link." : 'Your case file, agents, and history live behind this login.'}
            </p>

            <form onSubmit={submit} className="space-y-3">
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@yourfirm.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" />
              </div>
              {mode !== 'reset' && (
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required
                    minLength={mode === 'signup' ? 8 : undefined}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Create a password (min 8 characters)' : 'Password'}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" />
                </div>
              )}

              {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
              {notice && <p className="text-green-400 text-xs bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">{notice}</p>}

              <button type="submit" disabled={busy}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:opacity-90 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-opacity">
                {busy ? <Loader2 size={16} className="animate-spin" /> : (
                  <>{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'} <ArrowRight size={14} /></>
                )}
              </button>
            </form>

            <div className="flex items-center justify-between mt-5 text-xs text-slate-500">
              {mode === 'signin' ? (
                <>
                  <button onClick={() => { setMode('signup'); setError(''); setNotice(''); }} className="hover:text-slate-300">Create an account</button>
                  <button onClick={() => { setMode('reset'); setError(''); setNotice(''); }} className="hover:text-slate-300">Forgot password?</button>
                </>
              ) : (
                <button onClick={() => { setMode('signin'); setError(''); setNotice(''); }} className="hover:text-slate-300 mx-auto">← Back to sign in</button>
              )}
            </div>
          </div>
        )}

        <p className="text-slate-600 text-xs text-center mt-6">
          Client? Use your firm's intake link instead — no account needed.
        </p>
      </div>
    </div>
  );
}
