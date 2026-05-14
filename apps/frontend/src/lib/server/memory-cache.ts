import 'server-only';

/**
 * Tiny in-memory TTL cache. Per-process — works for local dev and a single
 * warm Vercel Function instance, but does NOT survive cold starts. Treat
 * everything as best-effort caching, never authoritative.
 *
 * For Vercel: each function invocation may see a fresh cache. Acceptable for
 * Gmail/IG list cache (5-min TTL, regenerates cheaply) but the AI insights
 * cache (30-min TTL) will rebuild more often than on a long-running server.
 */

interface Entry<T = unknown> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, Entry>();
  private lastPrune = 0;

  get<T = unknown>(key: string): T | null {
    this.maybePrune();
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt && e.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return e.value as T;
  }

  set<T = unknown>(key: string, value: T, ttlSeconds = 0) {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0,
    });
  }

  del(key: string) {
    this.store.delete(key);
  }

  delPattern(pattern: string) {
    if (!pattern.endsWith('*')) {
      this.store.delete(pattern);
      return;
    }
    const prefix = pattern.slice(0, -1);
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  private maybePrune() {
    const now = Date.now();
    if (now - this.lastPrune < 60_000) return;
    this.lastPrune = now;
    for (const [k, v] of this.store) {
      if (v.expiresAt && v.expiresAt < now) this.store.delete(k);
    }
  }
}

// Survive Next.js dev hot-reload (same pattern as prisma singleton).
const g = globalThis as unknown as { __memoryCache?: MemoryCache };
export const memoryCache: MemoryCache = g.__memoryCache ?? new MemoryCache();
if (process.env.NODE_ENV !== 'production') g.__memoryCache = memoryCache;
