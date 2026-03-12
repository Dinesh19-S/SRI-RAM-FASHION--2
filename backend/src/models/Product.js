import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    sku: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    description: String,
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    mrp: {
        type: Number,
        required: true,
        min: 0
    },
    sellingPrice: {
        type: Number,
        required: true,
        min: 0
    },
    stock: {
        type: Number,
        default: 0,
        min: 0
    },
    lowStockThreshold: {
        type: Number,
        default: 5
    },
    unit: {
        type: String,
        default: 'pcs'
    },
    size: {
        type: String,
        trim: true
    },
    hsn: String,
    gstRate: {
        type: Number,
        default: 12
    },
    image: String,
    isActive: {
        type: Boolean,
        default: true
    },
    lastLowStockAlertAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Virtual for checking low stock
productSchema.virtual('isLowStock').get(function () {
    return this.stock <= this.lowStockThreshold;
});

// Indexes for frequently filtered fields
productSchema.index({ stock: 1, lowStockThreshold: 1 });
productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });

export default mongoose.model('Product', productSchema);
