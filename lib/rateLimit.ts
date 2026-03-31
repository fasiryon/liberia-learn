type RateLimitOptions = {
  windowMs: number;
  max: number;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

const rateLimitMap = new Map<string, RateLimitState>();

export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const current = rateLimitMap.get(key);

  if (!current || now > current.resetAt) {
    const resetAt = now + options.windowMs;
    rateLimitMap.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.max - 1, resetAt };
  }

  if (current.count >= options.max) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  rateLimitMap.set(key, current);
  return { allowed: true, remaining: options.max - current.count, resetAt: current.resetAt };
}

export function resetRateLimitStateForTests(): void {
  if (process.env.NODE_ENV === "test") {
    rateLimitMap.clear();
  }
}
