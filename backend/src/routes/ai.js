import express from 'express';
import { chatWithAssistant, generateInsights, getInventoryPredictions, smartSearch } from '../services/aiService.js';
import { processAICommand } from '../services/aiActionService.js';

const router = express.Router();

// Chat with AI assistant - now with action support
router.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user?.id || 'anonymous';

        if (!message || message.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Message is required',
            });
        }

        // Use the new action-capable AI service
        const response = await processAICommand(message, userId);
        res.json(response);
    } catch (error) {
        console.error('Chat endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
});

// Get AI-generated insights
router.get('/insights', async (req, res) => {
    try {
        const response = await generateInsights();
        res.json(response);
    } catch (error) {
        console.error('Insights endpoint error:', error);
        res.status(500).json({
            success: false,
            insights: 'Unable to generate insights',
        });
    }
});

// Get inventory predictions
router.get('/inventory-predictions', async (req, res) => {
    try {
        const response = await getInventoryPredictions();
        res.json(response);
    } catch (error) {
        console.error('Inventory predictions endpoint error:', error);
        res.status(500).json({
            success: false,
            predictions: 'Unable to generate predictions',
        });
    }
});

// Smart search
router.post('/search', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query || query.trim() === '') {
            return res.status(400).json({
                success: false,
                results: [],
                message: 'Search query is required',
            });
        }

        const response = await smartSearch(query);
        res.json(response);
    } catch (error) {
        console.error('Search endpoint error:', error);
        res.status(500).json({
            success: false,
            results: [],
        });
    }
});

// Execute specific action directly
router.post('/action', async (req, res) => {
    try {
        const { action, params } = req.body;

        if (!action) {
            return res.status(400).json({
                success: false,
                message: 'Action is required',
            });
        }

        // Import action handlers
        const { actionHandlers } = await import('../services/aiActionService.js');

        if (!actionHandlers[action]) {
            return res.status(400).json({
                success: false,
                message: `Unknown action: ${action}`,
            });
        }

        const result = await actionHandlers[action](params || {});
        res.json(result);
    } catch (error) {
        console.error('Action endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to execute action',
        });
    }
});

// Health check for AI service
router.get('/health', (req, res) => {
    const hasApiKey = !!process.env.GEMINI_API_KEY;
    res.json({
        success: true,
        status: hasApiKey ? 'ready' : 'api_key_missing',
        message: hasApiKey ? 'AI service is ready' : 'GEMINI_API_KEY is not configured',
        capabilities: [
            'chat',
            'insights',
            'inventory-predictions',
            'search',
            'actions'
        ]
    });
});

export default router;
