/**
 * Tier-aware rate limiting for Edge Functions.
 *
 * Supports user tiers (free, pro, enterprise) with different rate limits.
 * Falls back to default limits when tier info is unavailable.
 */

const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// Default rate limits per function (requests per minute)
const RATE_LIMIT_DEFAULTS: Record<string, number> = {
  'gemini-proxy': 30,
  'openai-proxy': 30,
  'whisper-proxy': 10,
  'elevenlabs-proxy': 20,
  'ai-cache': 30,
  'ocr-proxy': 15,
};

// Tier-based multipliers for rate limits
type UserTier = 'free' | 'pro' | 'enterprise';

const TIER_MULTIPLIERS: Record<UserTier, number> = {
  free: 1.0,
  pro: 3.0,
  enterprise: 10.0,
};

// Tier-specific overrides per function (requests per minute)
const TIER_LIMITS: Record<UserTier, Record<string, number>> = {
  free: {
    'gemini-proxy': 15,
    'openai-proxy': 10,
    'whisper-proxy': 3,
    'elevenlabs-proxy': 5,
    'ai-cache': 15,
    'ocr-proxy': 5,
  },
  pro: {
    'gemini-proxy': 60,
    'openai-proxy': 60,
    'whisper-proxy': 20,
    'elevenlabs-proxy': 30,
    'ai-cache': 60,
    'ocr-proxy': 30,
  },
  enterprise: {
    'gemini-proxy': 200,
    'openai-proxy': 200,
    'whisper-proxy': 60,
    'elevenlabs-proxy': 100,
    'ai-cache': 200,
    'ocr-proxy': 100,
  },
};

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cache user tiers to avoid repeated DB lookups
const tierCache = new Map<string, { tier: UserTier; expiresAt: number }>();
const TIER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  tier?: UserTier;
}

/**
 * Get the user's tier, with caching.
 */
async function getUserTier(userId: string): Promise<UserTier> {
  // Check cache first
  const cached = tierCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tier;
  }

  // Try to fetch from database
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await supabase
      .from('user_tiers')
      .select('tier, expires_at')
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      // Check if tier has expired
      const tier: UserTier = data.expires_at && new Date(data.expires_at) < new Date()
        ? 'free'
        : (data.tier as UserTier) || 'free';

      tierCache.set(userId, { tier, expiresAt: Date.now() + TIER_CACHE_TTL_MS });
      return tier;
    }
  } catch {
    // If lookup fails, default to free
  }

  tierCache.set(userId, { tier: 'free', expiresAt: Date.now() + TIER_CACHE_TTL_MS });
  return 'free';
}

/**
 * Get rate limit for a user/function combination.
 */
function getMaxRequests(functionName: string, tier: UserTier): number {
  // Check tier-specific limits first
  const tierLimit = TIER_LIMITS[tier]?.[functionName];
  if (tierLimit !== undefined) {
    return tierLimit;
  }

  // Fall back to default with tier multiplier
  const base = RATE_LIMIT_DEFAULTS[functionName] ?? 20;
  const multiplier = TIER_MULTIPLIERS[tier] ?? 1.0;
  return Math.ceil(base * multiplier);
}

/**
 * Check rate limit for a user and function.
 * Now tier-aware: paid users get higher limits.
 */
export async function checkRateLimit(
  userId: string,
  functionName: string
): Promise<RateLimitResult> {
  const tier = await getUserTier(userId);
  const key = `${userId}:${functionName}`;
  const maxRequests = getMaxRequests(functionName, tier);
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
      tier,
    };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + RATE_LIMIT_WINDOW_MS,
      tier,
    };
  }

  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.windowStart + RATE_LIMIT_WINDOW_MS,
    tier,
  };
}

export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }

  // Also clean expired tier cache entries
  for (const [key, cached] of tierCache.entries()) {
    if (cached.expiresAt <= now) {
      tierCache.delete(key);
    }
  }
}

setInterval(cleanupRateLimitStore, 60 * 1000);
