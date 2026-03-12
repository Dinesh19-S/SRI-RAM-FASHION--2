import { getModel, systemPrompts } from '../config/aiConfig.js';
import Product from '../models/Product.js';
import Bill from '../models/Bill.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import SalesEntry from '../models/SalesEntry.js';
import PurchaseEntry from '../models/PurchaseEntry.js';
import { sendBillNotification, sendLowStockAlert, sendNotification } from './emailService.js';

// Available actions the AI can perform
const AVAILABLE_ACTIONS = {
    // Read actions
    GET_LOW_STOCK: 'get_low_stock',
    GET_TODAY_SALES: 'get_today_sales',
    GET_PRODUCT_INFO: 'get_product_info',
    GET_CUSTOMER_INFO: 'get_customer_info',
    SEARCH_PRODUCTS: 'search_products',
    GET_RECENT_BILLS: 'get_recent_bills',

    // Write actions
    CREATE_PRODUCT: 'create_product',
    UPDATE_STOCK: 'update_stock',
    CREATE_CUSTOMER: 'create_customer',
    SEND_LOW_STOCK_ALERT: 'send_low_stock_alert',
    SEND_NOTIFICATION: 'send_notification',

    // Navigation helpers
    NAVIGATE: 'navigate',
    HELP: 'help',
};

// Action handlers
const actionHandlers = {
    async get_low_stock() {
        const products = await Product.find({
            $expr: { $lte: ['$stock', '$lowStockThreshold'] }
        }).limit(10).lean();
        return {
            success: true,
            data: products.map(p => ({
                name: p.name,
                stock: p.stock,
                threshold: p.lowStockThreshold,
                sku: p.sku
            })),
            message: products.length > 0
                ? `Found ${products.length} low stock items`
                : 'No low stock items found!'
        };
    },

    async get_today_sales() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const sales = await Bill.aggregate([
            { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$grandTotal' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = sales[0] || { total: 0, count: 0 };
        return {
            success: true,
            data: result,
            message: `Today's sales: ₹${result.total.toLocaleString('en-IN')} from ${result.count} orders`
        };
    },

    async search_products({ query }) {
        const products = await Product.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { sku: { $regex: query, $options: 'i' } }
            ]
        }).limit(10).lean();

        return {
            success: true,
            data: products.map(p => ({
                name: p.name,
                sku: p.sku,
                stock: p.stock,
                price: p.sellingPrice
            })),
            message: `Found ${products.length} products matching "${query}"`
        };
    },

    async get_product_info({ productName }) {
        const product = await Product.findOne({
            $or: [
                { name: { $regex: productName, $options: 'i' } },
                { sku: { $regex: productName, $options: 'i' } }
            ]
        }).lean();

        if (!product) {
            return { success: false, message: `Product "${productName}" not found` };
        }

        return {
            success: true,
            data: product,
            message: `${product.name}: Stock ${product.stock}, Price ₹${product.sellingPrice}`
        };
    },

    async get_customer_info({ customerName }) {
        const customer = await Customer.findOne({
            companyName: { $regex: customerName, $options: 'i' }
        }).lean();

        if (!customer) {
            return { success: false, message: `Customer "${customerName}" not found` };
        }

        return {
            success: true,
            data: customer,
            message: `${customer.companyName}: ${customer.mobile}`
        };
    },

    async get_recent_bills({ limit = 5 }) {
        const bills = await Bill.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return {
            success: true,
            data: bills.map(b => ({
                billNumber: b.billNumber,
                customer: b.customer?.name || b.customer?.companyName,
                total: b.grandTotal,
                date: b.createdAt
            })),
            message: `Last ${bills.length} bills retrieved`
        };
    },

    async create_product({ name, sku, price, stock, category }) {
        try {
            const product = new Product({
                name,
                sku: sku || `SKU-${Date.now()}`,
                sellingPrice: price,
                mrp: price,
                stock: stock || 0,
                category: category || 'General',
                lowStockThreshold: 5,
                gstRate: 12
            });
            await product.save();
            return {
                success: true,
                data: product,
                message: `✅ Product "${name}" created successfully with SKU ${product.sku}`
            };
        } catch (error) {
            return { success: false, message: `Failed to create product: ${error.message}` };
        }
    },

    async update_stock({ productName, quantity, action = 'add' }) {
        const product = await Product.findOne({
            $or: [
                { name: { $regex: productName, $options: 'i' } },
                { sku: { $regex: productName, $options: 'i' } }
            ]
        });

        if (!product) {
            return { success: false, message: `Product "${productName}" not found` };
        }

        const oldStock = product.stock;
        if (action === 'add') {
            product.stock += quantity;
        } else if (action === 'subtract' || action === 'remove') {
            product.stock = Math.max(0, product.stock - quantity);
        } else if (action === 'set') {
            product.stock = quantity;
        }

        await product.save();
        return {
            success: true,
            message: `✅ Updated ${product.name} stock: ${oldStock} → ${product.stock}`
        };
    },

    async create_customer({ name, mobile, email, address, gstin }) {
        try {
            const customer = new Customer({
                companyName: name,
                mobile,
                email: email || '',
                address: address || '',
                gstin: gstin || '',
                state: 'Tamil Nadu',
                stateCode: '33'
            });
            await customer.save();
            return {
                success: true,
                data: customer,
                message: `✅ Customer "${name}" created successfully`
            };
        } catch (error) {
            return { success: false, message: `Failed to create customer: ${error.message}` };
        }
    },

    async send_low_stock_alert() {
        const products = await Product.find({
            $expr: { $lte: ['$stock', '$lowStockThreshold'] }
        }).lean();

        if (products.length === 0) {
            return { success: true, message: 'No low stock items to alert about!' };
        }

        if (process.env.ADMIN_EMAIL) {
            await sendLowStockAlert(products, process.env.ADMIN_EMAIL.split(','));
            return {
                success: true,
                message: `✅ Low stock alert sent for ${products.length} items to admin`
            };
        }

        return { success: false, message: 'Admin email not configured' };
    },

    async send_notification({ to, subject, message }) {
        if (!to) {
            to = process.env.ADMIN_EMAIL;
        }
        if (!to) {
            return { success: false, message: 'No recipient email provided' };
        }

        await sendNotification(to, subject || 'Notification', message);
        return {
            success: true,
            message: `✅ Notification sent to ${to}`
        };
    },

    navigate({ page }) {
        const pages = {
            dashboard: '/dashboard',
            billing: '/dashboard/billing',
            inventory: '/dashboard/inventory',
            products: '/dashboard/master/items',
            customers: '/dashboard/master/customers',
            suppliers: '/dashboard/master/suppliers',
            sales: '/dashboard/sales/entry',
            purchase: '/dashboard/purchase/entry',
            reports: '/dashboard/reports/sales',
            settings: '/dashboard/settings'
        };

        const path = pages[page.toLowerCase()] || pages.dashboard;
        return {
            success: true,
            action: 'navigate',
            path,
            message: `Navigate to ${page}: ${path}`
        };
    },

    help() {
        return {
            success: true,
            message: `I can help you with:

📦 **Inventory**
- "Show low stock items"
- "Search for [product name]"
- "Add 10 units to [product] stock"
- "Create product [name] with price [amount]"

💰 **Sales**
- "Show today's sales"
- "Show recent bills"

👥 **Customers**
- "Find customer [name]"
- "Create customer [name] with mobile [number]"

📧 **Notifications**
- "Send low stock alert"
- "Send email to [address]"

🧭 **Navigation**
- "Go to billing page"
- "Open inventory"
- "Navigate to settings"

Just ask naturally and I'll help!`
        };
    }
};

// Parse user intent and extract action
const parseIntent = async (message) => {
    const model = getModel();

    const prompt = `You are an intent parser for a business management app. Analyze the user message and return a JSON response with the action to perform.

Available actions:
- get_low_stock: Show products with low stock
- get_today_sales: Get today's sales summary
- search_products: Search for products (needs: query)
- get_product_info: Get specific product details (needs: productName)
- get_customer_info: Get customer details (needs: customerName)
- get_recent_bills: Get recent bills (optional: limit)
- create_product: Create a new product (needs: name, price; optional: sku, stock, category)
- update_stock: Update product stock (needs: productName, quantity; optional: action=add/subtract/set)
- create_customer: Create customer (needs: name, mobile; optional: email, address)
- send_low_stock_alert: Email low stock alert to admin
- send_notification: Send email (needs: message; optional: to, subject)
- navigate: Navigate to a page (needs: page)
- help: Show help
- chat: Just chat/conversation (no specific action)

User message: "${message}"

Respond with ONLY valid JSON in this format:
{"action": "action_name", "params": {"key": "value"}, "isAction": true/false}

For example:
- "show low stock" -> {"action": "get_low_stock", "params": {}, "isAction": true}
- "add 10 to cotton shirts" -> {"action": "update_stock", "params": {"productName": "cotton shirts", "quantity": 10, "action": "add"}, "isAction": true}
- "hello how are you" -> {"action": "chat", "params": {}, "isAction": false}`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (error) {
        console.error('Intent parsing error:', error);
    }

    return { action: 'chat', params: {}, isAction: false };
};

// Main AI chat handler with actions
export const processAICommand = async (message, userId) => {
    try {
        // Parse intent
        const intent = await parseIntent(message);
        console.log('Parsed intent:', intent);

        // If it's an action, execute it
        if (intent.isAction && intent.action !== 'chat') {
            const handler = actionHandlers[intent.action];
            if (handler) {
                const result = await handler(intent.params || {});
                return {
                    success: true,
                    isAction: true,
                    actionResult: result,
                    message: result.message,
                    data: result.data,
                    navigateTo: result.action === 'navigate' ? result.path : null
                };
            }
        }

        // Otherwise, chat naturally
        const model = getModel();

        // Get context for chat
        const [lowStock, todaySales] = await Promise.all([
            Product.countDocuments({ $expr: { $lte: ['$stock', '$lowStockThreshold'] } }),
            Bill.aggregate([
                { $match: { createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } } },
                { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
            ])
        ]);

        const context = {
            lowStockCount: lowStock,
            todaySales: todaySales[0] || { total: 0, count: 0 }
        };

        const chatPrompt = `${systemPrompts.chatAssistant}

Current context:
- Low stock items: ${context.lowStockCount}
- Today's sales: ₹${context.todaySales.total} (${context.todaySales.count} orders)

User: ${message}

Respond helpfully and concisely. If the user wants to perform an action, guide them on how to phrase it clearly.`;

        const result = await model.generateContent(chatPrompt);
        const response = await result.response;

        return {
            success: true,
            isAction: false,
            message: response.text()
        };
    } catch (error) {
        console.error('AI Command Error:', error);
        return {
            success: false,
            message: `I encountered an error: ${error.message}. Please try rephrasing your request.`
        };
    }
};

export default {
    processAICommand,
    actionHandlers,
    parseIntent
};
