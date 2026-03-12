import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
    companyName: {
        type: String,
        required: true,
        trim: true
    },
    mobile: {
        type: String,
        required: true,
        trim: true
    },
    alternateNo: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    gstin: {
        type: String,
        trim: true,
        uppercase: true
    },
    state: {
        type: String,
        default: 'Tamilnadu'
    },
    stateCode: {
        type: String,
        default: '33'
    },
    address: {
        type: String,
        trim: true
    },
    placeOfSupply: {
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

// Index for search
customerSchema.index({ companyName: 'text' });

export default mongoose.model('Customer', customerSchema);
