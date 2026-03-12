/**
 * HTTP caching middleware for GET endpoints
 * Reduces bandwidth and client-side revalidation
 */

export const cacheMiddleware = (maxAge = 300) => {
    return (req, res, next) => {
        // Only cache GET requests
        if (req.method === 'GET') {
            // Cache for specified duration (default 5 minutes)
            res.set('Cache-Control', `public, max-age=${maxAge}`);
        } else {
            // Never cache mutating requests
            res.set('Cache-Control', 'no-store');
        }
        next();
    };
};

/**
 * Specific cache policies for different route types
 */
export const cachePolicies = {
    // Settings and configuration data (1 hour - rarely changes)
    SETTINGS: 3600,
    // Dashboard stats and reports (10 minutes)
    REPORTS: 600,
    // Product lists and categories (15 minutes)
    PRODUCTS: 900,
    // Static data that changes infrequently (30 minutes)
    STATIC: 1800,
    // Frequently changing data (2 minutes)
    DYNAMIC: 120,
    // No cache for mutating operations
    NO_CACHE: 'no-store'
};

export default cacheMiddleware;
