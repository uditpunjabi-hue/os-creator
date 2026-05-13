/**
 * Tiny in-memory TTL cache. Drop-in replacement for the Redis calls my
 * services made (get / set with EX seconds / del / keys-pattern-del).
 *
 * Single-process only — perfect for the Illuminati single-node dev setup,
 * NOT a substitute for Redis in a clustered deploy. Each Node worker gets
 * its own cache; that's fine for `pnpm run dev`.
 */

interface Entry<T = unknown> {
  value: T;
  expiresAt: number; // epoch ms, 0 = never
}

class MemoryCache {
  private store = new Map<string, Entry>();
  // Lazy expiry sweep so we don't run a timer; clean on read + periodic prune.
  private lastPrune = 0;

  get<T = unknown>(key: string): T | null {
    this.maybePrune();
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
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

  /** Delete every key matching a `prefix:*` style pattern (simple glob with one trailing star). */
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
    if (now - this.lastPrune < 60_000) return; // at most once per minute
    this.lastPrune = now;
    for (const [k, v] of this.store) {
      if (v.expiresAt && v.expiresAt < now) this.store.delete(k);
    }
  }
}

export const memoryCache = new MemoryCache();
