interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  if (process.env.LUMIN_TEST === "true") {
    return { allowed: true, remaining: maxRequests };
  }
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}

// 导出 clearRateLimit，供注册成功时释放 key
export function clearRateLimit(key: string): void {
  store.delete(key);
}

export const RATE_LIMITS = {
  post: { maxRequests: 5, windowMs: 60 * 1000 },
  comment: { maxRequests: 10, windowMs: 60 * 1000 },
  register: { maxRequests: 10, windowMs: 60 * 60 * 1000 },
  login: { maxRequests: 5, windowMs: 60 * 1000 },
  report: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
} as const;
