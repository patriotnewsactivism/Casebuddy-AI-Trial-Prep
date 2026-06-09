import React from 'react';
import { Scale, FolderOpen, UserPlus, FileSearch, Microscope, Swords, Users, BookOpen, Clock, BarChart2, TrendingUp, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

const MODULES = [
  { to: '/intake', label: 'AI Intake', desc: 'Smart client intake with Alex, your AI paralegal', icon: UserPlus, color: 'from-violet-600 to-purple-700', tag: 'Most Popular' },
  { to: '/documents', label: 'Document Analysis', desc: 'Upload docs — get facts, gems, risks & admissibility', icon: FileSearch, color: 'from-blue-600 to-cyan-700', tag: null },
  { to: '/discovery', label: 'Discovery Miner', desc: 'Cross-reference documents to find smoking guns', icon: Microscope, color: 'from-emerald-600 to-teal-700', tag: null },
  { to: '/witnesses', label: 'Witness Prep', desc: 'AI-generated direct & cross examination questions', icon: Users, color: 'from-cyan-600 to-blue-700', tag: null },
  { to: '/research', label: 'Legal Research', desc: 'Case law, statutes, strategy & win probability', icon: BookOpen, color: 'from-indigo-600 to-purple-700', tag: null },
  { to: '/trial', label: 'Trial Coach', desc: 'Practice against AI judge, witnesses & counsel', icon: Swords, color: 'from-orange-600 to-red-700', tag: 'AI Battle' },
  { to: '/jury', label: 'Jury Simulator', desc: '6 AI jurors with distinct personalities & persuasion meters', icon: BarChart2, color: 'from-pink-600 to-rose-700', tag: 'Unique' },
  { to: '/deadlines', label: 'Deadline Tracker', desc: 'Never miss a filing deadline or court date', icon: Clock, color: 'from-yellow-600 to-amber-700', tag: null },
  { to: '/cases', label: 'Case Manager', desc: 'Track all cases, parties, notes & billing', icon: FolderOpen, color: 'from-slate-600 to-slate-700', tag: null },
];

export default function Dashboard() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Scale className="text-white" size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">CaseBuddy AI</h1>
          <p className="text-slate-400 mt-1">Your all-in-one AI legal wheelhouse — from intake to verdict</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'AI Modules', value: '9', icon: TrendingUp, color: 'text-blue-400', sub: 'All powered by Gemini' },
          { label: 'Time Saved', value: '10h+', icon: Clock, color: 'text-green-400', sub: 'Per case on average' },
          { label: 'Trial Modes', value: '8', icon: Swords, color: 'text-orange-400', sub: 'Judge, witness & more' },
          { label: 'Juror Profiles', value: '6', icon: BarChart2, color: 'text-pink-400', sub: 'Unique personalities' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <Icon className={color} size={20} />
            <div className="text-2xl font-bold text-white mt-2">{value}</div>
            <div className="text-sm text-slate-300 mt-0.5 font-medium">{label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Module Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">All Modules</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map(({ to, label, desc, icon: Icon, color, tag }) => (
            <Link key={to} to={to}
              className="group bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-500 transition-all hover:-translate-y-0.5 relative overflow-hidden">
              {tag && (
                <div className="absolute top-3 right-3 text-xs bg-blue-600/80 text-blue-100 px-2 py-0.5 rounded-full font-medium">{tag}</div>
              )}
              <div className={`inline-flex p-2.5 rounded-lg bg-gradient-to-br ${color} mb-3`}>
                <Icon className="text-white" size={20} />
              </div>
              <div className="font-semibold text-white group-hover:text-blue-300 transition-colors text-sm">{label}</div>
              <div className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Start */}
      <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/20 rounded-xl p-6">
        <div className="flex items-center gap-2 text-blue-400 font-semibold mb-3">
          <AlertTriangle size={16} /> Recommended Workflow
        </div>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          {[
            ['1. AI Intake', 'Let Alex interview the client and auto-build the case file'],
            ['2. Document Analysis', 'Upload evidence — get instant strategic analysis on each doc'],
            ['3. Discovery Miner', 'Feed all docs together to find contradictions & smoking guns'],
            ['4. Witness Prep', 'Generate cross & direct questions for every witness'],
            ['5. Legal Research', 'Research the key legal questions with win probability'],
            ['6. Trial Coach + Jury Sim', 'Practice your opening, cross-exam, and closing before trial'],
          ].map(([step, desc]) => (
            <div key={step} className="flex gap-2">
              <span className="text-blue-400 font-medium whitespace-nowrap">{step}:</span>
              <span className="text-slate-300">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
