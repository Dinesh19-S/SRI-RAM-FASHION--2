export const API_BASES = {
    legacy: '/api',
    versioned: '/api/v1'
};

export const API_RESOURCES = {
    auth: '/auth',
    products: '/products',
    categories: '/categories',
    bills: '/bills',
    inventory: '/inventory',
    reports: '/reports',
    settings: '/settings',
    dashboard: '/dashboard',
    customers: '/customers',
    hsn: '/hsn',
    suppliers: '/suppliers',
    payments: '/payments',
    salesEntries: '/sales-entries',
    purchaseEntries: '/purchase-entries',
    ai: '/ai',
    email: '/email'
};

export const API_CONTRACT = {
    version: 'v1',
    bases: API_BASES,
    resources: API_RESOURCES,
    endpoints: {
        health: '/health',
        endpoints: '/endpoints',
        auth: {
            login: '/auth/login',
            register: '/auth/register',
            profile: '/auth/profile',
            sendOtp: '/auth/send-otp',
            loginPhone: '/auth/login-phone',
            google: '/auth/google',
            forgotPassword: '/auth/forgot-password',
            resetPassword: '/auth/reset-password'
        },
        products: {
            list: '/products',
            byId: '/products/:id',
            stock: '/products/:id/stock',
            lowStock: '/products/low-stock'
        },
        dashboard: {
            overview: '/dashboard/overview',
            notifications: '/dashboard/notifications',
            stats: '/dashboard/stats',
            recentBills: '/dashboard/recent-bills',
            revenueChart: '/dashboard/revenue-chart',
            lowStockAlerts: '/dashboard/low-stock-alerts',
            categoryStats: '/dashboard/category-stats'
        },
        email: {
            status: '/email/status',
            test: '/email/test',
            dailySummary: '/email/daily-summary',
            sendReport: '/email/send-report',
            sendBill: '/email/send-bill/:billId'
        },
        reports: {
            salesSummary: '/reports/sales-summary',
            salesTrend: '/reports/sales-trend',
            topProducts: '/reports/top-products',
            categoryPerformance: '/reports/category-performance',
            paymentMethods: '/reports/payment-methods',
            stock: '/reports/stock',
            salesReport: '/reports/sales-report',
            purchaseReport: '/reports/purchase-report',
            stockReport: '/reports/stock-report',
            auditorSales: '/reports/auditor-sales',
            auditorPurchase: '/reports/auditor-purchase'
        }
    }
};

export default API_CONTRACT;
