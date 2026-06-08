import React, { useState } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, Maximize2,
  Clock, CheckCircle, ChevronRight, Star, Monitor, Sparkles,
  MessageCircle, FileText, Scale, Shield, Search, Zap
} from 'lucide-react';

interface DemoStep {
  id: string;
  title: string;
  description: string;
  duration: string;
  icon: React.ElementType;
  color: string;
  features: string[];
}

const DEMO_STEPS: DemoStep[] = [
  {
    id: 'intro',
    title: 'Welcome to CaseBuddy',
    description: 'Your AI-powered law firm that handles everything from case analysis to trial prep. See how CaseBuddy transforms how you practice law.',
    duration: '0:30',
    icon: Sparkles,
    color: 'text-amber-400',
    features: ['23+ AI-powered legal tools', 'Cloud-saved case management', 'Works for any practice area'],
  },
  {
    id: 'case-creation',
    title: 'Create & Manage Cases',
    description: 'Start a new case in seconds. Enter your client info, opposing party, jurisdiction, and let AI analyze your case strengths and weaknesses.',
    duration: '1:00',
    icon: FileText,
    color: 'text-blue-400',
    features: ['One-click case creation', 'AI case strength analysis', 'Win probability scoring', 'Evidence & witness tracking'],
  },
  {
    id: 'maya-ai',
    title: 'Maya — Your AI Legal Assistant',
    description: 'Talk to Maya using your voice or text. She analyzes your case, drafts motions, researches precedents, and provides strategic advice in real-time.',
    duration: '1:30',
    icon: MessageCircle,
    color: 'text-teal-400',
    features: ['Voice-powered conversations', 'Real-time case analysis', 'Precedent research', 'Strategic recommendations'],
  },
  {
    id: 'documents',
    title: 'Document Scanner & OCR',
    description: 'Upload any document — court orders, police reports, medical records. AI extracts text, identifies parties, key dates, and auto-populates your case.',
    duration: '1:00',
    icon: Search,
    color: 'text-violet-400',
    features: ['Drag-and-drop upload', 'AI text extraction', 'Automatic party identification', 'Timeline auto-population'],
  },
  {
    id: 'motion-writer',
    title: 'AI Motion Writer',
    description: 'Generate court-ready motions in minutes. Select the motion type, customize your arguments, and CaseBuddy drafts a complete motion with proper citations.',
    duration: '1:30',
    icon: Scale,
    color: 'text-indigo-400',
    features: ['12+ motion types', 'Jurisdiction-aware formatting', 'Real case law citations', 'One-click generation'],
  },
  {
    id: 'trial-prep',
    title: 'Trial Preparation Suite',
    description: 'From jury selection to closing arguments — CaseBuddy helps you prepare every aspect of trial. Practice cross-examinations with AI witnesses.',
    duration: '1:00',
    icon: Shield,
    color: 'text-red-400',
    features: ['Jury selection assistant', 'Cross-examination simulator', 'Opening & closing drafts', 'Exhibit organization'],
  },
  {
    id: 'pipeline',
    title: '10-Step Case Pipeline',
    description: 'Never miss a step. The guided pipeline walks you through intake to trial with AI assistance at every stage.',
    duration: '1:00',
    icon: Zap,
    color: 'text-green-400',
    features: ['Guided step-by-step workflow', 'AI analysis at each stage', 'Progress tracking', 'Deadline management'],
  },
];

const VideoDemo = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const currentStep = DEMO_STEPS[activeStep];
  const totalDuration = '7:30';

  const handleNext = () => {
    setCompletedSteps(prev => new Set([...prev, activeStep]));
    if (activeStep < DEMO_STEPS.length - 1) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    }
  };

  return (
    <div className="space-y-6 animate-slideInUp">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/30">
            <Play size={24} className="text-pink-400" />
          </div>
          CaseBuddy Product Tour
        </h1>
        <p className="text-slate-400 mt-1">Interactive walkthrough of every feature — see what CaseBuddy can do for your practice</p>
      </div>

      {/* Main Video/Demo Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video Player Placeholder */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="relative aspect-video bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
              {/* Animated background */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />
              </div>

              {/* Content */}
              <div className="relative z-10 text-center px-8">
                <div className={`w-20 h-20 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-6`}>
                  <currentStep.icon size={36} className={currentStep.color} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">{currentStep.title}</h2>
                <p className="text-slate-400 max-w-lg mx-auto">{currentStep.description}</p>

                <div className="flex flex-wrap justify-center gap-2 mt-6">
                  {currentStep.features.map((feature, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white">
                      ✓ {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* Step indicator */}
              <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur text-xs text-white">
                Step {activeStep + 1} of {DEMO_STEPS.length}
              </div>
              <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur text-xs text-slate-400 flex items-center gap-1">
                <Clock size={12} /> {currentStep.duration}
              </div>
            </div>

            {/* Controls */}
            <div className="p-4 bg-slate-900/80 border-t border-slate-800">
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePrev}
                  disabled={activeStep === 0}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 disabled:opacity-30 transition-colors"
                >
                  <SkipBack size={18} />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-3 rounded-full bg-pink-600 hover:bg-pink-500 text-white transition-colors"
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>
                <button
                  onClick={handleNext}
                  disabled={activeStep === DEMO_STEPS.length - 1}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 disabled:opacity-30 transition-colors"
                >
                  <SkipForward size={18} />
                </button>

                {/* Progress bar */}
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pink-500 rounded-full transition-all duration-300"
                    style={{ width: `${((activeStep + 1) / DEMO_STEPS.length) * 100}%` }}
                  />
                </div>

                <span className="text-xs text-slate-500">{totalDuration}</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="glass-card rounded-xl p-6 text-center">
            <h3 className="text-lg font-bold text-white mb-2">Ready to Transform Your Practice?</h3>
            <p className="text-sm text-slate-400 mb-4">Join hundreds of attorneys using CaseBuddy to work smarter.</p>
            <div className="flex gap-3 justify-center">
              <a href="#pricing" className="px-6 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium text-sm flex items-center gap-2">
                <Sparkles size={16} /> Start Free Trial
              </a>
              <a href="mailto:support@casebuddy.live" className="px-6 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm flex items-center gap-2">
                <MessageCircle size={16} /> Schedule Demo
              </a>
            </div>
          </div>
        </div>

        {/* Sidebar - Step List */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Tour Chapters</h3>
          {DEMO_STEPS.map((step, i) => (
            <button
              key={step.id}
              onClick={() => setActiveStep(i)}
              className={`w-full text-left p-3 rounded-xl transition-all duration-200 ${
                i === activeStep
                  ? 'bg-pink-500/10 border border-pink-500/30'
                  : 'glass-card hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  completedSteps.has(i) ? 'bg-green-500/10' :
                  i === activeStep ? 'bg-pink-500/10' : 'bg-slate-800'
                }`}>
                  {completedSteps.has(i) ? (
                    <CheckCircle size={16} className="text-green-400" />
                  ) : (
                    <step.icon size={16} className={i === activeStep ? step.color : 'text-slate-500'} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${i === activeStep ? 'text-white' : 'text-slate-400'}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-slate-600">{step.duration}</p>
                </div>
                {i === activeStep && <ChevronRight size={14} className="text-pink-400" />}
              </div>
            </button>
          ))}

          {/* Stats */}
          <div className="glass-card rounded-xl p-4 mt-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Platform Stats</h4>
            <div className="space-y-2">
              {[
                { label: 'AI Legal Tools', value: '23+', icon: Sparkles },
                { label: 'Practice Areas', value: '15+', icon: Scale },
                { label: 'All Jurisdictions', value: '50 States + Fed', icon: Monitor },
                { label: 'Customer Rating', value: '4.9/5', icon: Star },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <stat.icon size={12} className="text-pink-400" />
                  <span className="text-xs text-slate-500">{stat.label}</span>
                  <span className="text-xs text-white ml-auto font-medium">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoDemo;
