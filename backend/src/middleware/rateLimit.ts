import type { Context, MiddlewareHandler } from "hono";

/** IP klien. Di Railway request lewat proxy, jadi X-Forwarded-For dipakai. */
export function clientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return c.req.header("x-real-ip") ?? "local";
}

/**
 * Rate limit sederhana (in-memory, fixed window per IP).
 * Cukup untuk satu instance; kalau nanti scale ke banyak instance, pindahkan ke Redis.
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  name: string;
}): MiddlewareHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, options.windowMs);
  sweep.unref?.();

  return async (c, next) => {
    const key = clientIp(c);
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > options.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json(
        { error: "too_many_requests", message: "Terlalu banyak permintaan, coba lagi sebentar lagi." },
        429
      );
    }

    return next();
  };
}
