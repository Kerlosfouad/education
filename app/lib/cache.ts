/**
 * High-performance In-Memory Cache with TTL and Tag-based Invalidation
 * Designed to dramatically reduce database traffic to Neon PostgreSQL.
 */

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
  tags?: string[];
};

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private inflightPromises = new Map<string, Promise<any>>();
  private tagIndex = new Map<string, Set<string>>();

  /**
   * Retrieve a value from the cache if not expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return undefined;
    }

    return entry.data as T;
  }

  /**
   * Store a value in the cache with a specified TTL (in seconds)
   */
  set<T>(key: string, data: T, ttlSeconds: number, tags: string[] = []): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { data, expiresAt, tags });

    // Index tags for fast tag-based invalidation
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  /**
   * Delete a specific cache key
   */
  delete(key: string): boolean {
    const entry = this.store.get(key);
    if (entry?.tags) {
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(key);
      }
    }
    return this.store.delete(key);
  }

  /**
   * Invalidate all keys matching a specific tag
   */
  invalidateTag(tag: string): void {
    const keys = this.tagIndex.get(tag);
    if (keys) {
      keys.forEach((key) => {
        this.store.delete(key);
      });
      this.tagIndex.delete(tag);
    }
  }

  /**
   * Invalidate all keys starting with a given prefix or matching a regex
   */
  invalidatePattern(prefixOrPattern: string | RegExp): void {
    const isRegex = prefixOrPattern instanceof RegExp;
    const cleanPrefix = typeof prefixOrPattern === 'string' ? prefixOrPattern.replace(/\*$/, '') : '';
    
    Array.from(this.store.keys()).forEach((key) => {
      const match = isRegex
        ? (prefixOrPattern as RegExp).test(key)
        : key.startsWith(cleanPrefix);
      if (match) {
        this.delete(key);
      }
    });
  }

  /**
   * Alias for invalidatePattern
   */
  deletePattern(prefixOrPattern: string | RegExp): void {
    this.invalidatePattern(prefixOrPattern);
  }

  /**
   * Remember helper: returns cached value or executes factory and caches result.
   * Includes Thundering Herd (dogpile) protection: concurrent calls await the same promise.
   */
  async remember<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
    tags: string[] = []
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Check if there is already an in-flight computation for this key
    const inFlight = this.inflightPromises.get(key);
    if (inFlight) {
      return inFlight as Promise<T>;
    }

    const promise = (async () => {
      try {
        const result = await factory();
        this.set(key, result, ttlSeconds, tags);
        return result;
      } finally {
        this.inflightPromises.delete(key);
      }
    })();

    this.inflightPromises.set(key, promise);
    return promise;
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.store.clear();
    this.inflightPromises.clear();
    this.tagIndex.clear();
  }
}

// Global singleton to survive Next.js HMR in development
declare global {
  var appCache: MemoryCache | undefined;
}

export const cache = globalThis.appCache ?? new MemoryCache();
if (process.env.NODE_ENV !== 'production') {
  globalThis.appCache = cache;
}
