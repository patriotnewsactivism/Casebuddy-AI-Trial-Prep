import React from 'react';
import { Scale, FolderOpen, UserPlus, FileSearch, Microscope, Swords, Users, BookOpen, Clock, BarChart2, TrendingUp, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AGENT_LIST } from '../agents/personas';

const MODULES = [
  { to: '/intake', label: 'AI Intake', desc: 'Smart client intake with Maya, your AI paralegal', icon: UserPlus, color: 'from-violet-600 to-purple-700', tag: 'Start Here', agent: 'Maya' },
  { to: '/documents', label: 'Document Analysis', desc: 'Upload docs — get facts, gems, risks & admissibility', icon: FileSearch, color: 'from-blue-600 to-cyan-700', tag: null, agent: 'Doc' },
  { to: '/discovery', label: 'Discovery Miner', desc: 'Cross-reference documents to find smoking guns', icon: Microscope, color: 'from-emerald-600 to-teal-700', tag: null, agent: 'Doc' },
  { to: '/witnesses', label: 'Witness Prep', desc: 'AI-generated direct & cross examination questions', icon: Users, color: 'from-orange-600 to-red-700', tag: null, agent: 'Rex' },
  { to: '/research', label: 'Legal Research', desc: 'Case law, statutes, strategy & win probability', icon: BookOpen, color: 'from-indigo-600 to-purple-700', tag: null, agent: 'Lex' },
  { to: '/trial', label: 'Trial Coach', desc: 'Practice against AI judge, witnesses & counsel', icon: Swords, color: 'from-orange-600 to-red-700', tag: 'AI Battle', agent: 'Rex' },
  { to: '/jury', label: 'Jury Simulator', desc: '6 AI jurors with distinct personalities & persuasion meters', icon: BarChart2, color: 'from-pink-600 to-rose-700', tag: 'Unique', agent: 'Jules' },
  { to: '/deadlines', label: 'Deadline Tracker', desc: 'Never miss a filing deadline or court date', icon: Clock, color: 'from-yellow-600 to-amber-700', tag: null, agent: 'Sol' },
  { to: '/cases', label: 'Case Manager', desc: 'Track all cases, parties, notes & billing', icon: FolderOpen, color: 'from-slate-600 to-slate-700', tag: null, agent: 'Max' },
];

export default function Dashboard() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">

      {/* Header */}
      <div className="text-center py-4">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Scale size={32} className="text-blue-400" />
          <h1 className="text-3xl font-black text-white">CaseBuddy AI</h1>
        </div>
        <p className="text-slate-400 text-base">Your all-in-one AI legal wheelhouse — from intake to verdict</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'AI Agents', value: '8', icon: TrendingUp, color: 'text-blue-400', sub: 'Named personas' },
          { label: 'Time Saved', value: '10h+', icon: Clock, color: 'text-green-400', sub: 'Per case avg' },
          { label: 'Trial Modes', value: '8', icon: Swords, color: 'text-orange-400', sub: 'Judge, witness & more' },
          { label: 'Juror Profiles', value: '6', icon: BarChart2, color: 'text-pink-400', sub: 'Unique personalities' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <Icon size={18} className={`${color} mb-2`} />
            <div className={`text-2xl font-black ${color}`}>{value}</div>
            <div className="text-white text-sm font-medium">{label}</div>
            <div className="text-slate-500 text-xs">{sub}</div>
          </div>
        ))}
      </div>

      {/* Module Grid */}
      <div>
        <h2 className="text-white font-bold text-lg mb-4">All Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map(({ to, label, desc, icon: Icon, color, tag, agent }) => (
            <Link key={to} to={to}
              className="bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl p-5 transition-all hover:scale-[1.02] group relative overflow-hidden">
              {tag && (
                <span className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{tag}</span>
              )}
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
                <Icon size={18} className="text-white" />
              </div>
              <h3 className="text-white font-semibold text-sm mb-1">{label}</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-2">{desc}</p>
              <p className="text-xs text-slate-500">Powered by <span className="text-slate-300 font-medium">{agent}</span></p>
            </Link>
          ))}
        </div>
      </div>

      {/* Meet the Team */}
      <div>
        <h2 className="text-white font-bold text-lg mb-1">Meet Your AI Legal Team</h2>
        <p className="text-slate-400 text-sm mb-5">8 specialized AI agents, each an expert in their domain</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {AGENT_LIST.map(agent => (
            <Link key={agent.id} to={agent.route}
              className="bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl p-4 transition-all hover:scale-[1.02] group">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-2xl mb-3 shadow-lg`}>
                {agent.emoji}
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-bold text-sm">{agent.name}</h3>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
              </div>
              <p className={`text-xs font-medium mb-2 ${agent.textColor}`}>{agent.title}</p>
              <p className="text-slate-400 text-xs leading-relaxed">{agent.description}</p>
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-500 italic">"{agent.personality}"</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Workflow */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h2 className="text-white font-bold text-base mb-4">⚡ Recommended Workflow</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { step: '1', agent: 'Maya', label: 'AI Intake', desc: 'Let Maya interview the client and auto-build the case file', to: '/intake', color: 'from-violet-600 to-purple-700' },
            { step: '2', agent: 'Doc', label: 'Document Analysis', desc: 'Upload evidence — get instant strategic analysis', to: '/documents', color: 'from-blue-600 to-cyan-700' },
            { step: '3', agent: 'Doc', label: 'Discovery Miner', desc: 'Feed all docs together to find smoking guns', to: '/discovery', color: 'from-emerald-600 to-teal-700' },
            { step: '4', agent: 'Rex', label: 'Witness Prep', desc: 'Generate cross & direct questions for every witness', to: '/witnesses', color: 'from-orange-600 to-red-700' },
            { step: '5', agent: 'Lex', label: 'Legal Research', desc: 'Research key legal questions with win probability', to: '/research', color: 'from-indigo-600 to-purple-700' },
            { step: '6', agent: 'Rex + Jules', label: 'Trial Coach + Jury Sim', desc: 'Practice your opening, cross-exam, and closing', to: '/trial', color: 'from-pink-600 to-rose-700' },
          ].map(({ step, agent, label, desc, to, color }) => (
            <Link key={step} to={to} className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-xl hover:bg-slate-700 transition-colors">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white font-black text-sm flex-shrink-0`}>
                {step}
              </div>
              <div>
                <p className="text-white text-xs font-semibold">{label} <span className="text-slate-400 font-normal">({agent})</span></p>
                <p className="text-slate-400 text-xs">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
