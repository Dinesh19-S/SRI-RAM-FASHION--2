import express from 'express';
import StockMovement from '../models/StockMovement.js';
import Product from '../models/Product.js';

const router = express.Router();

// Get stock movements
router.get('/movements', async (req, res) => {
    try {
        const { productId, type, startDate, endDate, page = 1, limit = 20 } = req.query;

        const query = {};
        if (productId) query.product = productId;
        if (type) query.type = type;
        if (startDate && endDate) {
            query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const movements = await StockMovement.find(query)
            .populate('product', 'name sku')
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await StockMovement.countDocuments(query);

        res.json({
            success: true,
            data: movements,
            pagination: { page: parseInt(page), limit: parseInt(limit), total }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Add stock movement
router.post('/movements', async (req, res) => {
    try {
        const { productId, type, quantity, reason, reference } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const previousStock = product.stock;
        const newStock = type === 'in' ? previousStock + quantity : previousStock - quantity;

        if (newStock < 0) {
            return res.status(400).json({ success: false, message: 'Insufficient stock' });
        }

        product.stock = newStock;
        await product.save();

        const movement = new StockMovement({
            product: productId,
            type,
            quantity,
            previousStock,
            newStock,
            reason,
            reference
        });
        await movement.save();

        // Check for low stock and notify if necessary
        const { checkAndNotifyLowStock } = await import('../services/emailService.js');
        checkAndNotifyLowStock(product).catch(err => console.error('Low stock alert error:', err));

        res.status(201).json({ success: true, data: movement });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get inventory stats
router.get('/stats', async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments({ isActive: true });
        const totalStock = await Product.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: null, total: { $sum: '$stock' } } }
        ]);
        const lowStockCount = await Product.countDocuments({
            isActive: true,
            $expr: { $lte: ['$stock', '$lowStockThreshold'] }
        });
        const inventoryValue = await Product.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: null, total: { $sum: { $multiply: ['$stock', '$sellingPrice'] } } } }
        ]);

        res.json({
            success: true,
            data: {
                totalProducts,
                totalStock: totalStock[0]?.total || 0,
                lowStockCount,
                inventoryValue: inventoryValue[0]?.total || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
