
import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, BrainCircuit, Gavel, Settings as SettingsIcon, Menu, X, MessageSquare, Mic, FileAudio, Home } from 'lucide-react';
import { ToastContainer } from 'react-toastify';
import Dashboard from './components/Dashboard';
import CaseManager from './components/CaseManager';
import WitnessLab from './components/WitnessLab';
import StrategyRoom from './components/StrategyRoom';
import ArgumentPractice from './components/ArgumentPractice';
import LandingPage from './components/LandingPage';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import Transcriber from './components/Transcriber';
import DraftingAssistant from './components/DraftingAssistant';
import SettingsPage from './components/Settings';
import { MOCK_CASES } from './constants';
import { Case } from './types';

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
  setActiveCase: (c: Case) => void;
  addCase: (c: Case) => void;
}>({
  cases: [],
  activeCase: null,
  setActiveCase: () => {},
  addCase: () => {},
});

const App = () => {
  const [cases, setCases] = useState<Case[]>(MOCK_CASES); // Initialize from constants, which is now empty
  const [activeCase, setActiveCase] = useState<Case | null>(null);

  const addCase = (newCase: Case) => {
    setCases(prev => [...prev, newCase]);
    if (!activeCase) {
      setActiveCase(newCase);
    }
  };

  return (
    <AppContext.Provider value={{ cases, activeCase, setActiveCase, addCase }}>
      <HashRouter>
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
      </HashRouter>
      <ToastContainer aria-label="Notifications" />
    </AppContext.Provider>
  );
};

export default App;