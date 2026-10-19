import ApiError from '../utils/ApiError.js';

/**
 * Minimal in-memory sliding-window rate limiter (no new dependencies).
 *
 * Deployment scope: SINGLE backend instance. Limits do NOT span instances;
 * see the note on shared stores below. The key is the authenticated user id
 * (never a spoofable forwarding header — X-Forwarded-For is untrusted unless
 * the proxy is explicitly configured, so only req.ip is used as fallback).
 *
 * A shared store (e.g. Redis) was deliberately NOT added: the stack has no
 * shared cache dependency, and per-instance limits plus low AI ceilings are
 * proportionate. Multi-instance deployments must front instances with a
 * shared limiter or sticky sessions; the 429 contract stays identical.
 */

const buckets = new Map();
// Memory-DoS guard: bound the bucket table; oldest entries evicted first
// (Map preserves insertion order).
const MAX_BUCKETS = 10000;

const pruneBuckets = () => {
  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next();
    if (oldest.done) break;
    buckets.delete(oldest.value);
  }
};

const hit = (key, windowMs, max) => {
  const nowMs = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= nowMs) {
    bucket = { count: 0, resetAt: nowMs + windowMs };
    buckets.delete(key);
    buckets.set(key, bucket);
    pruneBuckets();
  }
  bucket.count += 1;
  if (bucket.count > max) {
    const retryAfter = Math.ceil((bucket.resetAt - nowMs) / 1000);
    throw new ApiError(429, 'Too many requests. Please slow down and try again.', { retryAfter });
  }
};

/** Returns Express middleware limiting each authenticated user (fallback: IP). */
export const rateLimit = ({ windowMs = 60_000, max = 30 } = {}) =>
  (req, _res, next) => {
    const key = `rl:${req.user?._id || req.ip || 'anon'}`;
    try {
      hit(key, windowMs, max);
      return next();
    } catch (err) {
      return next(err);
    }
  };

export const aiChatLimiter = rateLimit({ windowMs: 60_000, max: 30 });
export const aiConfirmLimiter = rateLimit({ windowMs: 60_000, max: 10 });

/** Test hook: clears all buckets (tests only — never exposed over HTTP). */
export const resetRateLimits = () => buckets.clear();

export default rateLimit;
