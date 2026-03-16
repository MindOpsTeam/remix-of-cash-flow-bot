/**
 * Cache em memória para parâmetros municipais e códigos de serviço.
 * TTL padrão: 24 horas (parâmetros mudam raramente).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export class ParametrosCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  invalidate(keyPrefix?: string): void {
    if (!keyPrefix) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyPrefix)) this.cache.delete(key);
    }
  }

  stats(): { entries: number; keys: string[] } {
    // Clean expired on access
    for (const [key, entry] of this.cache.entries()) {
      if (Date.now() > entry.expiresAt) this.cache.delete(key);
    }
    return { entries: this.cache.size, keys: Array.from(this.cache.keys()) };
  }
}

export const parametrosCache = new ParametrosCache();
