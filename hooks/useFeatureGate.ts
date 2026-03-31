import { useAuth, SubscriptionPlan } from '../contexts/AuthContext';
import { TIER_LIMITS, UserTier, TierLimits } from '../types';
import { toast } from 'react-toastify';

const planToTier: Record<SubscriptionPlan, UserTier> = {
  free: 'free',
  pro: 'pro',
  firm: 'enterprise',
};

export function useFeatureGate() {
  const { user } = useAuth();
  const plan = user?.plan || 'free';
  const tier = planToTier[plan];
  const limits: TierLimits = TIER_LIMITS[tier];

  const checkLimit = (feature: keyof TierLimits, currentUsage: number): boolean => {
    const limit = limits[feature];
    if (limit === 'unlimited') return true;
    return currentUsage < limit;
  };

  const gateFeature = (feature: keyof TierLimits, currentUsage: number): boolean => {
    if (checkLimit(feature, currentUsage)) return true;
    const limit = limits[feature];
    toast.error(
      `You've reached your ${plan} plan limit of ${limit} for this feature. Upgrade to continue.`,
      { toastId: `gate-${feature}` }
    );
    return false;
  };

  const isProFeature = (featureName: string): boolean => {
    // Features only available on pro+ plans
    const proFeatures = ['settlement', 'negotiation', 'deposition', 'case-law', 'admissibility', 'mock-jury'];
    return proFeatures.includes(featureName) && plan === 'free';
  };

  return { plan, tier, limits, checkLimit, gateFeature, isProFeature };
}
