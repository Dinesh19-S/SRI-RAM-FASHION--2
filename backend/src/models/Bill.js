import mongoose from 'mongoose';

const billItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    },
    productName: String,
    sku: String,
    hsn: String,
    hsnCode: String,
    sizesOrPieces: String,
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    ratePerPiece: Number,
    pcsInPack: {
        type: Number,
        default: 1
    },
    ratePerPack: Number,
    noOfPacks: {
        type: Number,
        default: 1
    },
    mrp: Number,
    price: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    gstRate: {
        type: Number,
        default: 5
    },
    gstAmount: Number,
    total: Number
});

const billSchema = new mongoose.Schema({
    billNumber: {
        type: String,
        required: true,
        unique: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    customer: {
        name: { type: String, required: true },
        phone: { type: String, default: '' },
        email: String,
        address: String,
        gstin: String,
        state: { type: String, default: 'Tamilnadu' },
        stateCode: { type: String, default: '33' }
    },
    transport: String,
    fromText: String,
    toText: String,
    totalPacks: {
        type: Number,
        default: 0
    },
    numOfBundles: {
        type: Number,
        default: 1
    },
    items: [billItemSchema],
    subtotal: {
        type: Number,
        required: true
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    taxableAmount: Number,
    roundOff: {
        type: Number,
        default: 0
    },
    cgst: {
        type: Number,
        default: 0
    },
    sgst: {
        type: Number,
        default: 0
    },
    igst: {
        type: Number,
        default: 0
    },
    totalTax: Number,
    grandTotal: {
        type: Number,
        required: true
    },
    amountInWords: String,
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'upi', 'credit'],
        default: 'cash'
    },
    paymentStatus: {
        type: String,
        enum: ['paid', 'pending', 'partial', 'cancel'],
        default: 'pending'
    },
    notes: String,
    billType: {
        type: String,
        enum: ['SALES', 'PURCHASE', 'DIRECT'],
        default: 'SALES',
        set: (value) => (value === 'DIRECT' ? 'SALES' : value)
    },
    referenceInvoiceNumber: String,
    sourcePurchaseEntry: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseEntry'
    },
    partyName: String,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Helpful indexes for dashboards and filters
billSchema.index({ date: -1 });
billSchema.index({ billType: 1, date: -1 });
billSchema.index({ paymentStatus: 1, date: -1 });
billSchema.index({ customer: 1 });

billSchema.index({ createdBy: 1 });
billSchema.index({ 'customer.phone': 1 });

// Pre-save hook to calculate totals
billSchema.pre('save', function (next) {
    // Calculate item totals
    this.items.forEach(item => {
        const itemSubtotal = item.price * item.quantity;
        const itemDiscount = (itemSubtotal * item.discount) / 100;
        const taxableAmount = itemSubtotal - itemDiscount;
        item.gstAmount = (taxableAmount * item.gstRate) / 100;
        item.total = taxableAmount + item.gstAmount;
    });

    // Calculate bill totals
    this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    this.taxableAmount = this.subtotal - this.discountAmount;
    this.totalTax = this.cgst + this.sgst + this.igst;
    this.grandTotal = this.taxableAmount + this.totalTax;

    next();
});

export default mongoose.model('Bill', billSchema);
