import React, { useState } from 'react';
import { Check, X, Star, Zap, Building2, Crown, ArrowRight, Shield, Users, Clock, FileText, Swords, BarChart2, MessageSquare, Globe, Sparkles } from 'lucide-react';

type BillingCycle = 'monthly' | 'annual';

interface PricingTier {
  id: string;
  name: string;
  icon: any;
  price: { monthly: number; annual: number };
  description: string;
  cta: string;
  popular: boolean;
  color: string;
  borderColor: string;
  features: { text: string; included: boolean }[];
  limits: string;
}

const TIERS: PricingTier[] = [
  {
    id: 'pro-se',
    name: 'Pro Se',
    icon: Zap,
    price: { monthly: 29, annual: 24 },
    description: 'Everything a self-represented litigant needs to fight and win.',
    cta: 'Start Free Trial',
    popular: false,
    color: 'from-blue-600 to-cyan-600',
    borderColor: 'border-blue-500/30',
    limits: '1 user · 5 active cases · 50 AI queries/day',
    features: [
      { text: 'Maya AI Intake — smart case builder', included: true },
      { text: 'Document Lab — analyze any document', included: true },
      { text: 'Discovery Miner — find smoking guns', included: true },
      { text: 'Witness Prep — cross & direct questions', included: true },
      { text: 'Trial Coach — practice against AI judge', included: true },
      { text: 'Jury Simulator — 6 AI jurors', included: true },
      { text: 'Legal Research — case law + statutes', included: true },
      { text: 'Deadline & SOL Tracker', included: true },
      { text: 'E-Filing Guide + Court Directory', included: true },
      { text: 'PDF Export (all modules)', included: true },
      { text: 'AI Legal Secretary (embed widget)', included: false },
      { text: 'PACER integration', included: false },
      { text: 'Unlimited AI queries', included: false },
      { text: 'White-label / custom branding', included: false },
      { text: 'Priority support', included: false },
    ],
  },
  {
    id: 'firm-starter',
    name: 'Law Firm Starter',
    icon: Building2,
    price: { monthly: 149, annual: 124 },
    description: 'For solo practitioners and small firms. Multiply your output.',
    cta: 'Start Free Trial',
    popular: true,
    color: 'from-violet-600 to-purple-600',
    borderColor: 'border-violet-500/50',
    limits: 'Up to 3 users · 25 active cases · 200 AI queries/day',
    features: [
      { text: 'Everything in Pro Se', included: true },
      { text: 'AI Legal Secretary — 24/7 client intake widget', included: true },
      { text: 'Lead capture + email notifications', included: true },
      { text: 'PACER case lookup integration', included: true },
      { text: 'CourtListener case law search', included: true },
      { text: 'SMS deadline alerts (Twilio)', included: true },
      { text: 'Email notifications (SendGrid)', included: true },
      { text: 'Cal.com consultation booking', included: true },
      { text: 'Certified mail service (Lob)', included: true },
      { text: '3 team member seats', included: true },
      { text: 'Unlimited AI queries', included: false },
      { text: 'White-label / custom branding', included: false },
      { text: 'Westlaw/Casetext integration', included: false },
      { text: 'Direct e-filing (Tyler Tech)', included: false },
      { text: 'Dedicated account manager', included: false },
    ],
  },
  {
    id: 'firm-pro',
    name: 'Law Firm Pro',
    icon: Crown,
    price: { monthly: 399, annual: 332 },
    description: 'Unlimited everything. White-label. Enterprise-grade AI for litigation.',
    cta: 'Contact Sales',
    popular: false,
    color: 'from-amber-500 to-orange-600',
    borderColor: 'border-amber-500/30',
    limits: 'Unlimited users · Unlimited cases · Unlimited AI queries',
    features: [
      { text: 'Everything in Firm Starter', included: true },
      { text: 'Unlimited AI queries (Gemini Pro)', included: true },
      { text: 'Unlimited users + seats', included: true },
      { text: 'White-label — your firm\'s brand', included: true },
      { text: 'Custom domain support', included: true },
      { text: 'Westlaw / Casetext premium research', included: true },
      { text: 'Direct e-filing (Tyler Technologies)', included: true },
      { text: 'DocuSign e-signatures', included: true },
      { text: 'Deepgram voice transcription', included: true },
      { text: 'Google Maps courthouse finder', included: true },
      { text: 'Admin dashboard + analytics', included: true },
      { text: 'Priority support + onboarding', included: true },
      { text: 'Dedicated account manager', included: true },
      { text: 'SOC 2 compliance ready', included: true },
      { text: 'API access', included: true },
    ],
  },
];

const TESTIMONIALS = [
  { name: 'Marcus T.', role: 'Pro Se Litigant, TX', quote: 'CaseBuddy\'s Witness Prep alone won me my case. Rex gave me cross-examination questions my attorney couldn\'t think of.', avatar: '⚖️' },
  { name: 'Sarah K.', role: 'Solo Practitioner, MS', quote: 'The AI Legal Secretary captures leads while I sleep. I signed 3 new clients in the first week.', avatar: '👩‍⚖️' },
  { name: 'James R.', role: 'Litigation Partner, GA', quote: 'We replaced $50K/yr in paralegal document review with Doc. Discovery Miner found a contradiction that settled our case.', avatar: '🏛️' },
];

const FAQ = [
  { q: 'Is my data secure?', a: 'Yes. All data is encrypted at rest and in transit. We use Supabase (PostgreSQL) with row-level security. We never train AI models on your case data. Attorney-client privilege is maintained.' },
  { q: 'Can I cancel anytime?', a: 'Absolutely. No contracts, no commitment. Cancel from your dashboard and your subscription ends at the current billing period. Export all your case data anytime.' },
  { q: 'Which AI model powers CaseBuddy?', a: 'Pro Se and Firm Starter use Gemini 2.5 Flash — fast and highly capable. Firm Pro upgrades to Gemini 2.5 Pro for the most complex legal analysis.' },
  { q: 'Is CaseBuddy a substitute for an attorney?', a: 'No. CaseBuddy is a legal technology tool that helps you prepare and organize your case. It does not provide legal advice. Always consult a licensed attorney for legal matters.' },
  { q: 'Can I use CaseBuddy for criminal defense?', a: 'Yes. While CaseBuddy was built for civil litigation, the Witness Prep, Trial Coach, Document Analysis, and Research modules work for any case type.' },
  { q: 'What courts does the E-Filing module support?', a: 'The E-Filing module provides formatting requirements, filing checklists, and court directories for all federal courts and most state courts. Direct e-filing (Firm Pro) supports Tyler Technologies courts.' },
];

export default function Pricing() {
  const [billing, setBilling] = useState<BillingCycle>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-16">
      {/* Hero */}
      <div className="text-center pt-8 space-y-4">
        <div className="inline-flex items-center gap-2 bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-medium px-4 py-1.5 rounded-full">
          <Sparkles size={14} /> 7-Day Free Trial — No Credit Card Required
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
          Your AI Legal Team.<br />
          <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">One Subscription.</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          8 AI agents. Unlimited case preparation. From $24/month.
        </p>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 pt-4">
          <span className={`text-sm ${billing === 'monthly' ? 'text-white font-medium' : 'text-slate-500'}`}>Monthly</span>
          <button onClick={() => setBilling(b => b === 'monthly' ? 'annual' : 'monthly')}
            className="relative w-14 h-7 rounded-full bg-slate-700 transition-colors">
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-violet-500 transition-all ${billing === 'annual' ? 'left-8' : 'left-1'}`} />
          </button>
          <span className={`text-sm ${billing === 'annual' ? 'text-white font-medium' : 'text-slate-500'}`}>Annual</span>
          {billing === 'annual' && <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full">Save 17%</span>}
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TIERS.map(tier => {
          const price = tier.price[billing];
          const Icon = tier.icon;
          return (
            <div key={tier.id}
              className={`relative bg-slate-800 border rounded-2xl overflow-hidden transition-all hover:scale-[1.02] ${tier.popular ? `border-violet-500/50 shadow-2xl shadow-violet-500/10` : `border-slate-700`}`}>
              {tier.popular && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-violet-600 to-purple-600 text-center py-1.5 text-white text-xs font-bold tracking-wider uppercase">
                  Most Popular
                </div>
              )}
              <div className={`p-6 ${tier.popular ? 'pt-10' : ''}`}>
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tier.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon size={22} className="text-white" />
                </div>
                <h3 className="text-white text-xl font-bold mb-1">{tier.name}</h3>
                <p className="text-slate-400 text-sm mb-4">{tier.description}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black text-white">${price}</span>
                  <span className="text-slate-500 text-sm">/mo</span>
                </div>
                <p className="text-slate-500 text-xs mb-6">{tier.limits}</p>
                <button className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${tier.popular
                  ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:opacity-90 shadow-lg shadow-violet-500/20'
                  : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
                  {tier.cta} <ArrowRight size={14} className="inline ml-1" />
                </button>
              </div>
              <div className="border-t border-slate-700 p-6 space-y-3">
                {tier.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    {f.included
                      ? <Check size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                      : <X size={16} className="text-slate-600 flex-shrink-0 mt-0.5" />
                    }
                    <span className={`text-sm ${f.included ? 'text-slate-300' : 'text-slate-600'}`}>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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

      {/* Feature comparison */}
      <div>
        <h2 className="text-white font-bold text-xl text-center mb-2">Every Module. Every Agent.</h2>
        <p className="text-slate-400 text-sm text-center mb-8">All plans include access to all 8 AI agents — the difference is scale, integrations, and team features.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users, label: 'Maya — AI Intake', desc: 'Smart client interviews' },
            { icon: FileText, label: 'Doc — Document Lab', desc: 'Analyze any legal doc' },
            { icon: Swords, label: 'Rex — Trial Coach', desc: 'Practice against AI judge' },
            { icon: BarChart2, label: 'Jules — Jury Sim', desc: '6 AI juror personalities' },
            { icon: Globe, label: 'Lex — Legal Research', desc: 'Case law + win odds' },
            { icon: Clock, label: 'Sol — Deadlines', desc: 'Never miss a date' },
            { icon: MessageSquare, label: 'Sierra — Secretary', desc: '24/7 lead capture' },
            { icon: Shield, label: 'Max — E-Filing', desc: 'Court records + filing' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
              <Icon size={20} className="text-blue-400 mx-auto mb-2" />
              <p className="text-white text-xs font-semibold">{label}</p>
              <p className="text-slate-500 text-xs">{desc}</p>
            </div>
          ))}
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

      {/* CTA */}
      <div className="bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/30 rounded-2xl p-8 text-center">
        <h2 className="text-white text-2xl font-black mb-2">Ready to Win Your Case?</h2>
        <p className="text-slate-300 text-sm mb-6 max-w-xl mx-auto">
          Join thousands of litigants and firms who use CaseBuddy AI to prepare stronger cases, faster.
          Start your 7-day free trial — no credit card required.
        </p>
        <button className="bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold px-8 py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/20">
          Start Your Free Trial <ArrowRight size={14} className="inline ml-1" />
        </button>
      </div>

      {/* Footer disclaimer */}
      <div className="text-center text-slate-600 text-xs pb-8">
        CaseBuddy AI is a legal technology tool, not a law firm. It does not provide legal advice.<br />
        Consult a licensed attorney for legal matters in your jurisdiction.
      </div>
    </div>
  );
}
