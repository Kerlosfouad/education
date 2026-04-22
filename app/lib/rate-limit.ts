const attempts = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple in-memory rate limiter
 * @param key - identifier (e.g. IP or email)
 * @param maxAttempts - max allowed attempts
 * @param windowMs - time window in ms
 */
export function checkRateLimit(key: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) return false;

  entry.count++;
  return true;
}

export function resetRateLimit(key: string) {
  attempts.delete(key);
}
