import React, { useState } from 'react';
import {
  Scale, FolderOpen, UserPlus, FileSearch, Microscope, Swords, Users,
  BookOpen, Clock, BarChart2, TrendingUp, Link2, Check, Mic, ArrowRight, Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AGENT_LIST, AGENTS } from '../agents/personas';
import { useCases, useActiveCase, firmMinutesSaved, formatHoursSaved, cloudSyncEnabled, createDemoCase } from '../lib/caseStore';

const BILLABLE_RATE = 250;

const MODULES = [
  { to: '/intake',    label: 'AI Intake',         desc: 'Smart client intake with Maya, your AI paralegal',              icon: UserPlus,  color: 'from-violet-600 to-purple-700',  tag: 'Start Here', agent: 'Maya' },
  { to: '/documents', label: 'Document Analysis', desc: 'Upload docs — get facts, gems, risks & admissibility',         icon: FileSearch, color: 'from-blue-600 to-cyan-700',    tag: null,        agent: 'Doc' },
  { to: '/contracts', label: 'Contract Review',   desc: 'Flag risky clauses, missing provisions & redline suggestions',  icon: FileSearch, color: 'from-emerald-600 to-green-700', tag: 'New',        agent: 'Nova' },
  { to: '/discovery', label: 'Discovery Miner',   desc: 'Cross-reference documents to find smoking guns',                icon: Microscope, color: 'from-emerald-600 to-teal-700', tag: null,        agent: 'Doc' },
  { to: '/witnesses', label: 'Witness Prep',       desc: 'AI-generated direct & cross examination questions',             icon: Users,     color: 'from-orange-600 to-red-700',   tag: null,        agent: 'Rex' },
  { to: '/research',  label: 'Legal Research',     desc: 'Case law, statutes, strategy & win probability',                icon: BookOpen,  color: 'from-indigo-600 to-purple-700', tag: null,        agent: 'Lex' },
  { to: '/trial',     label: 'Trial Coach',        desc: 'Practice against AI judge, witnesses & counsel',                icon: Swords,    color: 'from-orange-600 to-red-700',   tag: 'AI Battle', agent: 'Rex' },
  { to: '/jury',      label: 'Jury Simulator',     desc: '6 AI jurors with distinct personalities & persuasion meters',  icon: BarChart2, color: 'from-pink-600 to-rose-700',   tag: 'Unique',    agent: 'Jules' },
  { to: '/deadlines', label: 'Deadline Tracker',   desc: 'Never miss a filing deadline or court date',                   icon: Clock,     color: 'from-yellow-600 to-amber-700', tag: null,        agent: 'Sol' },
  { to: '/cases',     label: 'Case Manager',       desc: 'Track all cases, parties, notes & billing',                    icon: FolderOpen, color: 'from-slate-600 to-slate-700', tag: null,        agent: 'Max' },
];

export default function Dashboard() {
  const cases = useCases();
  const activeCase = useActiveCase();
  const [copied, setCopied] = useState(false);
  const minutes = firmMinutesSaved(cases);
  const hours = formatHoursSaved(minutes);
  const dollars = Math.round((minutes / 60) * BILLABLE_RATE).toLocaleString();
  const newClientIntakes = cases.filter(c => c.source === 'client-link').length;
  const intakeLink = `${window.location.origin}/start`;

  const pendingTasks = activeCase ? activeCase.tasks.filter(t => t.status !== 'done') : [];
  const doneTasks = activeCase ? activeCase.tasks.filter(t => t.status === 'done') : [];
  const progress = activeCase && activeCase.tasks.length > 0
    ? Math.round((doneTasks.length / activeCase.tasks.length) * 100)
    : 0;

  const copyLink = () => {
    navigator.clipboard?.writeText(intakeLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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

      {/* ROI stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Billable Hours Saved', value: `${hours}h`, icon: Clock,      color: 'text-green-400',  sub: `≈ $${dollars} at $${BILLABLE_RATE}/hr` },
          { label: 'Active Cases',          value: String(cases.length), icon: FolderOpen, color: 'text-violet-400', sub: newClientIntakes ? `${newClientIntakes} via client link` : 'Across the firm' },
          { label: 'AI Agents',             value: '9',       icon: TrendingUp, color: 'text-blue-400',   sub: 'Working every case' },
          { label: 'Juror Profiles',        value: '6',       icon: BarChart2,  color: 'text-pink-400',   sub: 'Unique personalities' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <Icon size={18} className={`${color} mb-2`} />
            <div className={`text-2xl font-black ${color}`}>{value}</div>
            <div className="text-white text-sm font-medium">{label}</div>
            <div className="text-slate-500 text-xs">{sub}</div>
          </div>
        ))}
      </div>

      {/* Client intake link */}
      <div className="bg-gradient-to-br from-violet-900/40 to-slate-800 border border-violet-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center gap-5">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shrink-0">
          <Mic size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-bold text-base">Your public intake link</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Send this to any potential client — they just talk to Maya, and the finished case file lands here with every department briefed.
            {!cloudSyncEnabled && ' (Connect Supabase env keys so client-submitted cases sync across devices.)'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-violet-300 text-xs font-mono truncate max-w-full">{intakeLink}</code>
            <button onClick={copyLink}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors">
              {copied ? <><Check size={13} /> Copied!</> : <><Link2 size={13} /> Copy Link</>}
            </button>
            <Link to="/start" className="text-slate-400 hover:text-white text-xs underline underline-offset-2">Preview it →</Link>
          </div>
        </div>
      </div>

      {/* Active Case Pipeline / Start Journey CTA */}
      {!activeCase ? (
        <div className="bg-gradient-to-br from-violet-900/30 to-blue-900/20 border border-violet-500/30 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center mx-auto mb-4 text-3xl shadow-lg shadow-violet-900/40">
            ⚖️
          </div>
          <h2 className="text-white font-bold text-xl mb-2">Start Your Case Journey</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-lg mx-auto">
            Tell Maya about your situation in plain English. She’ll build your full case file and automatically brief all 9 department heads — from Lex on research to Jules in the jury room.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/intake"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold px-8 py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity shadow-lg shadow-violet-900/30"
            >
              <UserPlus size={16} /> Start with Maya →
            </Link>
            <button
              onClick={() => createDemoCase()}
              className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-colors"
            >
              <Sparkles size={16} className="text-blue-400" /> Try Demo Case
            </button>
          </div>
          <p className="text-slate-600 text-xs mt-4">Demo loads a pre-built personal injury case with all 9 departments briefed</p>
        </div>
      ) : pendingTasks.length > 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-white font-bold text-base">⚡ Active Case Pipeline</h2>
              <p className="text-slate-400 text-sm mt-0.5">
                <span className="text-white font-medium">{activeCase.clientName}</span>
                {' '}<span className="text-slate-600">—</span>{' '}
                {activeCase.caseType}
              </p>
            </div>
            <div className="text-right min-w-[90px]">
              <p className="text-slate-500 text-xs mb-1.5">{doneTasks.length}/{activeCase.tasks.length} done</p>
              <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden ml-auto">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendingTasks.slice(0, 6).map(task => {
              const taskAgent = AGENTS[task.agentId];
              if (!taskAgent) return null;
              return (
                <Link
                  key={task.id}
                  to={task.route}
                  className="flex items-start gap-3 p-4 bg-slate-700/40 hover:bg-slate-700 border border-slate-600/50 rounded-xl transition-all group"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${taskAgent.color} flex items-center justify-center text-lg flex-shrink-0 shadow-sm`}>
                    {taskAgent.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold leading-snug">{task.title}</p>
                    <p className={`text-xs font-medium mt-0.5 ${taskAgent.textColor}`}>{taskAgent.name}</p>
                    <p className="text-slate-500 text-xs mt-1 line-clamp-1">{task.detail}</p>
                  </div>
                  <ArrowRight size={14} className="text-slate-600 group-hover:text-slate-300 transition-colors flex-shrink-0 mt-1" />
                </Link>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
            <p className="text-slate-500 text-xs">
              {pendingTasks.length} department{pendingTasks.length !== 1 ? 's' : ''} waiting to work this case
            </p>
            <Link to={`/cases/${activeCase.id}`} className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors">
              View Full Case →
            </Link>
          </div>
        </div>
      ) : null}

      {/* Module Grid */}
      <div>
        <h2 className="text-white font-bold text-lg mb-4">All Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map(({ to, label, desc, icon: Icon, color, tag, agent }) => (
            <Link key={to} to={to}
              className="bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl p-5 transition-all hover:scale-[1.02] group relative overflow-hidden">
              {tag && (
                <span className={`absolute top-3 right-3 text-white text-xs font-bold px-2 py-0.5 rounded-full ${
                  tag === 'New' ? 'bg-emerald-600' : 'bg-blue-600'
                }`}>{tag}</span>
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
        <p className="text-slate-400 text-sm mb-5">9 specialized AI agents, each an expert in their domain</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENT_LIST.map(a => (
            <Link key={a.id} to={a.route}
              className="bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl p-4 transition-all hover:scale-[1.02] group">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center text-2xl mb-3 shadow-lg`}>
                {a.emoji}
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-bold text-sm">{a.name}</h3>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
              </div>
              <p className={`text-xs font-medium mb-2 ${a.textColor}`}>{a.title}</p>
              <p className="text-slate-400 text-xs leading-relaxed">{a.description}</p>
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-500 italic">"{a.personality}"</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recommended Workflow */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h2 className="text-white font-bold text-base mb-4">⚡ Recommended Workflow</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { step: '1', agent: 'Maya',      label: 'AI Intake',          desc: 'Let Maya interview the client and auto-build the case file',       to: '/intake',    color: 'from-violet-600 to-purple-700' },
            { step: '2', agent: 'Doc',       label: 'Document Analysis',  desc: 'Upload evidence — get instant strategic analysis',                to: '/documents', color: 'from-blue-600 to-cyan-700' },
            { step: '3', agent: 'Nova',      label: 'Contract Review',    desc: 'Review any contracts for risky clauses and redlines',              to: '/contracts', color: 'from-emerald-600 to-green-700' },
            { step: '4', agent: 'Lex',       label: 'Legal Research',     desc: 'Research key legal questions with win probability',                to: '/research',  color: 'from-indigo-600 to-purple-700' },
            { step: '5', agent: 'Rex',       label: 'Witness Prep',       desc: 'Generate cross & direct questions for every witness',              to: '/witnesses', color: 'from-orange-600 to-red-700' },
            { step: '6', agent: 'Rex+Jules', label: 'Trial Coach + Jury', desc: 'Practice your opening, cross-exam, and closing',                  to: '/trial',     color: 'from-pink-600 to-rose-700' },
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
