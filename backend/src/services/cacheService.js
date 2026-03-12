/**
 * Simple in-memory cache service for frequently accessed data
 * Reduces database load for Settings and business context queries
 */

const cache = new Map();

// Cache expiration times (in milliseconds)
const CACHE_TIMES = {
    SETTINGS: 60 * 60 * 1000,     // 1 hour for Settings (rarely changes)
    CONTEXT: 5 * 60 * 1000,       // 5 minutes for business context
    PRODUCTS: 10 * 60 * 1000,     // 10 minutes for products list
    CUSTOMERS: 15 * 60 * 1000,    // 15 minutes for customer/supplier counts
};

/**
 * Get cached data or execute fetcher function
 * @param key Cache key
 * @param fetcher Async function to fetch data if cache miss
 * @param ttl Time to live in milliseconds
 * @returns Cached or fresh data
 */
export const getOrSet = async (key, fetcher, ttl = CACHE_TIMES.CONTEXT) => {
    const now = Date.now();
    const cachedData = cache.get(key);

    // Return cached data if still valid
    if (cachedData && cachedData.expiresAt > now) {
        return cachedData.value;
    }

    // Fetch fresh data
    const data = await fetcher();

    // Cache the data
    cache.set(key, {
        value: data,
        expiresAt: now + ttl
    });

    return data;
};

/**
 * Manually invalidate cache for a key
 */
export const invalidate = (key) => {
    cache.delete(key);
};

/**
 * Clear all cache
 */
export const clearAll = () => {
    cache.clear();
};

/**
 * Get cache stats (for debugging)
 */
export const getStats = () => {
    return {
        size: cache.size,
        keys: Array.from(cache.keys()),
    };
};

export const CACHE_KEYS = {
    SETTINGS: 'settings_main',
    BUSINESS_CONTEXT: 'business_context',
    LOW_STOCK_PRODUCTS: 'low_stock_products',
    TOP_PRODUCTS: 'top_products_30days',
};

export const CACHE_TTL = CACHE_TIMES;

export default {
    getOrSet,
    invalidate,
    clearAll,
    getStats,
    CACHE_KEYS,
    CACHE_TTL
};
