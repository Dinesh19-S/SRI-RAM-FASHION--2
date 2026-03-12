import express from 'express';
import Bill from '../models/Bill.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';

const router = express.Router();
const DEFAULT_RECENT_LIMIT = 6;
const DEFAULT_PRODUCT_LIMIT = 10;

const parseBoundedInt = (value, fallback, min, max) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
};

const getSalesMatch = (dateMatch) => ({
    ...dateMatch,
    $or: [{ billType: { $exists: false } }, { billType: { $ne: 'PURCHASE' } }]
});

const getPurchaseMatch = (dateMatch) => ({
    ...dateMatch,
    billType: 'PURCHASE'
});

const getStatsDateRanges = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);

    return { thisMonthStart, lastMonthStart, lastMonthEnd };
};

const fetchDashboardStats = async () => {
    const { thisMonthStart, lastMonthStart, lastMonthEnd } = getStatsDateRanges();

    const salesMatchThisMonth = getSalesMatch({ date: { $gte: thisMonthStart } });
    const purchaseMatchThisMonth = getPurchaseMatch({ date: { $gte: thisMonthStart } });
    const salesMatchLastMonth = getSalesMatch({ date: { $gte: lastMonthStart, $lte: lastMonthEnd } });
    const purchaseMatchLastMonth = getPurchaseMatch({ date: { $gte: lastMonthStart, $lte: lastMonthEnd } });

    const [thisMonthSales, thisMonthPurchases, lastMonthSales, lastMonthPurchases, totalCustomers] = await Promise.all([
        Bill.aggregate([
            { $match: salesMatchThisMonth },
            { $group: { _id: null, revenue: { $sum: '$grandTotal' }, orders: { $sum: 1 } } }
        ]),
        Bill.aggregate([
            { $match: purchaseMatchThisMonth },
            { $group: { _id: null, expense: { $sum: '$grandTotal' } } }
        ]),
        Bill.aggregate([
            { $match: salesMatchLastMonth },
            { $group: { _id: null, revenue: { $sum: '$grandTotal' }, orders: { $sum: 1 } } }
        ]),
        Bill.aggregate([
            { $match: purchaseMatchLastMonth },
            { $group: { _id: null, expense: { $sum: '$grandTotal' } } }
        ]),
        Customer.countDocuments({ isActive: true }).catch(async () => {
            const customers = await Bill.distinct('customer.phone');
            return customers.filter(Boolean).length;
        })
    ]);

    const thisMonthData = thisMonthSales[0] || { revenue: 0, orders: 0 };
    const thisMonthExpense = thisMonthPurchases[0]?.expense || 0;
    const lastMonthData = lastMonthSales[0] || { revenue: 0, orders: 0 };
    const lastMonthExpense = lastMonthPurchases[0]?.expense || 0;

    const thisMonthNet = thisMonthData.revenue - thisMonthExpense;
    const lastMonthNet = lastMonthData.revenue - lastMonthExpense;

    const revenueGrowth = lastMonthNet > 0
        ? Number.parseFloat(((thisMonthNet - lastMonthNet) / lastMonthNet * 100).toFixed(1))
        : 0;
    const ordersGrowth = lastMonthData.orders > 0
        ? Number.parseFloat(((thisMonthData.orders - lastMonthData.orders) / lastMonthData.orders * 100).toFixed(1))
        : 0;

    return {
        totalRevenue: thisMonthNet,
        totalOrders: thisMonthData.orders,
        avgOrderValue: thisMonthData.orders > 0 ? thisMonthData.revenue / thisMonthData.orders : 0,
        salesRevenue: thisMonthData.revenue,
        purchaseExpense: thisMonthExpense,
        totalCustomers,
        revenueGrowth,
        ordersGrowth
    };
};

const fetchRecentBills = async (limit) => Bill.find({
    $or: [{ billType: { $exists: false } }, { billType: { $ne: 'PURCHASE' } }]
})
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('billNumber customer.name grandTotal date paymentStatus')
    .lean();

const fetchLowStockAlerts = async (limit = 5) => Product.find({
    isActive: true,
    $expr: { $lte: ['$stock', '$lowStockThreshold'] }
})
    .select('name stock lowStockThreshold')
    .limit(limit)
    .lean();

const fetchCategoryStats = async () => Product.aggregate([
    { $match: { isActive: true } },
    {
        $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalStock: { $sum: '$stock' }
        }
    },
    {
        $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryInfo'
        }
    },
    { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
    {
        $project: {
            _id: 1,
            name: { $ifNull: ['$categoryInfo.name', 'Uncategorized'] },
            count: 1,
            totalStock: 1
        }
    },
    { $sort: { totalStock: -1 } }
]);

const fetchTopProducts = async (limit) => Product.find({ isActive: true })
    .select('name stock lowStockThreshold')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

const fetchProductCount = async () => Product.countDocuments({ isActive: true });

// Dashboard overview for fast first paint
router.get('/overview', async (req, res) => {
    try {
        const recentLimit = parseBoundedInt(req.query.recentLimit, DEFAULT_RECENT_LIMIT, 1, 20);
        const productLimit = parseBoundedInt(req.query.productLimit, DEFAULT_PRODUCT_LIMIT, 1, 20);

        const [stats, recentBills, lowStockAlerts, categoryStats, products, productCount] = await Promise.all([
            fetchDashboardStats(),
            fetchRecentBills(recentLimit),
            fetchLowStockAlerts(),
            fetchCategoryStats(),
            fetchTopProducts(productLimit),
            fetchProductCount()
        ]);

        res.json({
            success: true,
            data: {
                stats,
                recentBills,
                lowStockAlerts,
                categoryStats,
                products,
                productCount
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Dashboard notifications payload for header popover
router.get('/notifications', async (req, res) => {
    try {
        const limit = parseBoundedInt(req.query.limit, 5, 1, 20);
        const [recentBills, lowStockAlerts] = await Promise.all([
            fetchRecentBills(limit),
            fetchLowStockAlerts(limit)
        ]);

        res.json({
            success: true,
            data: {
                recentBills,
                lowStockAlerts
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const stats = await fetchDashboardStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Recent bills
router.get('/recent-bills', async (req, res) => {
    try {
        const parsedLimit = parseBoundedInt(req.query.limit, 5, 1, 20);
        const bills = await fetchRecentBills(parsedLimit);

        res.json({ success: true, data: bills });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Revenue chart data
router.get('/revenue-chart', async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        let startDate = null;

        switch (period) {
            case 'week':
                startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'year':
                startDate = new Date(new Date().getFullYear(), 0, 1);
                break;
            case 'all':
                // No date filter - fetch all historical data
                startDate = null;
                break;
            case 'month':
            default:
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        }

        // Build match query
        const matchStage = startDate ? { $match: { date: { $gte: startDate } } } : { $match: {} };

        const data = await Bill.aggregate([
            matchStage,
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                    revenue: {
                        $sum: {
                            $cond: [
                                { $eq: ['$billType', 'PURCHASE'] },
                                { $multiply: ['$grandTotal', -1] },
                                '$grandTotal'
                            ]
                        }
                    },
                    sales: {
                        $sum: {
                            $cond: [
                                { $eq: ['$billType', 'PURCHASE'] },
                                0,
                                '$grandTotal'
                            ]
                        }
                    },
                    purchase: {
                        $sum: {
                            $cond: [
                                { $eq: ['$billType', 'PURCHASE'] },
                                '$grandTotal',
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]).allowDiskUse(true);

        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Low stock alerts
router.get('/low-stock-alerts', async (req, res) => {
    try {
        const products = await fetchLowStockAlerts(5);

        res.json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Category stats for dashboard
router.get('/category-stats', async (req, res) => {
    try {
        const stats = await fetchCategoryStats();

        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
