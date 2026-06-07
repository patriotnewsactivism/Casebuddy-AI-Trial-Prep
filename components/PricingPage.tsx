import React, { useContext } from 'react';
import { Check, X, Crown, Building2, Zap, ArrowRight } from 'lucide-react';
import { AppContext } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { TIER_LIMITS, UserTier } from '../types';
import { toast } from 'react-toastify';

interface PlanConfig {
  tier: UserTier;
  name: string;
  price: string;
  period: string;
  description: string;
  icon: React.ElementType;
  highlight: boolean;
  features: string[];
  limitations?: string[];
}

const plans: PlanConfig[] = [
  {
    tier: 'pro',
    name: 'CaseBuddy Pro',
    price: '$499',
    period: '/month',
    description: 'Complete AI-powered legal trial preparation platform',
    icon: Crown,
    highlight: true,
    features: [
      'All 23+ AI-powered legal tools',
      'Full case pipeline — intake to resolution',
      'Unlimited AI requests',
      'Unlimited trial simulator sessions',
      'Unlimited OCR document pages',
      'Unlimited transcription',
      'Cloud case storage & sync',
      'ROI & billable hours tracker',
      'Court deadline engine (FRCP)',
      'Settlement calculator & negotiation sim',
      'Motion/brief writer (15 document types)',
      'Predictive analytics & win probability',
      'Evidence admissibility analyzer',
      'Mock jury deliberation',
      'AI Co-Counsel & Strategy Room',
      'Deposition outline generator',
      'Case law research',
      'Premium AI voices (ElevenLabs)',
      'Priority support',
    ],
  },
  {
    tier: 'enterprise',
    name: 'Enterprise BYOK',
    price: '$5,000',
    period: 'one-time',
    description: 'Bring your own API keys — own it forever',
    icon: Building2,
    highlight: false,
    features: [
      'Everything in CaseBuddy Pro',
      'One-time purchase — no monthly fees',
      'Bring your own API keys (OpenAI, Gemini, ElevenLabs)',
      'White-label branding & custom domain',
      'Self-hosted deployment option',
      'Unlimited seats — entire firm',
      'Team collaboration & case sharing',
      'Client portal with secure messaging',
      'Firm-wide analytics dashboard',
      'Custom AI training on your firm data',
      'Source code access',
      'SSO / SAML authentication',
      'API access for integrations',
      'Dedicated setup & onboarding',
    ],
  },
];

const formatLimit = (value: number | 'unlimited'): string => {
  if (value === 'unlimited') return 'Unlimited';
  return value.toLocaleString();
};

const PricingPage = () => {
  const { user } = useAuth();
  const currentPlan = user?.plan || 'free';

  const tierFromPlan: Record<string, UserTier> = {
    free: 'free',
    pro: 'pro',
    firm: 'enterprise',
  };

  const currentTier = tierFromPlan[currentPlan] || 'free';

  const handleUpgrade = (targetTier: UserTier) => {
    if (targetTier === currentTier) return;
    toast.info(
      'Subscription management is being set up. Contact support@casebuddy.live to upgrade your plan.',
      { autoClose: 5000, toastId: 'upgrade-info' }
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-white font-serif">Choose Your Plan</h1>
        <p className="text-slate-400 mt-2 max-w-xl mx-auto">
          Unlock the full power of AI-driven trial preparation. Upgrade anytime.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = plan.tier === currentTier;
          const Icon = plan.icon;

          return (
            <div
              key={plan.tier}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                plan.highlight
                  ? 'border-gold-500/50 bg-gold-500/5 shadow-lg shadow-gold-500/10'
                  : 'border-slate-700 bg-slate-800/50'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gold-500 text-slate-900 text-xs font-bold rounded-full uppercase tracking-wider">
                  Most Popular
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${plan.highlight ? 'bg-gold-500/20' : 'bg-slate-700'}`}>
                  <Icon size={20} className={plan.highlight ? 'text-gold-400' : 'text-slate-400'} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                  <p className="text-xs text-slate-400">{plan.description}</p>
                </div>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-slate-400 text-sm ml-1">{plan.period}</span>
              </div>

              {/* Usage limits summary */}
              <div className="grid grid-cols-2 gap-2 mb-6 p-3 bg-slate-900/50 rounded-lg text-xs">
                <div>
                  <p className="text-slate-500">AI Requests</p>
                  <p className="text-white font-semibold">{formatLimit(TIER_LIMITS[plan.tier].aiRequests)}/mo</p>
                </div>
                <div>
                  <p className="text-slate-500">Trial Sessions</p>
                  <p className="text-white font-semibold">{formatLimit(TIER_LIMITS[plan.tier].courtroomSessions)}/mo</p>
                </div>
                <div>
                  <p className="text-slate-500">Storage</p>
                  <p className="text-white font-semibold">{TIER_LIMITS[plan.tier].storageGb} GB</p>
                </div>
                <div>
                  <p className="text-slate-500">Transcription</p>
                  <p className="text-white font-semibold">{formatLimit(TIER_LIMITS[plan.tier].transcriptionMinutes)} min</p>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300">{feature}</span>
                  </li>
                ))}
                {plan.limitations?.map((limitation) => (
                  <li key={limitation} className="flex items-start gap-2 text-sm">
                    <X size={16} className="text-slate-600 shrink-0 mt-0.5" />
                    <span className="text-slate-500">{limitation}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              {isCurrentPlan ? (
                <button
                  disabled
                  className="w-full py-3 px-4 rounded-lg bg-slate-700 text-slate-400 font-semibold text-sm cursor-default"
                >
                  Current Plan
                </button>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.tier)}
                  className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                    plan.highlight
                      ? 'bg-gold-500 hover:bg-gold-600 text-slate-900'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  Upgrade to {plan.name}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
        <h2 className="text-xl font-bold text-white mb-6">Frequently Asked Questions</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-white mb-2">Can I change plans anytime?</h3>
            <p className="text-sm text-slate-400">Yes. Upgrade or downgrade at any time. Changes take effect immediately, and billing is prorated.</p>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">What happens when I hit a limit?</h3>
            <p className="text-sm text-slate-400">You'll be notified and prompted to upgrade. Your existing data is always accessible.</p>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">Is my data secure?</h3>
            <p className="text-sm text-slate-400">All data is encrypted at rest and in transit. We use Supabase with row-level security for strict data isolation.</p>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">Do you offer a free trial?</h3>
            <p className="text-sm text-slate-400">Yes! Contact us at support@casebuddy.live for a 14-day trial with full access to all features.</p>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">What does BYOK mean?</h3>
            <p className="text-sm text-slate-400">Bring Your Own Keys — use your own OpenAI, Gemini, or ElevenLabs API keys. You pay one time for the platform and control your own AI costs. No monthly subscription.</p>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">How much can CaseBuddy save a firm?</h3>
            <p className="text-sm text-slate-400">CaseBuddy replaces $15,000–$25,000/year in legal software subscriptions and saves 10–15 billable hours per case. The built-in ROI tracker shows exact savings.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
