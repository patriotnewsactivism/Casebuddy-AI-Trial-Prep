import React, { useState, useEffect } from 'react';
import { Scale, ArrowRight, Sparkles, Users, FileSearch, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const STEPS = [
  {
    title: 'Welcome to CaseBuddy AI',
    subtitle: 'Your all-in-one AI legal team — 8 specialized agents ready to help you prepare, research, and win.',
    icon: Scale,
    color: 'from-blue-600 to-violet-600',
    content: (
      <div className="grid grid-cols-2 gap-3 mt-6">
        {[
          { emoji: '⚖️', name: 'Maya', role: 'Intake', desc: 'Smart client interviews' },
          { emoji: '🔍', name: 'Doc', role: 'Documents', desc: 'Analyze & discover' },
          { emoji: '⚔️', name: 'Rex', role: 'Trial Coach', desc: 'Practice your case' },
          { emoji: '🎭', name: 'Jules', role: 'Jury Sim', desc: '6 AI juror profiles' },
          { emoji: '📚', name: 'Lex', role: 'Research', desc: 'Case law & strategy' },
          { emoji: '⏱️', name: 'Sol', role: 'Deadlines', desc: 'Never miss a date' },
          { emoji: '💼', name: 'Sierra', role: 'Secretary', desc: '24/7 lead capture' },
          { emoji: '🗂️', name: 'Max', role: 'E-Filing', desc: 'Court records' },
        ].map(agent => (
          <div key={agent.name} className="flex items-center gap-3 bg-slate-800 rounded-xl p-3">
            <span className="text-xl">{agent.emoji}</span>
            <div>
              <p className="text-white text-xs font-semibold">{agent.name} — {agent.role}</p>
              <p className="text-slate-500 text-xs">{agent.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Start with Maya',
    subtitle: 'Your first step: let Maya interview you about your case. She\'ll build your case file, identify claims, and flag deadlines.',
    icon: Users,
    color: 'from-violet-600 to-purple-600',
    content: (
      <div className="mt-6 space-y-4">
        <div className="bg-slate-800 rounded-xl p-4 border border-violet-500/30">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">⚖️</span>
            <div>
              <p className="text-white font-semibold text-sm">Maya — AI Intake Specialist</p>
              <p className="text-violet-400 text-xs">Warm · Thorough · Reassuring</p>
            </div>
          </div>
          <div className="bg-slate-900 rounded-lg p-3">
            <p className="text-slate-300 text-sm italic">"Hi! I'm Maya, your AI paralegal. I'm going to walk you through a few questions about your situation so we can build your case file together. Take your time — there's no rush."</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Sparkles size={12} className="text-violet-400" />
          <span>Maya auto-creates your case file, identifies claims, and calculates deadlines</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Upload → Analyze → Win',
    subtitle: 'Upload any document and Doc will extract key facts, legal gems, risks, and contradictions instantly.',
    icon: FileSearch,
    color: 'from-blue-600 to-cyan-600',
    content: (
      <div className="mt-6 space-y-3">
        {[
          { step: '1', label: 'Upload documents', desc: 'Court filings, contracts, police reports, medical records', color: 'bg-blue-600' },
          { step: '2', label: 'AI analysis', desc: 'Doc extracts facts, flags risks, finds smoking guns', color: 'bg-cyan-600' },
          { step: '3', label: 'Prep witnesses', desc: 'Rex generates cross & direct examination questions', color: 'bg-orange-600' },
          { step: '4', label: 'Practice trial', desc: 'Face an AI judge, opposing counsel, and 6 AI jurors', color: 'bg-red-600' },
        ].map(item => (
          <div key={item.step} className="flex items-center gap-3 bg-slate-800 rounded-xl p-3">
            <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center text-white font-black text-sm flex-shrink-0`}>
              {item.step}
            </div>
            <div>
              <p className="text-white text-sm font-semibold">{item.label}</p>
              <p className="text-slate-400 text-xs">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
];

const ONBOARDING_KEY = 'casebuddy_onboarded';

export default function OnboardingModal() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShow(false);
  };

  if (!show) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-br ${current.color} p-6 relative`}>
          <button onClick={dismiss} className="absolute top-4 right-4 text-white/60 hover:text-white"><X size={18} /></button>
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
            <Icon size={28} className="text-white" />
          </div>
          <h2 className="text-white text-xl font-black">{current.title}</h2>
          <p className="text-white/80 text-sm mt-2">{current.subtitle}</p>
        </div>

        {/* Content */}
        <div className="p-6">{current.content}</div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          {/* Dots */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-blue-500 w-6' : 'bg-slate-600'}`} />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="text-slate-400 hover:text-white text-sm px-4 py-2">Back</button>
            )}
            {isLast ? (
              <Link to="/intake" onClick={dismiss}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity">
                Start with Maya <ArrowRight size={14} />
              </Link>
            ) : (
              <button onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
                Next <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
