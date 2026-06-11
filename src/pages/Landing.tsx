import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, Mic, Briefcase, Clock, FileSearch, Shield, BarChart2, ArrowRight, Sparkles, ChevronRight } from 'lucide-react';
import { AGENT_LIST } from '../agents/personas';

// Public landing page — the front door of the firm. Full-bleed, no sidebar.
export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* ===== NAV ===== */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/70 border-b border-slate-800/60">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale size={22} className="text-violet-400" />
            <span className="font-black text-lg tracking-tight">CaseBuddy <span className="text-violet-400">AI</span></span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm text-slate-400">
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#team" className="hover:text-white transition-colors">Meet the Team</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
          </div>
          <Link to="/dashboard"
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
            Open App
          </Link>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <header className="relative">
        {/* Glow orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-0 w-[28rem] h-[28rem] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-72 left-1/3 w-72 h-72 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-5 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-full px-4 py-1.5 text-xs text-slate-300 mb-7">
            <Sparkles size={13} className="text-violet-400" />
            8 AI legal specialists · One connected case file · Live voice
          </div>

          <h1 className="text-4xl sm:text-6xl font-black leading-tight tracking-tight">
            Your Entire Law Firm.
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Powered by AI.
            </span>
          </h1>

          <p className="text-slate-400 text-lg max-w-2xl mx-auto mt-6 leading-relaxed">
            Talk to Maya like a real intake interview — out loud, hands-free. She opens the case file
            and briefs the whole team: deadlines, documents, research, witnesses, jury strategy.
            From first call to verdict, every department works the same case automatically.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link to="/intake"
              className="group flex items-center gap-2.5 bg-gradient-to-r from-violet-600 to-purple-700 hover:opacity-90 text-white font-bold px-8 py-4 rounded-2xl text-base shadow-2xl shadow-violet-900/40 transition-all">
              <Mic size={18} />
              Talk Live with Maya — Free Intake
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/dashboard"
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold px-8 py-4 rounded-2xl text-base transition-colors">
              Explore the Platform
            </Link>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto">
            {[
              { n: '8', label: 'AI specialists on staff' },
              { n: '13+', label: 'Legal tools, one case file' },
              { n: '24/7', label: 'Intake, research & prep' },
              { n: '1 click', label: 'Intake → full team briefed' },
            ].map(s => (
              <div key={s.label} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
                <div className="text-2xl font-black text-violet-400">{s.n}</div>
                <div className="text-slate-500 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how" className="max-w-6xl mx-auto px-5 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black">One conversation. The whole firm goes to work.</h2>
          <p className="text-slate-400 mt-3 max-w-xl mx-auto text-sm">
            No data entry, no copy-pasting between tools. The case flows through every department on its own.
          </p>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { step: '1', emoji: '⚖️', title: 'Maya interviews the client', desc: 'Speak naturally — live, two-way voice. Maya identifies claims, parties, urgency and case viability as you talk.' },
            { step: '2', emoji: '📋', title: 'The case file opens itself', desc: 'One click and Maya opens a persistent case file, then hands each department its assignment automatically.' },
            { step: '3', emoji: '🏛️', title: 'Every department works it', desc: 'Sol calendars the SOL, Doc mines your documents, Lex researches the claims, Rex preps witnesses, Jules tests the jury.' },
            { step: '4', emoji: '🏆', title: 'You walk in prepared', desc: 'Deadlines, evidence, research, examinations and a stress-tested theory — all in one war room, ready for court.' },
          ].map((s, i) => (
            <div key={s.step} className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-violet-500/40 transition-colors">
              <div className="text-3xl mb-3">{s.emoji}</div>
              <div className="text-violet-400 text-xs font-black tracking-widest mb-1">STEP {s.step}</div>
              <h3 className="font-bold text-sm mb-2">{s.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">{s.desc}</p>
              {i < 3 && <ChevronRight size={18} className="hidden md:block absolute top-1/2 -right-3 text-slate-700" />}
            </div>
          ))}
        </div>
      </section>

      {/* ===== MEET THE TEAM ===== */}
      <section id="team" className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/10 to-transparent pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-5">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black">Meet your new associates</h2>
            <p className="text-slate-400 mt-3 text-sm">Eight specialists. Zero billable hours. They share one case file and never drop a handoff.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {AGENT_LIST.map(a => (
              <Link key={a.id} to={a.route}
                className="group bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-600 hover:-translate-y-1 transition-all">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center text-2xl mb-4 shadow-lg`}>
                  {a.emoji}
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">{a.name}</h3>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Available now" />
                </div>
                <div className={`text-xs font-semibold ${a.textColor} mb-2`}>{a.title}</div>
                <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">{a.description}</p>
                <div className="flex items-center gap-1 text-xs text-slate-500 group-hover:text-white mt-3 transition-colors">
                  Work with {a.name} <ArrowRight size={11} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black">Built for the way attorneys actually work</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Mic, color: 'text-violet-400', title: 'Live two-way voice', desc: 'Talk hands-free with Maya and Rex. Your words send automatically when you pause; they answer out loud and keep listening.' },
            { icon: Briefcase, color: 'text-blue-400', title: 'The connected case file', desc: 'Intake opens it, every tool reads and writes it. Switch tools without re-explaining your case — the AI already knows it.' },
            { icon: Clock, color: 'text-yellow-400', title: 'Deadline & SOL engine', desc: 'Statute-of-limitations calculator with tolling rules, auto-calendared to the case. A missed deadline never sneaks up.' },
            { icon: FileSearch, color: 'text-cyan-400', title: 'Document Lab & Discovery Miner', desc: 'Upload documents and get key facts, hidden gems, risks — and cross-document contradictions and smoking guns.' },
            { icon: BarChart2, color: 'text-pink-400', title: 'Jury simulation', desc: 'Test your opening on six AI jurors with real personalities. See who you won, who you lost, and how to fix it before trial.' },
            { icon: Shield, color: 'text-amber-400', title: 'Conflict checks & compliance', desc: 'New parties cross-referenced against every case in the firm under ABA Model Rules, with waiver letters generated on demand.' },
          ].map(f => (
            <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-600 transition-colors">
              <f.icon size={22} className={`${f.color} mb-4`} />
              <h3 className="font-bold text-sm mb-2">{f.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="relative max-w-4xl mx-auto px-5 pb-24">
        <div className="relative bg-gradient-to-br from-violet-900/50 to-slate-900 border border-violet-500/30 rounded-3xl p-10 sm:p-14 text-center overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
          <h2 className="relative text-3xl sm:text-4xl font-black leading-tight">
            Your next case deserves a full team.
          </h2>
          <p className="relative text-slate-400 mt-4 max-w-md mx-auto text-sm">
            Start a live intake right now — no forms, no setup. Just tell Maya what happened.
          </p>
          <Link to="/intake"
            className="relative inline-flex items-center gap-2.5 bg-white text-slate-900 font-bold px-8 py-4 rounded-2xl text-base mt-8 hover:bg-slate-200 transition-colors">
            <Mic size={18} /> Start Talking to Maya <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-slate-800/60">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Scale size={16} className="text-violet-400" />
            <span className="font-bold text-white">CaseBuddy AI</span> · Legal Intelligence Platform
          </div>
          <p className="text-slate-600 text-xs text-center sm:text-right max-w-md">
            AI-generated output requires review by a licensed attorney. CaseBuddy AI is not a law firm and does not provide legal advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
