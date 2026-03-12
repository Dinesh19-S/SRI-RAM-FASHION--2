import express from 'express';
import Bill from '../models/Bill.js';
import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';
import PurchaseEntry from '../models/PurchaseEntry.js';

const router = express.Router();

// Sales summary
router.get('/sales-summary', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const dateQuery = { date: { $gte: new Date(startDate), $lte: new Date(endDate) } };

        const summary = await Bill.aggregate([
            { $match: dateQuery },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$grandTotal' },
                    totalOrders: { $sum: 1 },
                    avgOrderValue: { $avg: '$grandTotal' },
                    totalTax: { $sum: '$totalTax' }
                }
            }
        ]);

        res.json({ success: true, data: summary[0] || {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Sales trend
router.get('/sales-trend', async (req, res) => {
    try {
        const { period, startDate, endDate } = req.query;

        let groupBy;
        switch (period) {
            case 'daily':
                groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$date' } };
                break;
            case 'weekly':
                groupBy = { $week: '$date' };
                break;
            case 'monthly':
            default:
                groupBy = { $dateToString: { format: '%Y-%m', date: '$date' } };
        }

        const trend = await Bill.aggregate([
            { $match: { date: { $gte: new Date(startDate), $lte: new Date(endDate) } } },
            {
                $group: {
                    _id: groupBy,
                    revenue: { $sum: '$grandTotal' },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({ success: true, data: trend });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Top products
router.get('/top-products', async (req, res) => {
    try {
        const { startDate, endDate, limit = 10 } = req.query;

        const topProducts = await Bill.aggregate([
            { $match: { date: { $gte: new Date(startDate), $lte: new Date(endDate) } } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productName',
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: '$items.total' }
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: parseInt(limit) }
        ]);

        res.json({ success: true, data: topProducts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Category performance
router.get('/category-performance', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const performance = await Bill.aggregate([
            { $match: { date: { $gte: new Date(startDate), $lte: new Date(endDate) } } },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'product.category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: '$category' },
            {
                $group: {
                    _id: '$category.name',
                    revenue: { $sum: '$items.total' },
                    quantity: { $sum: '$items.quantity' }
                }
            },
            { $sort: { revenue: -1 } }
        ]);

        res.json({ success: true, data: performance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Payment method stats
router.get('/payment-methods', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const stats = await Bill.aggregate([
            { $match: { date: { $gte: new Date(startDate), $lte: new Date(endDate) } } },
            {
                $group: {
                    _id: '$paymentMethod',
                    count: { $sum: 1 },
                    total: { $sum: '$grandTotal' }
                }
            }
        ]);

        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Stock report
router.get('/stock', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const stockMovement = await StockMovement.aggregate([
            { $match: { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                    stockIn: { $sum: { $cond: [{ $eq: ['$type', 'in'] }, '$quantity', 0] } },
                    stockOut: { $sum: { $cond: [{ $eq: ['$type', 'out'] }, '$quantity', 0] } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({ success: true, data: stockMovement });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Sales report with detailed items
router.get('/sales-report', async (req, res) => {
    try {
        const { fromDate, toDate, customer } = req.query;

        const query = {};
        if (fromDate && toDate) {
            query.date = { $gte: new Date(fromDate), $lte: new Date(toDate) };
        }
        if (customer) {
            query['customer.name'] = { $regex: customer, $options: 'i' };
        }

        const bills = await Bill.find(query)
            .sort({ date: 1 })
            .lean();

        // Flatten items for report
        const reportData = [];
        let sno = 1;

        bills.forEach(bill => {
            bill.items.forEach(item => {
                reportData.push({
                    sno: sno++,
                    date: bill.date.toISOString().split('T')[0],
                    invNo: bill.billNumber,
                    item: item.productName,
                    rate: item.price,
                    qty: item.quantity,
                    total: item.total
                });
            });
        });

        res.json({ success: true, data: reportData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Purchase report (linked to PurchaseEntry)
router.get('/purchase-report', async (req, res) => {
    try {
        const { fromDate, toDate, supplier } = req.query;

        const query = {};
        if (fromDate && toDate) {
            query.date = { $gte: new Date(fromDate), $lte: new Date(toDate) };
        }
        if (supplier) {
            query['supplier.name'] = { $regex: supplier, $options: 'i' };
        }

        const entries = await PurchaseEntry.find(query)
            .sort({ date: 1 })
            .lean();

        // Flatten items for report
        const reportData = [];
        let sno = 1;

        entries.forEach(entry => {
            entry.items.forEach(item => {
                reportData.push({
                    sno: sno++,
                    date: entry.date.toISOString().split('T')[0],
                    invNo: entry.invoiceNumber,
                    item: item.particular,
                    rate: item.rate,
                    qty: item.quantity,
                    total: item.total || (item.rate * item.quantity)
                });
            });
        });

        res.json({ success: true, data: reportData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Stock report with current levels
router.get('/stock-report', async (req, res) => {
    try {
        const { name, size } = req.query;

        const query = { isActive: true };
        if (name) {
            query.name = { $regex: name, $options: 'i' };
        }

        const products = await Product.find(query)
            .populate('category', 'name')
            .sort({ name: 1 })
            .lean();

        const reportData = products.map((product, index) => ({
            sno: index + 1,
            item: product.name,
            size: product.size || 'N/A',
            qty: product.stock,
            rate: product.sellingPrice,
            total: product.stock * product.sellingPrice
        }));

        res.json({ success: true, data: reportData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Auditor Sales Report (GST breakdown)
router.get('/auditor-sales', async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;

        const query = {};
        if (fromDate && toDate) {
            query.date = { $gte: new Date(fromDate), $lte: new Date(toDate) };
        }

        const bills = await Bill.find(query).sort({ date: 1 }).lean();

        const reportData = bills.map(bill => ({
            companyName: bill.customer.name,
            gstin: bill.customer.gstin || 'N/A',
            date: bill.date.toISOString().split('T')[0],
            invNo: bill.billNumber,
            taxableAmount: bill.taxableAmount,
            cgst: bill.cgst,
            sgst: bill.sgst,
            igst: bill.igst || 0,
            total: bill.grandTotal
        }));

        res.json({ success: true, data: reportData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Auditor Purchase Report (GST breakdown)
router.get('/auditor-purchase', async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;

        const query = {};
        if (fromDate && toDate) {
            query.date = { $gte: new Date(fromDate), $lte: new Date(toDate) };
        }

        const entries = await PurchaseEntry.find(query).sort({ date: 1 }).lean();

        const reportData = entries.map(entry => ({
            companyName: entry.supplier.name,
            gstin: entry.supplier.gstin || 'N/A',
            date: entry.date.toISOString().split('T')[0],
            invNo: entry.invoiceNumber,
            taxableAmount: entry.subtotal,
            cgst: entry.totalCgst,
            sgst: entry.totalSgst,
            igst: entry.totalIgst || 0,
            total: entry.grandTotal
        }));

        res.json({ success: true, data: reportData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
