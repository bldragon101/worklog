/**
 * Folder ID caching system for Google Drive upload optimization
 * Caches week ending and customer folder IDs to reduce API calls
 */

interface FolderCacheEntry {
  folderId: string;
  createdAt: number;
  lastAccessed: number;
}

interface CustomerFolderCache {
  [customerKey: string]: FolderCacheEntry;
}

interface WeekFolderCache {
  [weekEndingKey: string]: {
    weekFolderId: string;
    customerFolders: CustomerFolderCache;
    createdAt: number;
    lastAccessed: number;
  };
}

class FolderCacheManager {
  private cache: WeekFolderCache = {};
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
  private readonly CUSTOMER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes for customer folders
  private readonly MAX_CACHE_SIZE = 100; // Maximum number of week entries to cache

  /**
   * Get cached week folder ID
   */
  getWeekFolderId(weekEndingStr: string, baseFolderId: string): string | null {
    const cacheKey = `${baseFolderId}:${weekEndingStr}`;
    const entry = this.cache[cacheKey];
    
    if (!entry) {
      return null;
    }

    // Check if cache entry is expired
    if (Date.now() - entry.createdAt > this.CACHE_TTL) {
      delete this.cache[cacheKey];
      return null;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();
    return entry.weekFolderId;
  }

  /**
   * Cache week folder ID
   */
  setWeekFolderId(weekEndingStr: string, baseFolderId: string, weekFolderId: string): void {
    const cacheKey = `${baseFolderId}:${weekEndingStr}`;
    
    // Clean up old entries if cache is getting too large
    this.cleanupCache();
    
    this.cache[cacheKey] = {
      weekFolderId,
      customerFolders: {},
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };
  }

  /**
   * Get cached customer folder ID
   */
  getCustomerFolderId(
    weekEndingStr: string, 
    baseFolderId: string, 
    customerKey: string
  ): string | null {
    const weekCacheKey = `${baseFolderId}:${weekEndingStr}`;
    const weekEntry = this.cache[weekCacheKey];
    
    if (!weekEntry) {
      return null;
    }

    const customerEntry = weekEntry.customerFolders[customerKey];
    if (!customerEntry) {
      return null;
    }

    // Check if customer folder cache entry is expired
    if (Date.now() - customerEntry.createdAt > this.CUSTOMER_CACHE_TTL) {
      delete weekEntry.customerFolders[customerKey];
      return null;
    }

    // Update last accessed time
    customerEntry.lastAccessed = Date.now();
    weekEntry.lastAccessed = Date.now();
    
    return customerEntry.folderId;
  }

  /**
   * Cache customer folder ID
   */
  setCustomerFolderId(
    weekEndingStr: string,
    baseFolderId: string,
    customerKey: string,
    customerFolderId: string
  ): void {
    const weekCacheKey = `${baseFolderId}:${weekEndingStr}`;
    let weekEntry = this.cache[weekCacheKey];
    
    // If week entry doesn't exist, create it (this shouldn't normally happen)
    if (!weekEntry) {
      weekEntry = {
        weekFolderId: '', // Will be set when week folder is cached
        customerFolders: {},
        createdAt: Date.now(),
        lastAccessed: Date.now(),
      };
      this.cache[weekCacheKey] = weekEntry;
    }

    weekEntry.customerFolders[customerKey] = {
      folderId: customerFolderId,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };

    weekEntry.lastAccessed = Date.now();
  }

  /**
   * Invalidate cache entries for a specific week
   */
  invalidateWeekCache(weekEndingStr: string, baseFolderId: string): void {
    const cacheKey = `${baseFolderId}:${weekEndingStr}`;
    delete this.cache[cacheKey];
  }

  /**
   * Invalidate cache entries for a specific customer within a week
   */
  invalidateCustomerCache(
    weekEndingStr: string,
    baseFolderId: string,
    customerKey: string
  ): void {
    const weekCacheKey = `${baseFolderId}:${weekEndingStr}`;
    const weekEntry = this.cache[weekCacheKey];
    
    if (weekEntry && weekEntry.customerFolders[customerKey]) {
      delete weekEntry.customerFolders[customerKey];
    }
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache = {};
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): {
    totalWeekEntries: number;
    totalCustomerEntries: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const weekEntries = Object.values(this.cache);
    const totalWeekEntries = weekEntries.length;
    
    let totalCustomerEntries = 0;
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;

    weekEntries.forEach(entry => {
      totalCustomerEntries += Object.keys(entry.customerFolders).length;
      
      if (oldestEntry === null || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      
      if (newestEntry === null || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }
    });

    return {
      totalWeekEntries,
      totalCustomerEntries,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Clean up expired and least recently used cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const entries = Object.entries(this.cache);

    // Remove expired entries first
    entries.forEach(([key, entry]) => {
      if (now - entry.createdAt > this.CACHE_TTL) {
        delete this.cache[key];
      }
    });

    // If still over limit, remove least recently used entries
    const remainingEntries = Object.entries(this.cache);
    if (remainingEntries.length > this.MAX_CACHE_SIZE) {
      // Sort by last accessed time (oldest first)
      remainingEntries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
      
      // Remove oldest entries until we're under the limit
      const entriesToRemove = remainingEntries.length - this.MAX_CACHE_SIZE;
      for (let i = 0; i < entriesToRemove; i++) {
        delete this.cache[remainingEntries[i][0]];
      }
    }

    // Clean up expired customer folder entries within remaining week entries
    Object.values(this.cache).forEach(weekEntry => {
      Object.entries(weekEntry.customerFolders).forEach(([customerKey, customerEntry]) => {
        if (now - customerEntry.createdAt > this.CUSTOMER_CACHE_TTL) {
          delete weekEntry.customerFolders[customerKey];
        }
      });
    });
  }

  /**
   * Create a customer key from customer and billTo names
   */
  static createCustomerKey(customer: string, billTo: string): string {
    // Use the same sanitization as the actual folder creation
    return `${customer}_${billTo}`;
  }
}

// Singleton instance for application-wide use
export const folderCache = new FolderCacheManager();

// Export the class for testing
export { FolderCacheManager };