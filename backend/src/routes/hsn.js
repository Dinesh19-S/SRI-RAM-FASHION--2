import express from 'express';
import HSN from '../models/HSN.js';

const router = express.Router();

// Get all HSN codes with pagination
router.get('/', async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;

        const query = { isActive: true };
        if (search) {
            query.hsnCode = { $regex: search, $options: 'i' };
        }

        const hsns = await HSN.find(query)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await HSN.countDocuments(query);

        res.json({
            success: true,
            data: hsns,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get single HSN
router.get('/:id', async (req, res) => {
    try {
        const hsn = await HSN.findById(req.params.id);
        if (!hsn) {
            return res.status(404).json({ success: false, message: 'HSN not found' });
        }
        res.json({ success: true, data: hsn });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create HSN
router.post('/', async (req, res) => {
    try {
        const hsn = new HSN(req.body);
        await hsn.save();
        res.status(201).json({ success: true, data: hsn });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update HSN
router.put('/:id', async (req, res) => {
    try {
        const hsn = await HSN.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!hsn) {
            return res.status(404).json({ success: false, message: 'HSN not found' });
        }
        res.json({ success: true, data: hsn });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete HSN (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const hsn = await HSN.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );
        if (!hsn) {
            return res.status(404).json({ success: false, message: 'HSN not found' });
        }
        res.json({ success: true, message: 'HSN deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
