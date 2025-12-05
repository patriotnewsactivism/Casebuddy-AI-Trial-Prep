
import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, BrainCircuit, Gavel, Settings as SettingsIcon, Menu, X, MessageSquare, Mic, FileAudio, Home } from 'lucide-react';
import { ToastContainer } from 'react-toastify';
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
import { MOCK_CASES } from './constants';
import { Case, EvidenceItem } from './types';
import { loadActiveCaseId, loadPreferences, saveActiveCaseId, saveCases, savePreferences } from './utils/storage';
import { appendEvidence, fetchCases, removeCase, supabaseReady, upsertCase } from './services/dataService';

// Sidebar Component
const Sidebar = ({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (v: boolean) => void }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path ? 'bg-slate-800 text-gold-500 border-r-4 border-gold-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white';

  const NavItem = ({ path, icon: Icon, label }: { path: string, icon: any, label: string }) => (
    <Link 
      to={path} 
      onClick={() => setIsOpen(false)}
      className={`flex items-center gap-3 px-6 py-4 transition-all duration-200 ${isActive(path)}`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </Link>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-slate-950 border-r border-slate-800 
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        <div className="h-20 flex items-center px-6 border-b border-slate-800">
          <Link to="/" className="flex items-center gap-2 text-gold-500 hover:opacity-80 transition-opacity">
            <Gavel size={28} />
            <span className="text-xl font-serif font-bold text-white">CaseBuddy</span>
          </Link>
          <button className="ml-auto md:hidden text-slate-400" onClick={() => setIsOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <nav className="mt-6 flex flex-col">
          <NavItem path="/app" icon={LayoutDashboard} label="Dashboard" />
          <NavItem path="/app/cases" icon={Gavel} label="Case Files" />
          <NavItem path="/app/practice" icon={Mic} label="Trial Simulator" />
          <NavItem path="/app/witness-lab" icon={Users} label="Witness Lab" />
          <NavItem path="/app/strategy" icon={BrainCircuit} label="Strategy & AI" />
          <NavItem path="/app/transcriber" icon={FileAudio} label="Transcriber" />
          <NavItem path="/app/docs" icon={FileText} label="Drafting Assistant" />
          <div className="mt-auto border-t border-slate-800 pt-4 mb-6">
            <NavItem path="/app/settings" icon={SettingsIcon} label="Settings" />
          </div>
        </nav>
      </aside>
    </>
  );
};

const Layout = ({ children }: { children?: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="md:ml-64 min-h-screen flex flex-col">
        <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-6 flex items-center justify-between">
          <button className="md:hidden text-slate-400" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-4 ml-auto">
             <div className="hidden sm:flex flex-col items-end">
               <span className="text-sm font-semibold text-white">Attorney J. Doe</span>
               <span className="text-xs text-slate-400">Senior Litigator</span>
             </div>
             <div className="h-10 w-10 rounded-full bg-slate-700 border border-slate-600 overflow-hidden">
                <img src="https://picsum.photos/id/1005/100/100" alt="Profile" className="h-full w-full object-cover"/>
             </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

// Context for global state
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
  });

const App = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
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
  }, []);

  useEffect(() => {
    const prefs = loadPreferences();
    setThemeState(prefs.theme || 'dark');
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!hydrated) return;
    saveCases(cases);
  }, [cases, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveActiveCaseId(activeCaseId);
  }, [activeCaseId, hydrated]);

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

    try {
      await upsertCase(enrichedCase);
    } catch (error) {
      console.error('Failed to sync case to Supabase', error);
    }
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

    try {
      await upsertCase(updatedCase);
    } catch (error) {
      console.error('Failed to update case in Supabase', error);
    }
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

    try {
      await removeCase(caseId);
    } catch (error) {
      console.error('Failed to delete case in Supabase', error);
    }
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

    try {
      await appendEvidence(caseId, evidence);
    } catch (error) {
      console.error('Failed to append evidence in Supabase', error);
    }
  };

  return (
    <AppContext.Provider value={{ cases, activeCase, setActiveCase, addCase, updateCase, deleteCase, addEvidence, theme, setTheme }}>
      <HashRouter>
        <Suspense fallback={<div className="p-8 text-slate-400">Loading...</div>}>
          <Routes>
            {/* Public routes without sidebar */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/tos" element={<TermsOfService />} />
            
            {/* App routes with sidebar layout */}
            <Route path="/app" element={<Layout><Dashboard /></Layout>} />
            <Route path="/app/cases" element={<Layout><CaseManager /></Layout>} />
            <Route path="/app/witness-lab" element={<Layout><WitnessLab /></Layout>} />
            <Route path="/app/practice" element={<Layout><ArgumentPractice /></Layout>} />
            <Route path="/app/strategy" element={<Layout><StrategyRoom /></Layout>} />
            <Route path="/app/transcriber" element={<Layout><Transcriber /></Layout>} />
            <Route path="/app/docs" element={<Layout><DraftingAssistant /></Layout>} />
            <Route path="/app/settings" element={<Layout><SettingsPage /></Layout>} />
            
            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
      <ToastContainer aria-label="Notifications" />
    </AppContext.Provider>
  );
};

export default App;
