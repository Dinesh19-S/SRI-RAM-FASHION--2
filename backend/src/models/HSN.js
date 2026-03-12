import mongoose from 'mongoose';

const hsnSchema = new mongoose.Schema({
    hsnCode: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    gstRate: {
        type: Number,
        required: true,
        default: 5
    },
    description: {
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

export default mongoose.model('HSN', hsnSchema);
