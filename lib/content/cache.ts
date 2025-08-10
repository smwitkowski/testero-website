/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Enhanced Content Cache System for Testero
 * 
 * Provides intelligent caching for processed content with file-system
 * change detection, TTL-based expiration, and LRU eviction policies.
 * 
 * Features:
 * - File modification time tracking for cache invalidation
 * - Configurable TTL (5 minutes in development by default)
 * - LRU eviction for memory management
 * - Batch invalidation and cache statistics
 * - Performance monitoring and metrics
 */

import { promises as fsPromises } from "fs";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  fileModTime: number;
  accessCount: number;
  size: number; // Approximate size in bytes
}

interface CacheStats {
  size: number;
  maxSize: number;
  ttl: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  totalEvictions: number;
  averageProcessingTime: number;
  keys: string[];
  memoryUsage: number; // Approximate memory usage in bytes
  missCount: number; // For backward compatibility
}

export class ContentCache {
  private cache: Map<string, CacheEntry<unknown>>;
  private ttl: number;
  private maxSize: number;
  private accessOrder: string[];
  private hitCount: number = 0;
  private missCount: number = 0;
  private evictionCount: number = 0;
  private processingTimes: number[] = [];

  constructor(ttl: number = 5 * 60 * 1000, maxSize: number = 100) {
    // Default 5 minutes TTL in development, 100 items max
    this.cache = new Map();
    this.ttl = ttl;
    this.maxSize = maxSize;
    this.accessOrder = [];
    
    // Log cache configuration
    console.log(`ContentCache initialized: TTL=${ttl}ms, MaxSize=${maxSize}`);
  }

  /**
   * Get cached content if it exists and is still valid
   */
  async get<T>(key: string, filePath: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const entry = this.cache.get(key);
      if (!entry) {
        this.missCount++;
        return null;
      }

      // Check if cache entry has expired by TTL
      const now = Date.now();
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        this.missCount++;
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
          this.missCount++;
          return null;
        }
      } catch {
        // If we can't stat the file, invalidate the cache entry
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        this.missCount++;
        return null;
      }

      // Update access statistics
      entry.accessCount++;
      this.hitCount++;
      
      // Update access order for LRU
      this.updateAccessOrder(key);

      // Track performance
      this.recordProcessingTime(Date.now() - startTime);

      return entry.data as T;
    } catch (error) {
      this.missCount++;
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set content in cache with file modification time
   */
  async set<T>(key: string, data: T, filePath: string): Promise<void> {
    try {
      const stats = await fsPromises.stat(filePath);
      const fileModTime = stats.mtime.getTime();

      // Calculate approximate size
      const size = this.calculateSize(data);

      // Check if we need to evict entries due to size limit
      if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
        const evicted = this.evictLRU();
        if (evicted) {
          this.evictionCount++;
          console.log(`Cache evicted LRU entry: ${evicted}`);
        }
      }

      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        fileModTime,
        accessCount: 1,
        size,
      });

      this.updateAccessOrder(key);
      
      // Log cache set for debugging in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`Cache set: ${key} (${size} bytes, ${this.cache.size}/${this.maxSize} entries)`);
      }
    } catch (error) {
      // If we can't stat the file, don't cache
      console.error(`Failed to cache content for ${key}:`, error);
    }
  }

  /**
   * Calculate approximate size of cached data
   */
  private calculateSize(data: unknown): number {
    try {
      const jsonString = JSON.stringify(data);
      return new Blob([jsonString]).size;
    } catch {
      // Fallback: rough estimate
      return 1024; // 1KB default
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): string | null {
    if (this.accessOrder.length === 0) return null;
    
    const lruKey = this.accessOrder[0];
    this.cache.delete(lruKey);
    this.removeFromAccessOrder(lruKey);
    return lruKey;
  }

  /**
   * Record processing time for performance monitoring
   */
  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);
    
    // Keep only recent measurements (last 100)
    if (this.processingTimes.length > 100) {
      this.processingTimes = this.processingTimes.slice(-100);
    }
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): boolean {
    const existed = this.cache.has(key);
    if (existed) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      console.log(`Cache invalidated: ${key}`);
    }
    return existed;
  }

  /**
   * Invalidate entries by pattern (supports wildcards)
   */
  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let invalidatedCount = 0;
    
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (regex.test(key)) {
        this.invalidate(key);
        invalidatedCount++;
      }
    }
    
    console.log(`Cache invalidated ${invalidatedCount} entries matching pattern: ${pattern}`);
    return invalidatedCount;
  }

  /**
   * Invalidate expired entries
   */
  invalidateExpired(): number {
    const now = Date.now();
    let expiredCount = 0;
    
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      console.log(`Cache cleaned up ${expiredCount} expired entries`);
    }
    
    return expiredCount;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const previousSize = this.cache.size;
    this.cache.clear();
    this.accessOrder = [];
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
    this.processingTimes = [];
    
    console.log(`Cache cleared: ${previousSize} entries removed`);
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;
    
    const avgProcessingTime = this.processingTimes.length > 0 
      ? this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length
      : 0;

    // Calculate total memory usage
    const memoryUsage = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      hitRate: Math.round(hitRate * 100) / 100,
      totalHits: this.hitCount,
      totalMisses: this.missCount,
      totalEvictions: this.evictionCount,
      averageProcessingTime: Math.round(avgProcessingTime * 100) / 100,
      keys: Array.from(this.cache.keys()),
      memoryUsage,
      missCount: this.missCount, // For backward compatibility
    };
  }

  /**
   * Get detailed cache entry information
   */
  getEntryInfo(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;
    const timeToExpiry = this.ttl - age;

    return {
      key,
      size: entry.size,
      accessCount: entry.accessCount,
      age,
      timeToExpiry,
      expired: timeToExpiry <= 0,
      fileModTime: new Date(entry.fileModTime).toISOString(),
      cachedAt: new Date(entry.timestamp).toISOString(),
    };
  }

  /**
   * Preload cache entries (useful for warming cache)
   */
  async warmCache(entries: Array<{ key: string; filePath: string; loader: () => Promise<any> }>): Promise<number> {
    let warmedCount = 0;
    
    for (const { key, filePath, loader } of entries) {
      try {
        if (!this.cache.has(key)) {
          const data = await loader();
          await this.set(key, data, filePath);
          warmedCount++;
        }
      } catch (error) {
        console.error(`Failed to warm cache for ${key}:`, error);
      }
    }
    
    console.log(`Cache warmed: ${warmedCount} entries preloaded`);
    return warmedCount;
  }

  /**
   * Get cache performance report
   */
  getPerformanceReport(): string {
    const stats = this.getStats();
    const memoryMB = (stats.memoryUsage / 1024 / 1024).toFixed(2);
    
    return `
Content Cache Performance Report
================================
Cache Size: ${stats.size}/${stats.maxSize} entries (${memoryMB} MB)
Hit Rate: ${stats.hitRate}% (${stats.totalHits} hits, ${stats.missCount} misses)
Evictions: ${stats.totalEvictions}
Average Processing Time: ${stats.averageProcessingTime}ms
TTL: ${stats.ttl / 1000}s

Most Recently Used Keys:
${this.accessOrder.slice(-5).reverse().join('\n')}
    `.trim();
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

// Create a singleton instance for the content loader with environment-specific configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Configure cache based on environment
const cacheConfig = {
  // Development: 5 minutes TTL for fast iteration
  // Production: 30 minutes TTL for performance
  // Test: 1 second TTL for test isolation
  ttl: isTest ? 1000 : isDevelopment ? 5 * 60 * 1000 : 30 * 60 * 1000,
  
  // Development: Smaller cache for memory efficiency during development
  // Production: Larger cache for better hit rates
  // Test: Very small cache to avoid test pollution
  maxSize: isTest ? 10 : isDevelopment ? 50 : 200,
};

export const contentCache = new ContentCache(cacheConfig.ttl, cacheConfig.maxSize);

// Expose cache management utilities for debugging and monitoring
export const cacheUtils = {
  /**
   * Get cache performance report (useful for debugging)
   */
  getPerformanceReport: () => contentCache.getPerformanceReport(),
  
  /**
   * Get cache statistics
   */
  getStats: () => contentCache.getStats(),
  
  /**
   * Clear cache (useful for development)
   */
  clearCache: () => contentCache.clear(),
  
  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern: (pattern: string) => contentCache.invalidatePattern(pattern),
  
  /**
   * Clean up expired entries
   */
  cleanupExpired: () => contentCache.invalidateExpired(),
  
  /**
   * Get information about a specific cache entry
   */
  getEntryInfo: (key: string) => contentCache.getEntryInfo(key),
};

// Set up automatic cache cleanup in development
if (isDevelopment) {
  // Clean up expired entries every 10 minutes in development
  setInterval(() => {
    const cleanedCount = contentCache.invalidateExpired();
    if (cleanedCount > 0) {
      console.log(`[ContentCache] Automatic cleanup removed ${cleanedCount} expired entries`);
    }
  }, 10 * 60 * 1000);
  
  // Log cache performance every 5 minutes in development (if there's activity)
  setInterval(() => {
    const stats = contentCache.getStats();
    if (stats.totalHits + stats.totalMisses > 0) {
      console.log('[ContentCache] Performance Summary:');
      console.log(`  Hit Rate: ${stats.hitRate}% (${stats.totalHits} hits, ${stats.totalMisses} misses)`);
      console.log(`  Entries: ${stats.size}/${stats.maxSize} (${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`  Avg Processing Time: ${stats.averageProcessingTime}ms`);
    }
  }, 5 * 60 * 1000);
}
