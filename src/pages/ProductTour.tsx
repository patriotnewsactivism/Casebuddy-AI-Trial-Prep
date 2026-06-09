import React, { useState } from 'react';
import { PlayCircle, ChevronLeft, ChevronRight, CheckCircle, Sparkles, Shield, Globe, MessageSquare, Store, FileCheck, ScanLine, Gavel, Calculator, Rocket } from 'lucide-react';

interface TourStep {
  title: string; description: string; icon: any; color: string;
  features: string[]; screenshot: string; cta?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Document Scanner & OCR', icon: ScanLine, color: 'text-emerald-400',
    description: 'Upload any legal document — police reports, medical records, contracts — and our AI extracts text, dates, names, and builds your case automatically.',
    features: ['Drag-and-drop upload for PDFs, images, text files', 'AI-powered text extraction with case context', 'Automatic entity extraction (names, dates, amounts)', 'Builds searchable document library per case'],
    screenshot: '📄→🤖→✅', cta: 'Try Document Scanner',
  },
  {
    title: 'Multi-Jurisdiction Rules Engine', icon: Globe, color: 'text-blue-400',
    description: 'Instant access to filing deadlines, discovery rules, filing fees, and statutes of limitation for all 50 states plus federal courts.',
    features: ['All 50 states + federal jurisdiction data', 'Side-by-side comparison mode', 'Filing fees, SOL, discovery rules, local rules', 'Search by state name or abbreviation'],
    screenshot: '🏛️ 50 States + Federal', cta: 'Explore Jurisdictions',
  },
  {
    title: 'AI Conflict Checker', icon: Shield, color: 'text-amber-400',
    description: 'Cross-reference parties against your case history. AI flags potential conflicts under ABA Rules 1.7, 1.8, 1.9, and 1.10.',
    features: ['Multi-party input with roles and aliases', 'AI analysis against ABA Model Rules', 'Severity badges (high/medium/low/clear)', 'One-click conflict waiver letter generation'],
    screenshot: '⚖️ ABA Compliant', cta: 'Run a Conflict Check',
  },
  {
    title: 'E-Filing & Court Records', icon: Gavel, color: 'text-indigo-400',
    description: 'Search court records, view docket entries, check e-filing requirements, and access the court directory with PACER links.',
    features: ['Case search by party name or case number', 'Full docket viewer with entry details', 'E-filing requirements per document type', 'Court directory with direct ECF/PACER links'],
    screenshot: '⚖️📋 Docket Viewer', cta: 'Search Court Records',
  },
  {
    title: 'AI Legal Secretary', icon: MessageSquare, color: 'text-cyan-400',
    description: 'An embeddable AI chat widget that qualifies leads 24/7, captures contact info, and books consultations — all on autopilot.',
    features: ['Live AI chat with case qualification', 'Automatic lead capture (name, email, phone)', 'Customizable branding and greeting', 'One-click embed code for any website'],
    screenshot: '💬 24/7 Lead Capture', cta: 'See Live Demo',
  },
  {
    title: 'Legal Template Marketplace', icon: Store, color: 'text-purple-400',
    description: 'Browse hundreds of attorney-created templates — motions, discovery packages, strategy guides — searchable and instantly downloadable.',
    features: ['Templates for every practice area', 'Ratings, reviews, and download counts', 'Free and premium templates', 'Preview before purchase'],
    screenshot: '🏪 Template Store', cta: 'Browse Marketplace',
  },
  {
    title: 'Contract Review AI', icon: FileCheck, color: 'text-teal-400',
    description: 'Upload any contract and AI identifies risky clauses, hidden obligations, and unfavorable terms — with specific negotiation suggestions.',
    features: ['Risk score with clause-by-clause analysis', 'Color-coded severity (high/medium/low)', 'Specific negotiation recommendations', 'Supports 10+ contract types'],
    screenshot: '📝→🔍→💡', cta: 'Review a Contract',
  },
  {
    title: 'SOL Calculator', icon: Calculator, color: 'text-orange-400',
    description: 'Free statute of limitations calculator covering all 50 states. Enter your incident date and case type — instantly see your deadline.',
    features: ['All 50 states + federal deadlines', 'Tolling provisions and exceptions', 'Email deadline reminders', 'Shareable results link'],
    screenshot: '⏰ Never Miss a Deadline', cta: 'Calculate Your SOL',
  },
];

export default function ProductTour() {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const current = TOUR_STEPS[step];

  const goNext = () => {
    setCompleted(prev => new Set(prev).add(step));
    setStep(prev => Math.min(prev + 1, TOUR_STEPS.length - 1));
  };
  const goPrev = () => setStep(prev => Math.max(prev - 1, 0));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <PlayCircle className="text-pink-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Interactive Product Tour</h1>
          <p className="text-slate-400 text-sm">Explore every CaseBuddy feature in 2 minutes</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5">
        {TOUR_STEPS.map((_, i) => (
          <button key={i} onClick={() => setStep(i)}
            className={`h-1.5 rounded-full flex-1 transition-all ${
              i === step ? 'bg-pink-500' : completed.has(i) ? 'bg-emerald-500' : 'bg-slate-700'
            }`} />
        ))}
      </div>
      <div className="text-slate-500 text-xs text-right">Step {step + 1} of {TOUR_STEPS.length}</div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Info */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center`}>
              <current.icon size={24} className={current.color} />
            </div>
            <div>
              <div className="text-slate-500 text-xs font-medium uppercase">Feature {step + 1}</div>
              <h2 className="text-xl font-bold text-white">{current.title}</h2>
            </div>
          </div>

          <p className="text-slate-300 text-sm leading-relaxed">{current.description}</p>

          <div className="space-y-3">
            {current.features.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-slate-300 text-sm">{f}</span>
              </div>
            ))}
          </div>

          {current.cta && (
            <button className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all">
              <Sparkles size={16} /> {current.cta}
            </button>
          )}
        </div>

        {/* Right: Visual */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 flex items-center justify-center min-h-[300px]">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto bg-slate-700/50 rounded-2xl flex items-center justify-center">
              <current.icon size={40} className={current.color} />
            </div>
            <div className="text-3xl font-bold">{current.screenshot}</div>
            <div className={`text-lg font-semibold ${current.color}`}>{current.title}</div>
            <div className="text-slate-500 text-sm max-w-xs mx-auto">{current.description.substring(0, 80)}...</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <button onClick={goPrev} disabled={step === 0}
          className="flex items-center gap-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={18} /> Previous
        </button>
        <div className="flex gap-2">
          {TOUR_STEPS.map((s, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                i === step ? 'bg-pink-600 text-white scale-110' : completed.has(i) ? 'bg-emerald-600/30 text-emerald-400' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
              }`}>
              {completed.has(i) ? '✓' : i + 1}
            </button>
          ))}
        </div>
        <button onClick={goNext} disabled={step === TOUR_STEPS.length - 1}
          className="flex items-center gap-2 text-white hover:text-pink-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium">
          Next <ChevronRight size={18} />
        </button>
      </div>

      {/* Bottom CTA */}
      {step === TOUR_STEPS.length - 1 && (
        <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-2xl p-8 text-center">
          <Rocket className="mx-auto text-pink-400 mb-3" size={32} />
          <h3 className="text-xl font-bold text-white mb-2">You've seen everything CaseBuddy offers</h3>
          <p className="text-slate-400 text-sm mb-4">Ready to transform your legal practice?</p>
          <button className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-8 py-3 rounded-xl font-bold text-sm hover:from-pink-700 hover:to-purple-700 transition-all">
            Start Your Free Trial
          </button>
        </div>
      )}
    </div>
  );
}

