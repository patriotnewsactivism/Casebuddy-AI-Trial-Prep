import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, BrainCircuit, Gavel, Settings as SettingsIcon, Menu, X, Mic, FileAudio, Calculator, FileSearch, BookOpen, Target, BarChart2, Handshake, Scale, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';
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
const SettlementCalculator = lazy(() => import('./components/SettlementCalculator'));
const DiscoveryManager = lazy(() => import('./components/DiscoveryManager'));
const CaseLawResearch = lazy(() => import('./components/CaseLawResearch'));
const EvidenceAdmissibility = lazy(() => import('./components/EvidenceAdmissibility'));
const PerformanceAnalytics = lazy(() => import('./components/PerformanceAnalytics'));
const DepositionOutlineGenerator = lazy(() => import('./components/DepositionOutlineGenerator'));
const NegotiationSimulator = lazy(() => import('./components/NegotiationSimulator'));
const EvidenceTimeline = lazy(() => import('./components/EvidenceTimeline'));
const MockJury = lazy(() => import('./components/MockJury'));
import { MOCK_CASES } from './constants';
import { Case, EvidenceItem } from './types';
import { loadActiveCaseId, loadPreferences, saveActiveCaseId, saveCases, savePreferences } from './utils/storage';
import { appendEvidence, fetchCases, removeCase, supabaseReady, upsertCase } from './services/dataService';

const Sidebar = ({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (v: boolean) => void }) => {
  const location = useLocation();
  const [showTools, setShowTools] = useState(true);
  const [showPrep, setShowPrep] = useState(true);
  
  const isActive = (path: string) => location.pathname === path ? 'bg-slate-800 text-gold-500 border-r-4 border-gold-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white';

  const NavItem = ({ path, icon: Icon, label }: { path: string, icon: any, label: string }) => (
    <Link 
      to={path} 
      onClick={() => setIsOpen(false)}
      className={`flex items-center gap-3 px-6 py-3 transition-all duration-200 ${isActive(path)}`}
    >
      <Icon size={18} />
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );

  const NavGroup = ({ title, icon: Icon, isOpen: open, toggle, children }: { title: string; icon: any; isOpen: boolean; toggle: () => void; children: React.ReactNode }) => (
    <div className="border-b border-slate-800/50">
      <button
        onClick={toggle}
        className="flex items-center justify-between w-full px-6 py-3 text-slate-300 hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
        </div>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-slate-950 border-r border-slate-800 
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        <div className="h-16 flex items-center px-4 border-b border-slate-800">
          <Link to="/" className="flex items-center gap-2 text-gold-500 hover:opacity-80 transition-opacity">
            <Gavel size={24} />
            <span className="text-lg font-serif font-bold text-white">CaseBuddy</span>
          </Link>
          <button className="ml-auto md:hidden text-slate-400" onClick={() => setIsOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <nav className="mt-2 flex flex-col overflow-y-auto h-[calc(100vh-4rem)]">
          <NavItem path="/app" icon={LayoutDashboard} label="Dashboard" />
          <NavItem path="/app/cases" icon={Gavel} label="Case Files" />
          
          <NavGroup title="Preparation" icon={FolderOpen} isOpen={showPrep} toggle={() => setShowPrep(!showPrep)}>
            <NavItem path="/app/practice" icon={Mic} label="Trial Simulator" />
            <NavItem path="/app/witness-lab" icon={Users} label="Witness Lab" />
            <NavItem path="/app/mock-jury" icon={Scale} label="Mock Jury" />
            <NavItem path="/app/deposition" icon={FileText} label="Deposition Outlines" />
            <NavItem path="/app/performance" icon={BarChart2} label="Performance" />
          </NavGroup>

          <NavGroup title="Tools" icon={BrainCircuit} isOpen={showTools} toggle={() => setShowTools(!showTools)}>
            <NavItem path="/app/strategy" icon={BrainCircuit} label="Strategy & AI" />
            <NavItem path="/app/settlement" icon={Calculator} label="Settlement Calculator" />
            <NavItem path="/app/discovery" icon={FileSearch} label="Discovery Manager" />
            <NavItem path="/app/case-law" icon={BookOpen} label="Case Law Research" />
            <NavItem path="/app/admissibility" icon={Target} label="Evidence Analyzer" />
            <NavItem path="/app/timeline" icon={Scale} label="Evidence Timeline" />
          </NavGroup>

          <NavItem path="/app/transcriber" icon={FileAudio} label="Transcriber" />
          <NavItem path="/app/docs" icon={FileText} label="Drafting Assistant" />
          <NavItem path="/app/negotiation" icon={Handshake} label="Negotiation Sim" />
          
          <div className="mt-auto border-t border-slate-800 pt-2 mb-4">
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
        <header className="h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 flex items-center justify-between">
          <button className="md:hidden text-slate-400" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-4 ml-auto">
             <div className="hidden sm:flex flex-col items-end">
               <span className="text-sm font-semibold text-white">Attorney J. Doe</span>
               <span className="text-xs text-slate-400">Senior Litigator</span>
             </div>
             <div className="h-9 w-9 rounded-full bg-slate-700 border border-slate-600 overflow-hidden">
                <img src="https://picsum.photos/id/1005/100/100" alt="Profile" className="h-full w-full object-cover"/>
             </div>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

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
      <BrowserRouter>
        <Suspense fallback={<div className="p-8 text-slate-400">Loading...</div>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/tos" element={<TermsOfService />} />
            
            <Route path="/app" element={<Layout><Dashboard /></Layout>} />
            <Route path="/app/cases" element={<Layout><CaseManager /></Layout>} />
            <Route path="/app/witness-lab" element={<Layout><WitnessLab /></Layout>} />
            <Route path="/app/practice" element={<Layout><ArgumentPractice /></Layout>} />
            <Route path="/app/strategy" element={<Layout><StrategyRoom /></Layout>} />
            <Route path="/app/transcriber" element={<Layout><Transcriber /></Layout>} />
            <Route path="/app/docs" element={<Layout><DraftingAssistant /></Layout>} />
            <Route path="/app/settings" element={<Layout><SettingsPage /></Layout>} />
            <Route path="/app/settlement" element={<Layout><SettlementCalculator /></Layout>} />
            <Route path="/app/discovery" element={<Layout><DiscoveryManager /></Layout>} />
            <Route path="/app/case-law" element={<Layout><CaseLawResearch /></Layout>} />
            <Route path="/app/admissibility" element={<Layout><EvidenceAdmissibility /></Layout>} />
            <Route path="/app/performance" element={<Layout><PerformanceAnalytics /></Layout>} />
            <Route path="/app/deposition" element={<Layout><DepositionOutlineGenerator /></Layout>} />
            <Route path="/app/negotiation" element={<Layout><NegotiationSimulator /></Layout>} />
            <Route path="/app/timeline" element={<Layout><EvidenceTimeline /></Layout>} />
            <Route path="/app/mock-jury" element={<Layout><MockJury /></Layout>} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <ToastContainer aria-label="Notifications" />
    </AppContext.Provider>
  );
};

export default App;