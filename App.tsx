import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, BrainCircuit, Gavel, Settings as SettingsIcon, Menu, X, Mic, FileAudio, Calculator, FileSearch, BookOpen, Target, BarChart2, Handshake, Scale, FolderOpen, ChevronDown, ChevronRight, LogOut, Shield, ScanLine, Sparkles, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { KnowledgeProvider } from './contexts/KnowledgeContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
const LoginPage = lazy(() => import('./components/auth/LoginPage'));
const SignupPage = lazy(() => import('./components/auth/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./components/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./components/auth/ResetPasswordPage'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const CaseManager = lazy(() => import('./components/CaseManager'));
const WitnessLab = lazy(() => import('./components/WitnessLab'));
const StrategyRoom = lazy(() => import('./components/StrategyRoom'));
const ArgumentPractice = lazy(() => import('./components/ArgumentPractice'));
const LandingPage = lazy(() => import('./components/LandingPage'));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./components/TermsOfService'));
const Transcriber = lazy(() => import('./components/Transcriber'));
const DraftingAssistant = lazy(() => import('./components/DraftingAssistant'));
const SettingsPage = lazy(() => import('./components/Settings'));
const SettlementCalculator = lazy(() => import('./components/SettlementCalculator'));
const DiscoveryManager = lazy(() => import('./components/DiscoveryManager'));
const CaseLawResearch = lazy(() => import('./components/CaseLawResearch'));
const EvidenceAdmissibility = lazy(() => import('./components/EvidenceAdmissibility'));
const PerformanceAnalytics = lazy(() => import('./components/PerformanceAnalytics'));
const DepositionOutlineGenerator = lazy(() => import('./components/DepositionOutlineGenerator'));
const NegotiationSimulator = lazy(() => import('./components/NegotiationSimulator'));
const EvidenceTimeline = lazy(() => import('./components/EvidenceTimeline'));
const MockJury = lazy(() => import('./components/MockJury'));
const PublicRecordsManager = lazy(() => import('./components/PublicRecordsManager'));
const OfficerDatabase = lazy(() => import('./components/OfficerDatabase'));
const AICoCounsel = lazy(() => import('./components/AICoCounsel'));
const DiscoveryLens = lazy(() => import('./components/DiscoveryLens'));
import { MOCK_CASES } from './constants';
import { Case, EvidenceItem } from './types';
import { loadActiveCaseId, loadPreferences, saveActiveCaseId, saveCases, savePreferences } from './utils/storage';
import { appendEvidence, fetchCases, removeCase, supabaseReady, upsertCase } from './services/dataService';
import ErrorBoundary from './components/ErrorBoundary';

const Sidebar = ({ isOpen, setIsOpen, syncStatus, retrySync }: { isOpen: boolean, setIsOpen: (v: boolean) => void, syncStatus: 'synced' | 'syncing' | 'error', retrySync: () => void }) => {
  const location = useLocation();
  const [showTools, setShowTools] = useState(true);
  const [showPrep, setShowPrep] = useState(true);

  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ path, icon: Icon, label }: { path: string, icon: any, label: string }) => (
    <Link
      to={path}
      onClick={() => setIsOpen(false)}
      className={`flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg transition-all duration-150 text-sm
        ${isActive(path)
          ? 'bg-slate-800 text-gold-500 font-medium'
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
    >
      <Icon size={15} className="shrink-0" />
      <span>{label}</span>
    </Link>
  );

  const NavGroup = ({ title, icon: Icon, isOpen: open, toggle, children }: { title: string; icon: any; isOpen: boolean; toggle: () => void; children: React.ReactNode }) => (
    <div>
      <button
        onClick={toggle}
        className="flex items-center justify-between w-full mx-2 px-3 py-2 text-slate-500 hover:text-slate-300 transition-colors rounded-lg"
        style={{ width: 'calc(100% - 1rem)' }}
      >
        <div className="flex items-center gap-2">
          <Icon size={13} />
          <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
        </div>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && <div className="mt-0.5 space-y-0.5">{children}</div>}
    </div>
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-slate-950 border-r border-slate-800/80
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-slate-800">
          <Link to="/app" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-gold-500/15 border border-gold-500/30 flex items-center justify-center">
              <Gavel size={14} className="text-gold-500" />
            </div>
            <span className="text-base font-serif font-bold text-white">CaseBuddy</span>
          </Link>
          <button className="ml-auto md:hidden text-slate-400 hover:text-white" onClick={() => setIsOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="py-3 flex flex-col overflow-y-auto h-[calc(100vh-3.5rem)] space-y-0.5">
          {/* AI Co-Counsel — featured */}
          <div className="px-2 pb-2">
            <Link
              to="/app/ai-counsel"
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 border
                ${isActive('/app/ai-counsel')
                  ? 'bg-gold-500/10 border-gold-500/30 text-gold-400'
                  : 'bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600 hover:text-white'}`}
            >
              <div className={`p-1.5 rounded-lg ${isActive('/app/ai-counsel') ? 'bg-gold-500/20' : 'bg-slate-700'}`}>
                <Scale size={14} className={isActive('/app/ai-counsel') ? 'text-gold-400' : 'text-slate-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-none">AI Co-Counsel</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">Your AI law partner</p>
              </div>
              {isActive('/app/ai-counsel') && (
                <div className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-pulse shrink-0" />
              )}
            </Link>
          </div>

          <div className="border-t border-slate-800/60 pt-2" />

          <NavItem path="/app" icon={LayoutDashboard} label="Dashboard" />
          <NavItem path="/app/cases" icon={Gavel} label="Case Files" />

          <div className="pt-1" />
          <NavGroup title="Trial Preparation" icon={FolderOpen} isOpen={showPrep} toggle={() => setShowPrep(!showPrep)}>
            <NavItem path="/app/practice" icon={Mic} label="Trial Simulator" />
            <NavItem path="/app/witness-lab" icon={Users} label="Witness Lab" />
            <NavItem path="/app/mock-jury" icon={Scale} label="Mock Jury" />
            <NavItem path="/app/deposition" icon={FileText} label="Deposition Outlines" />
            <NavItem path="/app/performance" icon={BarChart2} label="Performance" />
          </NavGroup>

          <div className="pt-1" />
          <NavGroup title="Tools" icon={BrainCircuit} isOpen={showTools} toggle={() => setShowTools(!showTools)}>
            <NavItem path="/app/strategy" icon={BrainCircuit} label="Strategy & AI" />
            <NavItem path="/app/discovery-lens" icon={ScanLine} label="DiscoveryLens" />
            <NavItem path="/app/settlement" icon={Calculator} label="Settlement" />
            <NavItem path="/app/discovery" icon={FileSearch} label="Discovery Manager" />
            <NavItem path="/app/case-law" icon={BookOpen} label="Case Law Research" />
            <NavItem path="/app/admissibility" icon={Target} label="Evidence Analyzer" />
            <NavItem path="/app/timeline" icon={Scale} label="Evidence Timeline" />
            <NavItem path="/app/foia" icon={FileText} label="Public Records / FOIA" />
            <NavItem path="/app/officers" icon={Shield} label="Officer Database" />
          </NavGroup>

          <div className="pt-1" />
          <NavItem path="/app/transcriber" icon={FileAudio} label="Transcriber" />
          <NavItem path="/app/docs" icon={FileText} label="Drafting Assistant" />
          <NavItem path="/app/negotiation" icon={Handshake} label="Negotiation Sim" />

          <div className="mt-auto pt-2 border-t border-slate-800/60">
            {/* Cloud sync status indicator */}
            <button
              onClick={syncStatus === 'error' ? retrySync : undefined}
              className={`flex items-center gap-2 mx-2 px-3 py-2 rounded-lg text-xs w-[calc(100%-1rem)] transition-colors ${syncStatus === 'error' ? 'hover:bg-red-500/10 cursor-pointer' : 'cursor-default'}`}
            >
              {syncStatus === 'synced' && <Cloud size={14} className="text-emerald-400 shrink-0" />}
              {syncStatus === 'syncing' && <Loader2 size={14} className="text-amber-400 animate-spin shrink-0" />}
              {syncStatus === 'error' && <CloudOff size={14} className="text-red-400 shrink-0" />}
              <span className={syncStatus === 'error' ? 'text-red-400' : syncStatus === 'syncing' ? 'text-amber-400' : 'text-slate-500'}>
                {syncStatus === 'synced' ? 'Cloud synced' : syncStatus === 'syncing' ? 'Syncing...' : 'Sync failed \u2013 tap to retry'}
              </span>
            </button>
            <NavItem path="/app/settings" icon={SettingsIcon} label="Settings" />
          </div>
        </nav>
      </aside>
    </>
  );
};

const Layout = ({ children }: { children?: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { syncStatus, retrySync } = React.useContext(AppContext);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} syncStatus={syncStatus} retrySync={retrySync} />
      
      <div className="md:ml-64 min-h-screen flex flex-col">
        <header className="h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 flex items-center justify-between">
          <button className="md:hidden text-slate-400" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-4 ml-auto">
             <div className="hidden sm:flex flex-col items-end">
               <span className="text-sm font-semibold text-white">{user.fullName}</span>
               <span className="text-xs text-slate-400">{user.email}</span>
             </div>
             <div className="h-9 w-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center">
                <span className="text-sm font-semibold text-white">{user.fullName.charAt(0).toUpperCase()}</span>
             </div>
             <button
               onClick={handleSignOut}
               className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
               title="Sign out"
             >
               <LogOut size={18} />
               <span className="hidden sm:inline">Sign Out</span>
             </button>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

const AuthenticatedLayout = ({ children }: { children?: React.ReactNode }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

export type SyncStatus = 'synced' | 'syncing' | 'error';

export const AppContext = React.createContext<{
    cases: Case[];
    activeCase: Case | null;
    setActiveCase: (c: Case | null) => void;
    addCase: (c: Case) => Promise<void>;
    updateCase: (caseId: string, data: Partial<Case>) => Promise<void>;
    deleteCase: (caseId: string) => Promise<void>;
    addEvidence: (caseId: string, evidence: EvidenceItem) => Promise<void>;
    theme: 'dark' | 'light';
    setTheme: (t: 'dark' | 'light') => void;
    user: { id: string; email: string; fullName: string; firmName?: string } | null;
    syncStatus: SyncStatus;
    retrySync: () => void;
  }>({
    cases: [],
    activeCase: null,
    setActiveCase: () => {},
    addCase: async () => {},
    updateCase: async () => {},
    deleteCase: async () => {},
    addEvidence: async () => {},
    theme: 'dark',
    setTheme: () => {},
    user: null,
    syncStatus: 'synced',
    retrySync: () => {},
  });

const App = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const syncQueueRef = useRef<Array<{ fn: () => Promise<void>; label: string }>>([]);
  const { user } = useAuth();

  const cloudSync = useCallback(async (label: string, fn: () => Promise<void>) => {
    setSyncStatus('syncing');
    try {
      await fn();
      setSyncStatus(syncQueueRef.current.length === 0 ? 'synced' : 'error');
      toast.success('Saved to cloud', { autoClose: 1500, toastId: 'sync-ok' });
    } catch (error) {
      setSyncStatus('error');
      syncQueueRef.current.push({ fn, label });
      toast.error(`Cloud sync failed: ${label}. Will retry automatically.`, { toastId: `sync-fail-${Date.now()}` });
      console.error(`[CloudSync] ${label} failed:`, error);
    }
  }, []);

  const retrySync = useCallback(async () => {
    if (syncQueueRef.current.length === 0) return;
    setSyncStatus('syncing');
    const queue = [...syncQueueRef.current];
    syncQueueRef.current = [];
    for (const item of queue) {
      try {
        await item.fn();
      } catch {
        syncQueueRef.current.push(item);
      }
    }
    setSyncStatus(syncQueueRef.current.length === 0 ? 'synced' : 'error');
    if (syncQueueRef.current.length === 0) {
      toast.success('All data synced to cloud', { autoClose: 2000, toastId: 'retry-ok' });
    }
  }, []);

  // Auto-retry failed syncs every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (syncQueueRef.current.length > 0) {
        retrySync();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [retrySync]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      // Wait for auth to initialize
      if (!user) {
        setHydrated(false);
        return;
      }

      try {
        const loaded = await fetchCases();
        const usingSupabase = supabaseReady();
        const fallback = loaded.length > 0 ? loaded : (usingSupabase ? [] : MOCK_CASES);
        const savedActiveId = loadActiveCaseId();
        const fallbackActive = fallback.find(c => c.id === savedActiveId) || fallback[0] || null;

        if (cancelled) return;

        setCases(fallback);
        setActiveCaseId(fallbackActive ? fallbackActive.id : null);
      } catch (error) {
        console.error('Failed to hydrate cases', error);
        if (!cancelled) {
          setCases(MOCK_CASES);
          setActiveCaseId(MOCK_CASES[0]?.id || null);
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const prefs = loadPreferences();
    setThemeState(prefs.theme || 'dark');
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!hydrated || !user) return;
    saveCases(cases);
  }, [cases, hydrated, user]);

  useEffect(() => {
    if (!hydrated || !user) return;
    saveActiveCaseId(activeCaseId);
  }, [activeCaseId, hydrated, user]);

  const activeCase = useMemo(
    () => cases.find(c => c.id === activeCaseId) || null,
    [cases, activeCaseId]
  );

  const setActiveCase = (selected: Case | null) => {
    setActiveCaseId(selected?.id || null);
  };

  const setTheme = (nextTheme: 'dark' | 'light') => {
    setThemeState(nextTheme);
    savePreferences({ theme: nextTheme });
  };

  const addCase = async (newCase: Case) => {
    const enrichedCase = {
      ...newCase,
      user_id: user?.id,
      evidence: newCase.evidence || [],
      tasks: newCase.tasks || [],
      tags: newCase.tags || [],
    };
    setCases(prev => {
      const next = [...prev, enrichedCase];
      saveCases(next);
      return next;
    });
    setActiveCaseId(enrichedCase.id);

    await cloudSync('Save case', () => upsertCase(enrichedCase));
  };

  const updateCase = async (caseId: string, data: Partial<Case>) => {
    const target = cases.find(c => c.id === caseId);
    if (!target) return;
    const updatedCase = { ...target, ...data };

    setCases(prev => {
      const next = prev.map(c => c.id === caseId ? updatedCase : c);
      saveCases(next);
      return next;
    });

    await cloudSync('Update case', () => upsertCase(updatedCase));
  };

  const deleteCase = async (caseId: string) => {
    setCases(prev => {
      const filtered = prev.filter(c => c.id !== caseId);
      saveCases(filtered);
      if (activeCaseId === caseId) {
        setActiveCaseId(filtered[0]?.id || null);
      }
      return filtered;
    });

    await cloudSync('Delete case', () => removeCase(caseId));
  };

  const addEvidence = async (caseId: string, evidence: EvidenceItem) => {
    const target = cases.find(c => c.id === caseId);
    if (!target) return;
    const updatedCase = { ...target, evidence: [...(target.evidence || []), evidence] };

    setCases(prev => {
      const next = prev.map(c => c.id === caseId ? updatedCase : c);
      saveCases(next);
      return next;
    });

    await cloudSync('Save evidence', () => appendEvidence(caseId, evidence));
  };

  return (
    <AppContext.Provider value={{ cases, activeCase, setActiveCase, addCase, updateCase, deleteCase, addEvidence, theme, setTheme, user, syncStatus, retrySync }}>
      <ErrorBoundary>
        <BrowserRouter>
          <Suspense fallback={<div className="p-8 text-slate-400">Loading...</div>}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/tos" element={<TermsOfService />} />
              
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/signup" element={<SignupPage />} />
              <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
              
              <Route path="/app" element={<AuthenticatedLayout><Dashboard /></AuthenticatedLayout>} />
              <Route path="/app/cases" element={<AuthenticatedLayout><CaseManager /></AuthenticatedLayout>} />
              <Route path="/app/witness-lab" element={<AuthenticatedLayout><WitnessLab /></AuthenticatedLayout>} />
              <Route path="/app/practice" element={<AuthenticatedLayout><ArgumentPractice /></AuthenticatedLayout>} />
              <Route path="/app/strategy" element={<AuthenticatedLayout><StrategyRoom /></AuthenticatedLayout>} />
              <Route path="/app/transcriber" element={<AuthenticatedLayout><Transcriber /></AuthenticatedLayout>} />
              <Route path="/app/docs" element={<AuthenticatedLayout><DraftingAssistant /></AuthenticatedLayout>} />
              <Route path="/app/settings" element={<AuthenticatedLayout><SettingsPage /></AuthenticatedLayout>} />
              <Route path="/app/settlement" element={<AuthenticatedLayout><SettlementCalculator /></AuthenticatedLayout>} />
              <Route path="/app/discovery" element={<AuthenticatedLayout><DiscoveryManager /></AuthenticatedLayout>} />
              <Route path="/app/case-law" element={<AuthenticatedLayout><CaseLawResearch /></AuthenticatedLayout>} />
              <Route path="/app/admissibility" element={<AuthenticatedLayout><EvidenceAdmissibility /></AuthenticatedLayout>} />
              <Route path="/app/performance" element={<AuthenticatedLayout><PerformanceAnalytics /></AuthenticatedLayout>} />
              <Route path="/app/deposition" element={<AuthenticatedLayout><DepositionOutlineGenerator /></AuthenticatedLayout>} />
              <Route path="/app/negotiation" element={<AuthenticatedLayout><NegotiationSimulator /></AuthenticatedLayout>} />
              <Route path="/app/timeline" element={<AuthenticatedLayout><EvidenceTimeline /></AuthenticatedLayout>} />
              <Route path="/app/mock-jury" element={<AuthenticatedLayout><MockJury /></AuthenticatedLayout>} />
              <Route path="/app/foia" element={<AuthenticatedLayout><PublicRecordsManager /></AuthenticatedLayout>} />
              <Route path="/app/officers" element={<AuthenticatedLayout><OfficerDatabase /></AuthenticatedLayout>} />
              <Route path="/app/ai-counsel" element={<AuthenticatedLayout><AICoCounsel /></AuthenticatedLayout>} />
              <Route path="/app/discovery-lens" element={<AuthenticatedLayout><DiscoveryLens /></AuthenticatedLayout>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
      <ToastContainer aria-label="Notifications" />
    </AppContext.Provider>
  );
};

const AppWithAuth = () => (
  <AuthProvider>
    <KnowledgeProvider>
      <App />
    </KnowledgeProvider>
  </AuthProvider>
);

export default AppWithAuth;
