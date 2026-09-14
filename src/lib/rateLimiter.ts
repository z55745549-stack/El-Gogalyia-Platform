/**
 * Rate limiting for API endpoints (client-side)
 * In production, this should be server-side (express-rate-limit / Cloud Functions)
 * This provides defense-in-depth on client
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const limits = new Map<string, RateLimitEntry>();

export const RATE_LIMITS = {
  bans_read: { max: 20, windowMs: 15 * 60 * 1000 }, // 20 reads per 15 min
  bans_write: { max: 5, windowMs: 60 * 60 * 1000 },  // 5 bans per hour
  meetings_read: { max: 100, windowMs: 15 * 60 * 1000 },
  meetings_write: { max: 10, windowMs: 60 * 60 * 1000 },
  general: { max: 100, windowMs: 15 * 60 * 1000 },
};

export function checkRateLimit(key: string, limitConfig: { max: number; windowMs: number } = RATE_LIMITS.general): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = limits.get(key);
  if (!entry || now > entry.resetTime) {
    limits.set(key, { count: 1, resetTime: now + limitConfig.windowMs });
    return { allowed: true, remaining: limitConfig.max - 1, resetIn: limitConfig.windowMs };
  }
  if (entry.count >= limitConfig.max) {
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
  }
  entry.count++;
  return { allowed: true, remaining: limitConfig.max - entry.count, resetIn: entry.resetTime - now };
}

export function rateLimitOrThrow(key: string, config?: { max: number; windowMs: number }) {
  const result = checkRateLimit(key, config);
  if (!result.allowed) {
    const seconds = Math.ceil(result.resetIn / 1000);
    throw new Error(`Rate limit exceeded. Try again in ${seconds} seconds.`);
  }
  return result;
}

// Clear old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limits.entries()) {
    if (now > entry.resetTime) limits.delete(key);
  }
}, 60 * 1000);
