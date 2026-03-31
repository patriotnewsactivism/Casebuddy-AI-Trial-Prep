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
    tier: 'free',
    name: 'Starter',
    price: '$0',
    period: 'forever',
    description: 'Get started with essential trial prep tools',
    icon: Zap,
    highlight: false,
    features: [
      'Up to 5 trial simulator sessions/month',
      '100 AI requests/month',
      '50 OCR document pages',
      '10 minutes transcription',
      '1 GB storage',
      'AI Co-Counsel chat',
      'Case management',
      'Evidence timeline',
    ],
    limitations: [
      'Basic voice (browser TTS)',
      'No settlement calculator',
      'No mock jury deliberation',
      'No deposition outlines',
    ],
  },
  {
    tier: 'pro',
    name: 'Professional',
    price: '$49',
    period: '/month',
    description: 'Full trial prep suite for practicing attorneys',
    icon: Crown,
    highlight: true,
    features: [
      '100 trial simulator sessions/month',
      '1,000 AI requests/month',
      '1,000 OCR document pages',
      '5 hours transcription',
      '50 GB storage',
      'Premium AI voices (ElevenLabs)',
      'Settlement calculator',
      'Mock jury deliberation',
      'Deposition outline generator',
      'Case law research',
      'Evidence admissibility analyzer',
      'Negotiation simulator',
      'Performance analytics',
      'Priority support',
    ],
  },
  {
    tier: 'enterprise',
    name: 'Firm',
    price: '$199',
    period: '/month',
    description: 'For law firms with team collaboration needs',
    icon: Building2,
    highlight: false,
    features: [
      'Unlimited trial simulator sessions',
      '10,000 AI requests/month',
      'Unlimited OCR pages',
      '50 hours transcription',
      '500 GB storage',
      'Everything in Professional',
      'Team collaboration & case sharing',
      'Multi-user access (up to 10 seats)',
      'Firm-wide analytics',
      'Custom AI training on firm data',
      'Dedicated account manager',
      'SSO / SAML authentication',
      'API access',
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
      'Subscription management is being set up. Contact support@casebuddy.ai to upgrade your plan.',
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
            <h3 className="font-semibold text-white mb-2">Do you offer a free trial of Pro?</h3>
            <p className="text-sm text-slate-400">Yes! Contact us at support@casebuddy.ai for a 14-day Pro trial with full access to all features.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
