import React, { useState } from 'react';
import { Check, Star, Crown, ArrowRight, Shield, Users, Clock, FileText, Swords, BarChart2, MessageSquare, Globe, Sparkles, X, Zap, Lock, Headphones } from 'lucide-react';

const FEATURES = [
  { category: 'AI Agents (All 8 Included)', items: [
    'Maya — Smart AI Intake & Case Builder',
    'Doc — Document Lab + Discovery Miner',
    'Rex — Trial Coach & Witness Prep',
    'Jules — Jury Simulator (6 AI Jurors)',
    'Lex — Legal Research + Conflict Checker',
    'Sol — Deadline & SOL Tracker',
    'Sierra — AI Legal Secretary (24/7 Widget)',
    'Max — E-Filing Guide + Court Directory',
  ]},
  { category: 'Case Management', items: [
    'Unlimited active cases',
    'Full CRUD case manager with search & filters',
    'Priority & status tracking',
    'Witness database & prep packages',
    'PDF export from every module',
  ]},
  { category: 'Integrations', items: [
    'PACER case lookup',
    'CourtListener case law search',
    'SMS deadline alerts (Twilio)',
    'Email notifications (SendGrid)',
    'Cal.com consultation booking',
    'Certified mail service (Lob)',
    'DocuSign e-signatures',
    'Deepgram voice transcription',
    'Tyler Technologies e-filing',
  ]},
  { category: 'Platform', items: [
    'Unlimited AI queries (Gemini 2.5 Pro)',
    'Unlimited users & team seats',
    'White-label — your firm\'s branding',
    'Custom domain support',
    'Admin dashboard + analytics',
    'API access',
    'SOC 2 compliance ready',
    'Priority support + onboarding',
  ]},
];

const TESTIMONIALS = [
  { name: 'Marcus T.', role: 'Pro Se Litigant, TX', quote: 'CaseBuddy\'s Witness Prep alone won me my case. Rex gave me cross-examination questions my attorney couldn\'t think of.', avatar: '⚖️' },
  { name: 'Sarah K.', role: 'Solo Practitioner, MS', quote: 'The AI Legal Secretary captures leads while I sleep. I signed 3 new clients in the first week.', avatar: '👩‍⚖️' },
  { name: 'James R.', role: 'Litigation Partner, GA', quote: 'We replaced $50K/yr in paralegal document review with Doc. Discovery Miner found a contradiction that settled our case.', avatar: '🏛️' },
];

const FAQ = [
  { q: 'What happens during my 2-week free trial?', a: 'You get full, unrestricted access to all 8 AI agents, every integration, and unlimited queries for 14 days. No credit card required to start. If you love it (you will), subscribe at the end of your trial.' },
  { q: 'Is my data secure?', a: 'Yes. All data is encrypted at rest and in transit. We use Supabase (PostgreSQL) with row-level security. We never train AI models on your case data. Attorney-client privilege is maintained.' },
  { q: 'Can I cancel anytime?', a: 'Absolutely. No contracts, no commitment. Cancel from your dashboard and your subscription ends at the current billing period. Export all your case data anytime.' },
  { q: 'Which AI model powers CaseBuddy?', a: 'CaseBuddy runs on Gemini 2.5 Pro — Google\'s most capable reasoning model. Every agent has full access to Pro-tier intelligence.' },
  { q: 'Is CaseBuddy a substitute for an attorney?', a: 'No. CaseBuddy is a legal technology tool that helps you prepare and organize your case. It does not provide legal advice. Always consult a licensed attorney for legal matters.' },
  { q: 'Can I use CaseBuddy for criminal defense?', a: 'Yes. While CaseBuddy was built for civil litigation, the Witness Prep, Trial Coach, Document Analysis, and Research modules work for any case type — criminal, family, employment, and more.' },
  { q: 'How many team members can I add?', a: 'Unlimited. Your $499/mo subscription includes unlimited user seats, unlimited cases, and unlimited AI queries. Add your entire firm.' },
];

export default function Pricing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [annual, setAnnual] = useState(false);

  const monthlyPrice = 499;
  const annualMonthly = 399; // ~20% savings
  const price = annual ? annualMonthly : monthlyPrice;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-16">
      {/* Hero */}
      <div className="text-center pt-8 space-y-5">
        <div className="inline-flex items-center gap-2 bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-medium px-4 py-1.5 rounded-full">
          <Sparkles size={14} /> 14-Day Free Trial — No Credit Card Required
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
          Your Entire AI Legal Team.<br />
          <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">One Price. Everything Included.</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          8 AI agents. Unlimited cases. Unlimited users. Unlimited AI queries.<br />
          Two weeks free to prove it.
        </p>
      </div>

      {/* Single Pricing Card */}
      <div className="max-w-xl mx-auto">
        <div className="relative bg-slate-800 border-2 border-violet-500/50 rounded-2xl overflow-hidden shadow-2xl shadow-violet-500/10">
          {/* Header gradient */}
          <div className="bg-gradient-to-br from-violet-600 to-blue-600 p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Crown size={30} className="text-white" />
            </div>
            <h2 className="text-white text-2xl font-black">CaseBuddy AI</h2>
            <p className="text-violet-200 text-sm mt-1">Full platform access — nothing held back</p>
          </div>

          <div className="p-8">
            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className={`text-sm ${!annual ? 'text-white font-medium' : 'text-slate-500'}`}>Monthly</span>
              <button onClick={() => setAnnual(a => !a)}
                className="relative w-14 h-7 rounded-full bg-slate-700 transition-colors">
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-violet-500 transition-all ${annual ? 'left-8' : 'left-1'}`} />
              </button>
              <span className={`text-sm ${annual ? 'text-white font-medium' : 'text-slate-500'}`}>Annual</span>
              {annual && <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full">Save 20%</span>}
            </div>

            {/* Price */}
            <div className="text-center mb-6">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-black text-white">${price}</span>
                <span className="text-slate-500 text-lg">/mo</span>
              </div>
              {annual && <p className="text-slate-500 text-xs mt-1">Billed annually at ${annualMonthly * 12}/yr</p>}
              <p className="text-violet-400 text-sm font-medium mt-2">14-day free trial · Cancel anytime</p>
            </div>

            {/* CTA */}
            <button className="w-full py-4 rounded-xl font-bold text-base bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/20 mb-6">
              Start Your 2-Week Free Trial <ArrowRight size={16} className="inline ml-1" />
            </button>

            {/* Key highlights */}
            <div className="grid grid-cols-2 gap-3 mb-2">
              {[
                { icon: Users, label: 'Unlimited Users' },
                { icon: Zap, label: 'Unlimited AI Queries' },
                { icon: FileText, label: 'Unlimited Cases' },
                { icon: Lock, label: 'SOC 2 Ready' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 bg-slate-900/50 rounded-lg p-3">
                  <Icon size={16} className="text-violet-400 flex-shrink-0" />
                  <span className="text-white text-xs font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full Feature Breakdown */}
      <div>
        <h2 className="text-white font-bold text-xl text-center mb-2">Everything Included</h2>
        <p className="text-slate-400 text-sm text-center mb-8">No tiers, no upsells, no feature gates. You get all of it.</p>
        <div className="grid md:grid-cols-2 gap-6">
          {FEATURES.map(section => (
            <div key={section.category} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-500" />
                {section.category}
              </h3>
              <div className="space-y-2.5">
                {section.items.map(item => (
                  <div key={item} className="flex items-start gap-2.5">
                    <Check size={15} className="text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Grid */}
      <div>
        <h2 className="text-white font-bold text-xl text-center mb-2">Meet Your AI Legal Team</h2>
        <p className="text-slate-400 text-sm text-center mb-8">8 specialized agents, each an expert in their domain.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { emoji: '⚖️', name: 'Maya', role: 'Intake Specialist', desc: 'Interviews clients, builds case files' },
            { emoji: '📄', name: 'Doc', role: 'Document Analyst', desc: 'Analyze any document, find gems' },
            { emoji: '⚔️', name: 'Rex', role: 'Trial Coach', desc: 'Cross-exam & witness prep' },
            { emoji: '🎭', name: 'Jules', role: 'Jury Simulator', desc: '6 AI juror personalities' },
            { emoji: '📚', name: 'Lex', role: 'Legal Researcher', desc: 'Case law, statutes, strategy' },
            { emoji: '⏱️', name: 'Sol', role: 'Deadline Tracker', desc: 'SOL calculator + reminders' },
            { emoji: '💼', name: 'Sierra', role: 'Legal Secretary', desc: '24/7 client intake widget' },
            { emoji: '🗂️', name: 'Max', role: 'E-Filing Clerk', desc: 'Court records + filing guide' },
          ].map(agent => (
            <div key={agent.name} className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center hover:border-violet-500/40 transition-colors">
              <span className="text-3xl block mb-2">{agent.emoji}</span>
              <p className="text-white text-sm font-bold">{agent.name}</p>
              <p className="text-violet-400 text-xs font-medium">{agent.role}</p>
              <p className="text-slate-500 text-xs mt-1">{agent.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Social proof */}
      <div>
        <h2 className="text-white font-bold text-xl text-center mb-8">What Our Users Say</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-2xl">{t.avatar}</div>
                <div>
                  <p className="text-white text-sm font-semibold">{t.name}</p>
                  <p className="text-slate-500 text-xs">{t.role}</p>
                </div>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed italic">"{t.quote}"</p>
              <div className="flex gap-0.5 mt-3">
                {[...Array(5)].map((_, s) => <Star key={s} size={14} className="text-yellow-400 fill-yellow-400" />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust signals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-center">
          <Lock size={24} className="text-green-400 mx-auto mb-3" />
          <h3 className="text-white font-bold text-sm mb-1">Bank-Grade Security</h3>
          <p className="text-slate-400 text-xs">256-bit encryption. Row-level security. Your data never trains AI models. Attorney-client privilege maintained.</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-center">
          <Headphones size={24} className="text-blue-400 mx-auto mb-3" />
          <h3 className="text-white font-bold text-sm mb-1">Priority Support</h3>
          <p className="text-slate-400 text-xs">Dedicated onboarding. Response within 2 hours. We help you set up integrations and get your first case loaded.</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-center">
          <Shield size={24} className="text-violet-400 mx-auto mb-3" />
          <h3 className="text-white font-bold text-sm mb-1">No Risk. No Lock-In.</h3>
          <p className="text-slate-400 text-xs">14-day free trial. Cancel anytime. Export all your case data whenever you want. We earn your business every month.</p>
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-white font-bold text-xl text-center mb-8">Frequently Asked Questions</h2>
        <div className="max-w-3xl mx-auto space-y-2">
          {FAQ.map((item, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-750">
                <span className="text-white text-sm font-medium">{item.q}</span>
                {openFaq === i ? <X size={16} className="text-slate-400 flex-shrink-0" /> : <ArrowRight size={16} className="text-slate-400 flex-shrink-0" />}
              </button>
              {openFaq === i && <div className="px-5 pb-4 text-slate-400 text-sm leading-relaxed">{item.a}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/30 rounded-2xl p-8 text-center">
        <h2 className="text-white text-2xl font-black mb-2">Ready to Win Your Case?</h2>
        <p className="text-slate-300 text-sm mb-4 max-w-xl mx-auto">
          8 AI agents. Unlimited everything. Two weeks free.
        </p>
        <div className="flex flex-col items-center gap-3">
          <button className="bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold px-8 py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/20">
            Start Your 2-Week Free Trial <ArrowRight size={14} className="inline ml-1" />
          </button>
          <p className="text-slate-500 text-xs">No credit card required · Cancel anytime</p>
        </div>
      </div>

      {/* Footer disclaimer */}
      <div className="text-center text-slate-600 text-xs pb-8">
        CaseBuddy AI is a legal technology tool, not a law firm. It does not provide legal advice.<br />
        Consult a licensed attorney for legal matters in your jurisdiction.
      </div>
    </div>
  );
}
