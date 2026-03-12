import express from 'express';
import cors from 'cors';
import compression from 'compression';
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Bill from './models/Bill.js';
import { API_BASES, API_CONTRACT } from './config/apiContract.js';
import { initScheduler } from './services/schedulerService.js';
import { authenticateToken } from './middleware/auth.js';
import { cacheMiddleware, cachePolicies } from './middleware/cache.js';

// Import Routes
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import categoryRoutes from './routes/categories.js';
import billRoutes from './routes/bills.js';
import inventoryRoutes from './routes/inventory.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import dashboardRoutes from './routes/dashboard.js';
import customerRoutes from './routes/customers.js';
import hsnRoutes from './routes/hsn.js';
import supplierRoutes from './routes/suppliers.js';
import paymentRoutes from './routes/payments.js';
import salesEntriesRoutes from './routes/salesEntries.js';
import purchaseEntriesRoutes from './routes/purchaseEntries.js';
import aiRoutes from './routes/ai.js';
import emailRoutes from './routes/email.js';

const app = express();
const REQUIRED_ENV_VARS = ['MONGODB_URI', 'JWT_SECRET'];

const missingEnvVars = REQUIRED_ENV_VARS.filter((name) => !process.env[name]?.trim());
if (missingEnvVars.length > 0) {
    console.error(
        `Missing required environment variables: ${missingEnvVars.join(', ')}`
    );
    process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;

// CORS Configuration - Allow frontend
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'https://dinesh19-s.github.io',
    process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests from Electron/file://, localhost dev, Capacitor, Vercel, and whitelisted web origins
        if (!origin || origin === 'file://' || origin?.startsWith('capacitor://') || origin?.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} [${req.method}] ${req.url}`);
    next();
});

const createDefaultAdmin = async () => {
    if (process.env.BOOTSTRAP_DEFAULT_ADMIN !== 'true') {
        return;
    }

    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL?.trim();
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    const adminName = process.env.DEFAULT_ADMIN_NAME?.trim() || 'Admin User';
    const adminPhone = process.env.DEFAULT_ADMIN_PHONE?.trim() || '';

    if (!adminEmail || !adminPassword) {
        console.warn(
            'BOOTSTRAP_DEFAULT_ADMIN is enabled but DEFAULT_ADMIN_EMAIL or DEFAULT_ADMIN_PASSWORD is missing. Skipping admin bootstrap.'
        );
        return;
    }

    try {
        const adminExists = await User.findOne({ email: adminEmail });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await User.create({
                name: adminName,
                email: adminEmail,
                password: hashedPassword,
                phone: adminPhone,
                role: 'admin',
                isActive: true
            });
            console.log(`Default admin user created: ${adminEmail}`);
        }
    } catch (error) {
        console.error('Error creating default admin:', error);
    }
};

const migrateDirectBillsToSales = async () => {
    try {
        const result = await Bill.updateMany(
            { billType: 'DIRECT' },
            { $set: { billType: 'SALES' } }
        );

        if (result.modifiedCount > 0) {
            console.log(`Migrated ${result.modifiedCount} DIRECT bill(s) to SALES`);
        }
    } catch (error) {
        console.error('Error migrating DIRECT bills to SALES:', error.message);
    }
};

const createApiRouter = () => {
    const router = express.Router();

    router.get('/health', (req, res) => {
        res.json({
            success: true,
            message: 'Sri Ram Fashions API is running',
            data: {
                version: API_CONTRACT.version,
                serverTime: new Date().toISOString()
            }
        });
    });

    router.get('/endpoints', (req, res) => {
        res.json({
            success: true,
            data: API_CONTRACT
        });
    });

    router.use('/auth', authRoutes);
    router.use('/products', authenticateToken, cacheMiddleware(cachePolicies.PRODUCTS), productRoutes);
    router.use('/categories', authenticateToken, cacheMiddleware(cachePolicies.PRODUCTS), categoryRoutes);
    router.use('/bills', authenticateToken, cacheMiddleware(cachePolicies.DYNAMIC), billRoutes);
    router.use('/inventory', authenticateToken, cacheMiddleware(cachePolicies.DYNAMIC), inventoryRoutes);
    router.use('/reports', authenticateToken, cacheMiddleware(cachePolicies.REPORTS), reportRoutes);
    router.use('/settings', authenticateToken, cacheMiddleware(cachePolicies.SETTINGS), settingsRoutes);
    router.use('/dashboard', authenticateToken, cacheMiddleware(cachePolicies.REPORTS), dashboardRoutes);
    router.use('/customers', authenticateToken, cacheMiddleware(cachePolicies.STATIC), customerRoutes);
    router.use('/hsn', authenticateToken, cacheMiddleware(cachePolicies.STATIC), hsnRoutes);
    router.use('/suppliers', authenticateToken, cacheMiddleware(cachePolicies.STATIC), supplierRoutes);
    router.use('/payments', authenticateToken, cacheMiddleware(cachePolicies.DYNAMIC), paymentRoutes);
    router.use('/sales-entries', authenticateToken, cacheMiddleware(cachePolicies.DYNAMIC), salesEntriesRoutes);
    router.use('/purchase-entries', authenticateToken, cacheMiddleware(cachePolicies.DYNAMIC), purchaseEntriesRoutes);
    router.use('/ai', authenticateToken, aiRoutes);
    router.use('/email', authenticateToken, emailRoutes);

    return router;
};

const apiRouter = createApiRouter();
app.use(API_BASES.legacy, apiRouter);
app.use(API_BASES.versioned, apiRouter);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

const startServer = async () => {
    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 30000,
            maxPoolSize: 10,
            minPoolSize: 2
        });

        console.log('Connected to MongoDB');
        console.log(`Database: ${mongoose.connection.name}`);
        await migrateDirectBillsToSales();
        await createDefaultAdmin();

        // On Vercel, we don't start the server manually; it's handled as a function
        if (process.env.VERCEL !== '1') {
            const PORT = process.env.PORT || 5000;
            const server = app.listen(PORT, () => {
                console.log(`Server running on port ${PORT}`);
                console.log(`API URL (legacy): http://localhost:${PORT}${API_BASES.legacy}`);
                console.log(`API URL (v1): http://localhost:${PORT}${API_BASES.versioned}`);
                initScheduler();
            });

            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.error(`ERROR: Port ${PORT} is already in use.`);
                    console.error(`Try running: netstat -aon | findstr :${PORT}`);
                    console.error(`Or kill the process: taskkill /F /PID <PID_FROM_ABOVE>`);
                    process.exit(1);
                } else {
                    console.error('Server error:', err);
                    process.exit(1);
                }
            });
        }
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        console.error('Please check:');
        console.error('   1. MongoDB Atlas cluster is running');
        console.error('   2. Network access allows your IP address');
        console.error('   3. Database username/password are correct');
        console.error('   4. Internet connection is stable');
        process.exit(1);
    }
};

// Export app but only run server if not on Vercel
// Vercel will handle the routing and initialization
if (process.env.VERCEL !== '1') {
    startServer();
} else {
    // For Vercel, we still need to connect to DB
    // We'll do a lazy connection or top-level await if supported
    // but better to wrap the handler. However, mongoose.connect 
    // at top level (outside startServer) is often used for Vercel.
    const connectToDb = async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(MONGODB_URI, {
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 30000,
            });
            console.log('Connected to MongoDB (Vercel Serverless)');
        }
    };
    
    // Middleware-like function to ensure DB connection
    app.use(async (req, res, next) => {
        await connectToDb();
        next();
    });
}

export default app;
