import express from 'express';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true });

        // Add product count
        const categoriesWithCount = await Promise.all(
            categories.map(async (cat) => {
                const count = await Product.countDocuments({ category: cat._id, isActive: true });
                return { ...cat.toObject(), productCount: count };
            })
        );

        res.json({ success: true, data: categoriesWithCount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create category
router.post('/', async (req, res) => {
    try {
        const category = new Category(req.body);
        await category.save();
        res.status(201).json({ success: true, data: category });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update category
router.put('/:id', async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json({ success: true, data: category });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete category
router.delete('/:id', async (req, res) => {
    try {
        await Category.findByIdAndUpdate(req.params.id, { isActive: false });
        res.json({ success: true, message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
