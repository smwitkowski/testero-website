import { promises as fsPromises } from "fs";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  fileModTime: number;
}

export class ContentCache {
  private cache: Map<string, CacheEntry<unknown>>;
  private ttl: number;
  private maxSize: number;
  private accessOrder: string[];

  constructor(ttl: number = 5 * 60 * 1000, maxSize: number = 100) {
    // Default 5 minutes TTL, 100 items max
    this.cache = new Map();
    this.ttl = ttl;
    this.maxSize = maxSize;
    this.accessOrder = [];
  }

  /**
   * Get cached content if it exists and is still valid
   */
  async get<T>(key: string, filePath: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if cache entry has expired by TTL
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    // Check if file has been modified since cached
    try {
      const stats = await fsPromises.stat(filePath);
      const fileModTime = stats.mtime.getTime();

      if (fileModTime > entry.fileModTime) {
        // File has been modified, invalidate cache
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        return null;
      }
    } catch {
      // If we can't stat the file, invalidate the cache entry
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    // Update access order for LRU
    this.updateAccessOrder(key);

    return entry.data;
  }

  /**
   * Set content in cache with file modification time
   */
  async set<T>(key: string, data: T, filePath: string): Promise<void> {
    try {
      const stats = await fsPromises.stat(filePath);
      const fileModTime = stats.mtime.getTime();

      // Check if we need to evict entries due to size limit
      if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
        // Evict least recently used entry
        const lruKey = this.accessOrder[0];
        if (lruKey) {
          this.cache.delete(lruKey);
          this.removeFromAccessOrder(lruKey);
        }
      }

      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        fileModTime,
      });

      this.updateAccessOrder(key);
    } catch (error) {
      // If we can't stat the file, don't cache
      console.error(`Failed to cache content for ${key}:`, error);
    }
  }

  /**
   * Invalidate a specific cache entry
   */
  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
    this.removeFromAccessOrder(key);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Update access order for LRU eviction
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order array
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
}

// Create a singleton instance for the content loader
export const contentCache = new ContentCache();
