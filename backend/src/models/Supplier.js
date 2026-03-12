import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
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
    address: {
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

export default mongoose.model('Supplier', supplierSchema);
