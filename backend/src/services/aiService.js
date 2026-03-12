import { getModel, systemPrompts } from '../config/aiConfig.js';
import Product from '../models/Product.js';
import Bill from '../models/Bill.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import SalesEntry from '../models/SalesEntry.js';
import PurchaseEntry from '../models/PurchaseEntry.js';
import cacheService from './cacheService.js';

// Rate limiting store
const requestCounts = new Map();
const MAX_REQUESTS = 15;
const WINDOW_MS = 60000;

// Check rate limit
const checkRateLimit = (userId) => {
    const now = Date.now();
    const userRequests = requestCounts.get(userId) || { count: 0, windowStart: now };

    if (now - userRequests.windowStart > WINDOW_MS) {
        // Reset window
        userRequests.count = 1;
        userRequests.windowStart = now;
    } else {
        userRequests.count++;
    }

    requestCounts.set(userId, userRequests);

    if (userRequests.count > MAX_REQUESTS) {
        return false;
    }
    return true;
};

// Get context data for AI queries (cached for 5 minutes to reduce DB load)
const getBusinessContext = async () => {
    return cacheService.getOrSet(
        cacheService.CACHE_KEYS.BUSINESS_CONTEXT,
        async () => {
            try {
                const [products, lowStockProducts, recentBills, customerCount, supplierCount] = await Promise.all([
                    Product.countDocuments(),
                    Product.find({ $expr: { $lte: ['$stock', '$lowStockThreshold'] } }).limit(10).lean().select('name stock lowStockThreshold'),
                    Bill.find().sort({ createdAt: -1 }).limit(5).lean().select('billNumber customer.name grandTotal createdAt'),
                    Customer.countDocuments(),
                    Supplier.countDocuments(),
                ]);

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todaySales = await Bill.aggregate([
                    { $match: { createdAt: { $gte: today } } },
                    { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
                ]);

                return {
                    totalProducts: products,
                    lowStockItems: lowStockProducts.map(p => ({ name: p.name, stock: p.stock, threshold: p.lowStockThreshold })),
                    recentBills: recentBills.map(b => ({ billNumber: b.billNumber, grandTotal: b.grandTotal, date: b.createdAt })),
                    customerCount,
                    supplierCount,
                    todaySales: todaySales[0] || { total: 0, count: 0 },
                };
            } catch (error) {
                console.error('Error fetching business context:', error);
                return null;
            }
        },
        cacheService.CACHE_TTL.CONTEXT
    );
};

// Chat with AI assistant
export const chatWithAssistant = async (userId, message) => {
    if (!checkRateLimit(userId)) {
        return {
            success: false,
            message: 'Rate limit exceeded. Please wait a moment before sending more messages.',
        };
    }

    try {
        const model = getModel();
        const context = await getBusinessContext();

        const prompt = `${systemPrompts.chatAssistant}

Current Business Data:
${JSON.stringify(context, null, 2)}

User Query: ${message}

Please provide a helpful response based on the above context and query.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return {
            success: true,
            message: text,
        };
    } catch (error) {
        console.error('AI Chat Error:', error);
        return {
            success: false,
            message: 'Sorry, I encountered an error processing your request. Please try again.',
        };
    }
};

// Generate dashboard insights
export const generateInsights = async () => {
    try {
        const model = getModel();

        // Get comprehensive business data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [salesData, purchaseData, lowStock, topProducts] = await Promise.all([
            Bill.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
            ]),
            PurchaseEntry.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
            ]),
            Product.find({ $expr: { $lte: ['$stock', '$lowStockThreshold'] } }).countDocuments(),
            Bill.aggregate([
                { $unwind: '$items' },
                { $group: { _id: '$items.product', totalSold: { $sum: '$items.quantity' } } },
                { $sort: { totalSold: -1 } },
                { $limit: 5 }
            ])
        ]);

        const businessData = {
            last30DaysSales: salesData[0] || { total: 0, count: 0 },
            last30DaysPurchases: purchaseData[0] || { total: 0, count: 0 },
            lowStockCount: lowStock,
            topSellingProducts: topProducts.length,
        };

        const prompt = `${systemPrompts.analyticsInsights}

Business Data (Last 30 Days):
${JSON.stringify(businessData, null, 2)}

Generate 3-4 brief, actionable business insights based on this data.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return {
            success: true,
            insights: text,
            data: businessData,
        };
    } catch (error) {
        console.error('AI Insights Error:', error);
        return {
            success: false,
            insights: 'Unable to generate insights at the moment.',
            data: null,
        };
    }
};

// Get inventory predictions
export const getInventoryPredictions = async () => {
    try {
        const model = getModel();

        // Get inventory and sales data
        const [products, recentSales] = await Promise.all([
            Product.find().lean(),
            Bill.aggregate([
                { $unwind: '$items' },
                {
                    $group: {
                        _id: '$items.product',
                        totalSold: { $sum: '$items.quantity' },
                        avgQuantity: { $avg: '$items.quantity' }
                    }
                },
                { $sort: { totalSold: -1 } }
            ])
        ]);

        const inventoryData = {
            products: products.map(p => ({
                name: p.name,
                stock: p.stock,
                threshold: p.lowStockThreshold,
                sellingPrice: p.sellingPrice
            })),
            salesTrends: recentSales.slice(0, 10)
        };

        const prompt = `${systemPrompts.inventoryPredictions}

Inventory Data:
${JSON.stringify(inventoryData, null, 2)}

Provide inventory predictions and recommendations.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return {
            success: true,
            predictions: text,
        };
    } catch (error) {
        console.error('AI Inventory Predictions Error:', error);
        return {
            success: false,
            predictions: 'Unable to generate predictions at the moment.',
        };
    }
};

// Smart search functionality
export const smartSearch = async (query) => {
    try {
        const model = getModel();

        // Get sample data for search context
        const [products, customers, suppliers] = await Promise.all([
            Product.find().select('name sku category stock sellingPrice').limit(50).lean(),
            Customer.find().select('companyName mobile').limit(30).lean(),
            Supplier.find().select('companyName mobile').limit(30).lean(),
        ]);

        const searchContext = {
            products: products.map(p => ({ name: p.name, sku: p.sku, stock: p.stock, price: p.sellingPrice })),
            customers: customers.map(c => ({ name: c.companyName, mobile: c.mobile })),
            suppliers: suppliers.map(s => ({ name: s.companyName, mobile: s.mobile })),
        };

        const prompt = `You are a search assistant for Sri Ram Fashions. 
Given the user's search query, find and return the most relevant items from the available data.
Return results as a JSON array with format: [{ "type": "product|customer|supplier", "name": "...", "details": "..." }]

Available Data:
${JSON.stringify(searchContext, null, 2)}

User Search Query: "${query}"

Return only the JSON array, no other text.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Try to parse as JSON
        try {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const results = JSON.parse(jsonMatch[0]);
                return { success: true, results };
            }
        } catch (e) {
            // Fall back to text response
        }

        return {
            success: true,
            results: [],
            rawResponse: text,
        };
    } catch (error) {
        console.error('AI Search Error:', error);
        return {
            success: false,
            results: [],
        };
    }
};

export default {
    chatWithAssistant,
    generateInsights,
    getInventoryPredictions,
    smartSearch,
};
