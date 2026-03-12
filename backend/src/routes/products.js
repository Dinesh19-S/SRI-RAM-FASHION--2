import express from 'express';
import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';

const router = express.Router();

// Get all products
router.get('/', async (req, res) => {
    try {
        const { category, search, page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

        const query = { isActive: true };
        if (category) query.category = category;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { sku: { $regex: search, $options: 'i' } }
            ];
        }

        const products = await Product.find(query)
            .populate('category', 'name')
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .sort({ createdAt: -1 })
            .lean();

        const total = await Product.countDocuments(query);

        res.json({
            success: true,
            data: products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get low stock products
router.get('/low-stock', async (req, res) => {
    try {
        const products = await Product.find({
            isActive: true,
            $expr: { $lte: ['$stock', '$lowStockThreshold'] }
        })
            .populate('category', 'name')
            .lean();

        res.json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get single product
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('category', 'name');
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create product
router.post('/', async (req, res) => {
    try {
        const product = new Product(req.body);
        await product.save();
        res.status(201).json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update product
router.put('/:id', async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete product (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.json({ success: true, message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update stock
router.post('/:id/stock', async (req, res) => {
    try {
        const { quantity, type, reason } = req.body;
        const product = await Product.findById(req.params.id);

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

        // Record stock movement
        const movement = new StockMovement({
            product: product._id,
            type,
            quantity,
            previousStock,
            newStock,
            reason
        });
        await movement.save();

        // Check for low stock and notify if necessary
        const { checkAndNotifyLowStock } = await import('../services/emailService.js');
        checkAndNotifyLowStock(product).catch(err => console.error('Low stock alert error:', err));

        res.json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
