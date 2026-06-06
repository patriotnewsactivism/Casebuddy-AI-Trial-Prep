import React, { useContext, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import {
  ClipboardList, BookOpen, FileSearch, Scale, Users, FileText,
  Mic, Target, Radio, Calculator, ChevronRight, CheckCircle2,
  Circle, ArrowRight, Sparkles, AlertTriangle, Clock, Zap,
  ChevronDown, ChevronUp, BarChart2, Bomb, Brain, Handshake,
  Shield, ScanLine, Briefcase
} from 'lucide-react';
import { Case } from '../types';
import { toast } from 'react-toastify';

// ── Pipeline Step Definitions ────────────────────────────────────────────────

interface PipelineStep {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  tools: { name: string; path: string; icon: React.ElementType; description: string }[];
  completionChecks: (c: Case) => { done: number; total: number; items: { label: string; done: boolean }[] };
  timeEstimate: string;
  billableHoursSaved: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: 'intake',
    number: 1,
    title: 'Case Intake',
    subtitle: 'Get the facts straight',
    description: 'Enter case details, parties, claims, and key facts. The AI builds your initial case profile and identifies what you need.',
    icon: ClipboardList,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    tools: [
      { name: 'Case Files', path: '/app/cases', icon: Briefcase, description: 'Create and manage your case' },
      { name: 'AI Law Firm', path: '/app/law-firm', icon: Scale, description: 'AI-guided intake interview' },
    ],
    completionChecks: (c) => {
      const items = [
        { label: 'Case title entered', done: !!c.title && c.title.length > 3 },
        { label: 'Client name set', done: !!c.client && c.client.length > 1 },
        { label: 'Case summary written', done: !!c.summary && c.summary.length > 20 },
        { label: 'Opposing counsel identified', done: !!c.opposingCounsel && c.opposingCounsel.length > 1 },
        { label: 'Judge assigned', done: !!c.judge && c.judge.length > 1 },
        { label: 'Court date set', done: !!c.nextCourtDate },
      ];
      return { done: items.filter(i => i.done).length, total: items.length, items };
    },
    timeEstimate: '30 min',
    billableHoursSaved: '2-3 hrs',
  },
  {
    id: 'research',
    number: 2,
    title: 'Legal Research',
    subtitle: 'Know the law',
    description: 'AI researches relevant case law, statutes, and precedents. Identifies the strongest legal theories for your case.',
    icon: BookOpen,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    tools: [
      { name: 'Case Law Research', path: '/app/case-law', icon: BookOpen, description: 'AI-powered legal research' },
      { name: 'AI Co-Counsel', path: '/app/ai-counsel', icon: Scale, description: 'Discuss legal theories' },
      { name: 'Strategy Room', path: '/app/strategy', icon: Brain, description: 'AI strategy analysis' },
    ],
    completionChecks: (c) => {
      const items = [
        { label: 'Case citations found', done: (c.citations?.length || 0) > 0 },
        { label: 'Legal theory defined', done: !!c.legalTheory && c.legalTheory.length > 10 },
        { label: 'Key issues identified', done: (c.keyIssues?.length || 0) > 0 },
      ];
      return { done: items.filter(i => i.done).length, total: items.length, items };
    },
    timeEstimate: '1 hr',
    billableHoursSaved: '8-10 hrs',
  },
  {
    id: 'discovery',
    number: 3,
    title: 'Discovery',
    subtitle: 'Get the evidence',
    description: 'Generate interrogatories, requests for production, and requests for admissions. Track deadlines and responses.',
    icon: FileSearch,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    tools: [
      { name: 'Discovery Manager', path: '/app/discovery', icon: FileSearch, description: 'Track discovery requests & deadlines' },
      { name: 'Discovery Nuke', path: '/app/discovery-nuke', icon: Bomb, description: 'AI bulk document analysis' },
      { name: 'Public Records / FOIA', path: '/app/foia', icon: Shield, description: 'Track FOIA requests' },
    ],
    completionChecks: (c) => {
      const items = [
        { label: 'Discovery requests created', done: (c.discoveryRequests?.length || 0) > 0 },
        { label: 'Documents uploaded', done: (c.evidence?.length || 0) > 0 },
      ];
      return { done: items.filter(i => i.done).length, total: items.length, items };
    },
    timeEstimate: '2 hrs',
    billableHoursSaved: '6-8 hrs',
  },
  {
    id: 'evidence',
    number: 4,
    title: 'Evidence Organization',
    subtitle: 'Build your case',
    description: 'Organize evidence on a timeline, number exhibits, check admissibility, and identify strengths and gaps.',
    icon: Scale,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    tools: [
      { name: 'Evidence Timeline', path: '/app/timeline', icon: Scale, description: 'Visual timeline & exhibit numbering' },
      { name: 'Evidence Analyzer', path: '/app/admissibility', icon: Target, description: 'AI admissibility analysis' },
    ],
    completionChecks: (c) => {
      const items = [
        { label: 'Evidence items organized', done: (c.evidence?.length || 0) >= 2 },
        { label: 'Timeline events created', done: (c.timelineEvents?.length || 0) > 0 },
      ];
      return { done: items.filter(i => i.done).length, total: items.length, items };
    },
    timeEstimate: '1.5 hrs',
    billableHoursSaved: '4-6 hrs',
  },
  {
    id: 'depositions',
    number: 5,
    title: 'Depositions',
    subtitle: 'Lock down testimony',
    description: 'Generate deposition outlines, practice questioning against AI witnesses, and prepare for opposition depositions.',
    icon: Users,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    tools: [
      { name: 'Deposition Outlines', path: '/app/deposition', icon: FileText, description: 'AI-generated deposition questions' },
      { name: 'Witness Lab', path: '/app/witness-lab', icon: Users, description: 'Practice against AI witnesses' },
    ],
    completionChecks: (c) => {
      const items = [
        { label: 'Witnesses identified', done: (c.witnesses?.length || 0) > 0 },
        { label: 'Deposition outlines created', done: false }, // Check localStorage
      ];
      return { done: items.filter(i => i.done).length, total: items.length, items };
    },
    timeEstimate: '1.5 hrs',
    billableHoursSaved: '5-6 hrs',
  },
  {
    id: 'motions',
    number: 6,
    title: 'Motions & Drafting',
    subtitle: 'File your paperwork',
    description: 'AI drafts motions, briefs, demand letters, and other legal documents. You review, edit, and file.',
    icon: FileText,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
    tools: [
      { name: 'Drafting Assistant', path: '/app/docs', icon: FileText, description: 'AI document generation' },
    ],
    completionChecks: (c) => {
      const items = [
        { label: 'Key motions drafted', done: (c.motions?.length || 0) > 0 },
      ];
      return { done: items.filter(i => i.done).length, total: items.length, items };
    },
    timeEstimate: '2 hrs',
    billableHoursSaved: '4-8 hrs',
  },
  {
    id: 'witness-prep',
    number: 7,
    title: 'Witness Preparation',
    subtitle: 'Know your witnesses',
    description: 'Practice cross-examination, prepare direct examination, and stress-test your witnesses before trial.',
    icon: Users,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    tools: [
      { name: 'Witness Lab', path: '/app/witness-lab', icon: Users, description: 'Cross-examination practice' },
      { name: 'AI Co-Counsel', path: '/app/ai-counsel', icon: Scale, description: 'Discuss witness strategy' },
    ],
    completionChecks: (c) => {
      const items = [
        { label: 'Witnesses prepped', done: (c.witnesses?.length || 0) > 0 },
      ];
      return { done: items.filter(i => i.done).length, total: items.length, items };
    },
    timeEstimate: '1.5 hrs',
    billableHoursSaved: '4-6 hrs',
  },
  {
    id: 'trial-prep',
    number: 8,
    title: 'Trial Preparation',
    subtitle: 'Get trial-ready',
    description: 'Run mock jury simulations, analyze case strength, practice opening/closing statements, and build your trial strategy.',
    icon: Target,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    tools: [
      { name: 'Mock Jury', path: '/app/mock-jury', icon: Scale, description: 'AI jury deliberation & verdict' },
      { name: 'AI Partner', path: '/app/partner', icon: Brain, description: 'Case health & strategy assessment' },
      { name: 'Performance', path: '/app/performance', icon: BarChart2, description: 'Track your improvement' },
    ],
    completionChecks: (c) => {
      const items = [
        { label: 'Mock jury simulation run', done: false },
        { label: 'Case health assessed', done: c.winProbability > 0 },
      ];
      return { done: items.filter(i => i.done).length, total: items.length, items };
    },
    timeEstimate: '2 hrs',
    billableHoursSaved: '6-8 hrs',
  },
  {
    id: 'trial-sim',
    number: 9,
    title: 'Trial Simulation',
    subtitle: 'Practice in the courtroom',
    description: 'Full voice-based trial simulation with AI judge, opposing counsel, and witnesses. Practice until you\'re perfect.',
    icon: Mic,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    tools: [
      { name: 'Trial Simulator', path: '/app/practice', icon: Mic, description: 'AI courtroom with coaching' },
      { name: 'Live Voice Sim', path: '/app/live-sim', icon: Radio, description: 'Real-time voice trial' },
      { name: 'Negotiation Sim', path: '/app/negotiation', icon: Handshake, description: 'Practice negotiations' },
    ],
    completionChecks: () => {
      const items = [
        { label: 'Trial simulation completed', done: false },
        { label: 'Opening statement practiced', done: false },
        { label: 'Closing argument practiced', done: false },
      ];
      return { done: items.filter(i => i.done).length, total: items.length, items };
    },
    timeEstimate: '2 hrs',
    billableHoursSaved: '4-6 hrs',
  },
  {
    id: 'resolution',
    number: 10,
    title: 'Settlement / Resolution',
    subtitle: 'Close the deal',
    description: 'Calculate case value, run settlement simulations, practice negotiation, and generate demand letters.',
    icon: Calculator,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    tools: [
      { name: 'Settlement Calculator', path: '/app/settlement', icon: Calculator, description: 'AI case valuation' },
      { name: 'Negotiation Sim', path: '/app/negotiation', icon: Handshake, description: 'Practice settlement talks' },
      { name: 'Drafting Assistant', path: '/app/docs', icon: FileText, description: 'Generate demand letters' },
    ],
    completionChecks: (c) => {
      const items = [
        { label: 'Settlement analysis run', done: (c.settlementAnalyses?.length || 0) > 0 },
      ];
      return { done: items.filter(i => i.done).length, total: items.length, items };
    },
    timeEstimate: '1 hr',
    billableHoursSaved: '3-4 hrs',
  },
];

// ── Components ───────────────────────────────────────────────────────────────

const StepCard = ({
  step,
  caseData,
  isActive,
  isNext,
  onExpand,
  expanded,
}: {
  step: PipelineStep;
  caseData: Case | null;
  isActive: boolean;
  isNext: boolean;
  onExpand: () => void;
  expanded: boolean;
}) => {
  const navigate = useNavigate();
  const completion = caseData ? step.completionChecks(caseData) : { done: 0, total: 0, items: [] };
  const progress = completion.total > 0 ? Math.round((completion.done / completion.total) * 100) : 0;
  const isComplete = progress === 100;
  const Icon = step.icon;

  return (
    <div
      className={`
        relative rounded-xl border transition-all duration-300 overflow-hidden
        ${isNext ? `${step.borderColor} ring-1 ring-offset-0 ring-offset-slate-900 shadow-lg shadow-${step.color.replace('text-', '')}/5` : ''}
        ${isComplete ? 'border-emerald-500/30 bg-emerald-500/5' : isActive ? `${step.borderColor} ${step.bgColor}` : 'border-slate-700/50 bg-slate-800/40'}
        ${!isComplete && !isActive ? 'opacity-60 hover:opacity-80' : ''}
        hover:border-opacity-60 cursor-pointer
      `}
      onClick={onExpand}
    >
      {/* Step Header */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {/* Step Number + Icon */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center transition-all
              ${isComplete ? 'bg-emerald-500/20 border border-emerald-500/40' : isActive || isNext ? `${step.bgColor} border ${step.borderColor}` : 'bg-slate-700/50 border border-slate-600/50'}
            `}>
              {isComplete ? (
                <CheckCircle2 size={20} className="text-emerald-400" />
              ) : (
                <Icon size={20} className={isActive || isNext ? step.color : 'text-slate-400'} />
              )}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isComplete ? 'text-emerald-500' : isActive || isNext ? step.color : 'text-slate-500'}`}>
              Step {step.number}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`text-base font-bold ${isComplete ? 'text-emerald-300' : 'text-white'}`}>
                {step.title}
              </h3>
              {isNext && !isComplete && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gold-500/20 text-gold-400 border border-gold-500/30 animate-pulse">
                  Next
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">{step.subtitle}</p>

            {/* Progress Bar */}
            {caseData && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : step.color.replace('text-', 'bg-')}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className={`text-xs font-mono font-bold ${isComplete ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {completion.done}/{completion.total}
                </span>
              </div>
            )}
          </div>

          {/* Expand Toggle */}
          <button className="text-slate-500 hover:text-slate-300 p-1 shrink-0">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 border-t border-slate-700/50">
          <p className="text-sm text-slate-300 mt-3 mb-4 leading-relaxed">{step.description}</p>

          {/* Time & Savings */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock size={12} />
              <span>~{step.timeEstimate} with AI</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Zap size={12} />
              <span>Saves {step.billableHoursSaved} vs manual</span>
            </div>
          </div>

          {/* Checklist */}
          {caseData && completion.items.length > 0 && (
            <div className="mb-4 space-y-1.5">
              {completion.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {item.done ? (
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Circle size={14} className="text-slate-500 shrink-0" />
                  )}
                  <span className={item.done ? 'text-emerald-300' : 'text-slate-400'}>{item.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tool Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {step.tools.map((tool) => {
              const ToolIcon = tool.icon;
              return (
                <button
                  key={tool.path}
                  onClick={(e) => { e.stopPropagation(); navigate(tool.path); }}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                    border border-slate-600/50 hover:border-slate-500
                    bg-slate-800/60 hover:bg-slate-700/60
                    transition-all duration-150 group
                  `}
                >
                  <ToolIcon size={16} className={`${step.color} shrink-0 group-hover:scale-110 transition-transform`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{tool.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{tool.description}</p>
                  </div>
                  <ArrowRight size={14} className="text-slate-500 group-hover:text-white shrink-0 transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Pipeline Component ──────────────────────────────────────────────────

const CasePipeline = () => {
  const { cases, activeCase, setActiveCase } = useContext(AppContext);
  const navigate = useNavigate();
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  // Calculate overall progress
  const stepProgress = useMemo(() => {
    if (!activeCase) return [];
    return PIPELINE_STEPS.map((step) => {
      const completion = step.completionChecks(activeCase);
      return {
        id: step.id,
        done: completion.done,
        total: completion.total,
        progress: completion.total > 0 ? completion.done / completion.total : 0,
        isComplete: completion.total > 0 && completion.done >= completion.total,
      };
    });
  }, [activeCase]);

  // Find current (first incomplete) step
  const currentStepIndex = useMemo(() => {
    const idx = stepProgress.findIndex((s) => !s.isComplete);
    return idx === -1 ? PIPELINE_STEPS.length - 1 : idx;
  }, [stepProgress]);

  const overallProgress = useMemo(() => {
    if (stepProgress.length === 0) return 0;
    const totalDone = stepProgress.reduce((sum, s) => sum + s.done, 0);
    const totalItems = stepProgress.reduce((sum, s) => sum + s.total, 0);
    return totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;
  }, [stepProgress]);

  const totalHoursSaved = useMemo(() => {
    // Sum up the low-end of billable hours saved
    return PIPELINE_STEPS.reduce((sum, step) => {
      const match = step.billableHoursSaved.match(/(\d+)/);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);
  }, []);

  // Auto-expand the "next" step
  React.useEffect(() => {
    if (activeCase && expandedStep === null) {
      setExpandedStep(PIPELINE_STEPS[currentStepIndex]?.id || null);
    }
  }, [activeCase, currentStepIndex]);

  if (!activeCase) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center mx-auto mb-6">
            <Sparkles size={28} className="text-gold-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Case Pipeline</h1>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            Select a case to see its progress through the full legal pipeline — from intake to resolution.
          </p>

          {cases.length > 0 ? (
            <div className="space-y-2 max-w-sm mx-auto">
              {cases.slice(0, 5).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCase(c)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl hover:border-gold-500/30 transition-all text-left"
                >
                  <Briefcase size={16} className="text-gold-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.title}</p>
                    <p className="text-xs text-slate-400 truncate">{c.client}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-500" />
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => navigate('/app/cases')}
              className="px-6 py-3 bg-gold-500 text-slate-900 font-bold rounded-xl hover:bg-gold-400 transition-colors"
            >
              Create Your First Case
            </button>
          )}
        </div>
      </div>
    );
  }

  const nextStep = PIPELINE_STEPS[currentStepIndex];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Case Pipeline</h1>
            <p className="text-sm text-slate-400 mt-1">
              <span className="font-medium text-gold-400">{activeCase.title}</span> — {activeCase.client}
            </p>
          </div>

          {/* Case Selector */}
          {cases.length > 1 && (
            <select
              value={activeCase.id}
              onChange={(e) => {
                const c = cases.find((c) => c.id === e.target.value);
                if (c) setActiveCase(c);
              }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500/50"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Overall Progress */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-white">{overallProgress}%</div>
              <div className="text-sm text-slate-400">
                Case progress — Step {currentStepIndex + 1} of {PIPELINE_STEPS.length}
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
              <Zap size={12} />
              <span>~{totalHoursSaved}+ billable hours saved by AI</span>
            </div>
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gold-500 to-emerald-500 rounded-full transition-all duration-1000"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          {/* Quick Next Action */}
          {nextStep && overallProgress < 100 && (
            <div className="mt-4 flex items-center gap-3">
              <AlertTriangle size={14} className="text-gold-400 shrink-0" />
              <p className="text-sm text-slate-300">
                <span className="font-medium text-gold-400">Next up:</span> {nextStep.title} — {nextStep.subtitle}
              </p>
              <button
                onClick={() => {
                  setExpandedStep(nextStep.id);
                  const el = document.getElementById(`step-${nextStep.id}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-gold-500/10 border border-gold-500/30 rounded-lg text-sm font-medium text-gold-400 hover:bg-gold-500/20 transition-colors shrink-0"
              >
                Go <ArrowRight size={14} />
              </button>
            </div>
          )}

          {overallProgress === 100 && (
            <div className="mt-4 flex items-center gap-3 text-emerald-400">
              <CheckCircle2 size={16} />
              <p className="text-sm font-medium">All pipeline steps complete! Your case is fully prepared.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline Steps */}
      <div className="space-y-3">
        {PIPELINE_STEPS.map((step, idx) => (
          <div key={step.id} id={`step-${step.id}`}>
            <StepCard
              step={step}
              caseData={activeCase}
              isActive={idx <= currentStepIndex}
              isNext={idx === currentStepIndex}
              expanded={expandedStep === step.id}
              onExpand={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
            />
          </div>
        ))}
      </div>

      {/* Footer ROI Summary */}
      <div className="mt-8 bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-gold-500/20 rounded-xl p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center shrink-0">
            <BarChart2 size={20} className="text-gold-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white mb-1">ROI Summary</h3>
            <p className="text-sm text-slate-400 mb-3">
              CaseBuddy AI handles the heavy lifting so you focus on strategy and winning.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-emerald-400">{totalHoursSaved}+</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Hours Saved</p>
              </div>
              <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-gold-400">${(totalHoursSaved * 300).toLocaleString()}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Value @ $300/hr</p>
              </div>
              <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-blue-400">10</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Pipeline Steps</p>
              </div>
              <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-purple-400">30+</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">AI Tools</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CasePipeline;
