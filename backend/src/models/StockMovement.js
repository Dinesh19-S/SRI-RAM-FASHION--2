import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    type: {
        type: String,
        enum: ['in', 'out'],
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    previousStock: {
        type: Number,
        required: true
    },
    newStock: {
        type: Number,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    reference: String,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

export default mongoose.model('StockMovement', stockMovementSchema);
