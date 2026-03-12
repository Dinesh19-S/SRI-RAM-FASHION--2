import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Get the generative model - try different model names
export const getModel = () => {
    // Use gemini-1.5-flash - the free tier model
    return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
};

// Check if API key is configured
export const isApiKeyConfigured = () => {
    return !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10;
};

// Rate limiting configuration (free tier: 15 requests/minute)
export const rateLimitConfig = {
    maxRequests: 15,
    windowMs: 60000, // 1 minute
};

// System prompts for different AI features
export const systemPrompts = {
    chatAssistant: `You are an AI assistant for Sri Ram Fashions, a textile retail business management system. 
You help users with:
- Inventory questions (stock levels, low stock items, product details)
- Sales and billing inquiries
- Customer and supplier information
- Navigation help within the application
- Business insights and recommendations

Be concise, helpful, and professional. If you don't have specific data, suggest where the user can find it in the app.
Always respond in a friendly, business-appropriate manner.`,

    analyticsInsights: `You are a business analytics AI for Sri Ram Fashions textile retail business.
Analyze the provided business data and generate insights in simple, actionable language.
Focus on:
- Sales trends and patterns
- Inventory health
- Customer behavior
- Revenue insights
- Recommendations for improvement

Keep insights brief (2-3 sentences each) and actionable.`,

    inventoryPredictions: `You are an inventory management AI for a textile retail business.
Based on the provided sales and stock data, predict:
- Products likely to run out soon
- Suggested reorder quantities
- Seasonal demand patterns
- Slow-moving inventory

Provide practical, actionable recommendations.`,
};

export default genAI;
