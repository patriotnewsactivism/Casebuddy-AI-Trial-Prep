import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import PublicIntake from './pages/PublicIntake';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import CaseDetail from './pages/CaseDetail';
import IntakePage from './pages/IntakePage';
import DocumentLab from './pages/DocumentLab';
import DiscoveryMiner from './pages/DiscoveryMiner';
import TrialCenter from './pages/TrialCenter';
import WitnessPrep from './pages/WitnessPrep';
import JurySimulator from './pages/JurySimulator';
import LegalResearchHub from './pages/LegalResearchHub';
import DeadlinesAndSol from './pages/DeadlinesAndSol';
import ConflictChecker from './pages/ConflictChecker';
import EFiling from './pages/EFiling';
import LegalSecretary from './pages/LegalSecretary';
import Marketplace from './pages/Marketplace';
import Pricing from './pages/Pricing';
import ProductTour from './pages/ProductTour';
import SeoPages from './pages/SeoPages';
import Settings from './pages/Settings';
import OnboardingModal from './components/OnboardingModal';
import PwaInstall from './components/PwaInstall';
import CaseAssistant from './components/CaseAssistant';
import { initCloudSync } from './lib/caseStore';
import { useFirm } from './lib/firmStore';
import { useAuth, authConfigured, signOut } from './lib/authStore';
import { track } from './lib/analytics';
import { Scale, FolderOpen, UserPlus, FileSearch, Microscope, Swords, BookOpen, Clock, Menu, Shield, Gavel, MessageSquare, Store, PlayCircle, Globe2, ChevronDown, ChevronRight, Users, BarChart2, CreditCard, Settings as SettingsIcon, Loader2, LogOut } from 'lucide-react';

interface NavSection {
  title: string;
  items: { to: string; label: string; icon: any; agent?: string }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Core',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: Scale },
      { to: '/cases', label: 'Cases', icon: FolderOpen },
      { to: '/intake', label: 'AI Intake — Maya', icon: UserPlus, agent: 'Maya' },
      { to: '/deadlines', label: 'Deadlines & SOL — Sol', icon: Clock, agent: 'Sol' },
    ],
  },
  {
    title: 'Documents',
    items: [
      { to: '/documents', label: 'Document Lab — Doc', icon: FileSearch, agent: 'Doc' },
      { to: '/discovery', label: 'Discovery Miner — Doc', icon: Microscope, agent: 'Doc' },
    ],
  },
  {
    title: 'Research',
    items: [
      { to: '/research', label: 'Legal Research — Lex', icon: BookOpen, agent: 'Lex' },
      { to: '/conflict-checker', label: 'Conflict Checker — Lex', icon: Shield, agent: 'Lex' },
      { to: '/e-filing', label: 'E-Filing — Max', icon: Gavel, agent: 'Max' },
    ],
  },
  {
    title: 'Trial Prep',
    items: [
      { to: '/trial', label: 'Trial Coach — Rex', icon: Swords, agent: 'Rex' },
      { to: '/witnesses', label: 'Witness Prep — Rex', icon: Users, agent: 'Rex' },
      { to: '/jury', label: 'Jury Simulator — Jules', icon: BarChart2, agent: 'Jules' },
    ],
  },
  {
    title: 'Growth & Sales',
    items: [
      { to: '/legal-secretary', label: 'AI Secretary — Sierra', icon: MessageSquare, agent: 'Sierra' },
      { to: '/pricing', label: 'Pricing', icon: CreditCard },
      { to: '/marketplace', label: 'Marketplace', icon: Store },
      { to: '/seo-pages', label: 'SEO Page Generator', icon: Globe2 },
      { to: '/video-tour', label: 'Product Tour', icon: PlayCircle },
      { to: '/settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];

// Agent accent colors for nav
const AGENT_COLORS: Record<string, string> = {
  Maya: 'text-violet-400',
  Lex: 'text-indigo-400',
  Doc: 'text-blue-400',
  Rex: 'text-orange-400',
  Sol: 'text-yellow-400',
  Sierra: 'text-cyan-400',
  Jules: 'text-pink-400',
  Max: 'text-slate-400',
};

// Fires once per route change — the only signal analytics needs to surface
// "most-used modules" (PostHog already attaches $current_url per event).
function PageViewTracker() {
  const location = useLocation();
  useEffect(() => { track('page_view'); }, [location.pathname]);
  return null;
}

function Sidebar({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = (title: string) => setCollapsed(prev => ({ ...prev, [title]: !prev[title] }));
  const firm = useFirm();
  const branded = firm.whiteLabel && firm.firmName;
  const { user } = useAuth();

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-slate-900 border-r border-slate-800 z-30 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-800">
          <Link to="/" className="flex items-center gap-2 group">
            {branded && firm.logoUrl ? (
              <img src={firm.logoUrl} alt="" className="w-5 h-5 rounded object-contain flex-shrink-0" />
            ) : (
              <Scale size={20} className="text-blue-400 flex-shrink-0" style={branded ? { color: firm.accentColor } : undefined} />
            )}
            <div>
              <span className="text-white font-black text-sm group-hover:text-blue-300 transition-colors">{branded ? firm.firmName : 'CaseBuddy AI'}</span>
              <div className="text-xs text-slate-500">{firm.tagline}</div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV_SECTIONS.map(section => (
            <div key={section.title} className="mb-1">
              <button onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300">
                {section.title}
                {collapsed[section.title] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>
              {!collapsed[section.title] && (
                <div>
                  {section.items.map(({ to, label, icon: Icon, agent }) => (
                    <NavLink key={to} to={to} end={to === '/'}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
                      }
                      onClick={() => setOpen(false)}>
                      <Icon size={14} className="flex-shrink-0" />
                      <span className="truncate">{agent ? (
                        // Show agent name highlighted
                        label.replace(` — ${agent}`, '')
                      ) : label}</span>
                      {agent && <span className={`ml-auto text-xs font-bold ${AGENT_COLORS[agent]} flex-shrink-0`}>{agent}</span>}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {user && (
          <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between gap-2">
            <span className="text-slate-400 text-xs truncate" title={user.email || ''}>{user.email}</span>
            <button onClick={() => signOut()} title="Sign out"
              className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
              <LogOut size={14} />
            </button>
          </div>
        )}
        {!branded && (
          <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-600">
            Powered by Gemini 2.5 Flash
          </div>
        )}
      </aside>
    </>
  );
}

// Gates every authenticated module behind a Supabase session. Fails closed:
// if auth isn't configured at all, the firm's case file stays locked rather
// than silently letting anyone in (see Login.tsx for the admin-facing notice).
function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (session) initCloudSync();
  }, [session]);

  if (!authConfigured || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        {!authConfigured ? <Navigate to="/login" replace /> : <Loader2 className="animate-spin text-violet-400" size={28} />}
      </div>
    );
  }
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  return <AppShell />;
}

// App shell — sidebar + content area for every page except the public landing page
function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const firm = useFirm();
  const brandLabel = firm.whiteLabel && firm.firmName ? firm.firmName : 'CaseBuddy AI';

  return (
    <div className="min-h-screen bg-slate-950 text-white lg:pl-64">
      <OnboardingModal />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-white">
          <Menu size={20} />
        </button>
        <span className="text-white font-bold text-sm">{brandLabel}</span>
        <div className="w-5" />
      </div>

      <main className="min-h-screen">
        <Outlet />
      </main>

      {/* Firm-wide voice assistant — talk to the team from any page */}
      <CaseAssistant />
      <PwaInstall />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PageViewTracker />
      <Routes>
        {/* Public pages — full-bleed, no sidebar, no login required */}
        <Route path="/" element={<Landing />} />
        <Route path="/start" element={<PublicIntake />} />
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/cases/:id" element={<CaseDetail />} />
          <Route path="/intake" element={<IntakePage />} />

          {/* Documents */}
          <Route path="/documents" element={<DocumentLab />} />
          <Route path="/discovery" element={<DiscoveryMiner />} />

          {/* Research */}
          <Route path="/research" element={<LegalResearchHub />} />
          <Route path="/conflict-checker" element={<ConflictChecker />} />
          <Route path="/e-filing" element={<EFiling />} />
          <Route path="/deadlines" element={<DeadlinesAndSol />} />

          {/* Trial Prep */}
          <Route path="/trial" element={<TrialCenter />} />
          <Route path="/witnesses" element={<WitnessPrep />} />
          <Route path="/jury" element={<JurySimulator />} />

          {/* Growth & Sales */}
          <Route path="/legal-secretary" element={<LegalSecretary />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/seo-pages" element={<SeoPages />} />
          <Route path="/video-tour" element={<ProductTour />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
