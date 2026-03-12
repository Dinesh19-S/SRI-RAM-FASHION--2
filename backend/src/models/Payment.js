import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['sales', 'purchase'],
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer'
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier'
    },
    companyName: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    paymentType: {
        type: String,
        enum: ['cash', 'bank', 'upi', 'cheque', 'rtgs', 'neft'],
        default: 'cash'
    },
    bank: {
        type: String,
        trim: true
    },
    amount: {
        type: Number,
        required: true
    },
    detail: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

export default mongoose.model('Payment', paymentSchema);
