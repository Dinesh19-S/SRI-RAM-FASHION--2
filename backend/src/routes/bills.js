import express from 'express';
import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';
import { sendBillNotification } from '../services/emailService.js';

const router = express.Router();

// Generate bill number
const generateBillNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `SRF${year}${month}${random}`;
};

// Number to words for Indian currency
const numberToWords = (num) => {
    return `Rupees ${Math.floor(num)} Only`;
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const createHttpError = (statusCode, message) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const normalizeBillType = (bill) => {
    if (!bill || bill.billType !== 'DIRECT') {
        return bill;
    }
    return { ...bill, billType: 'SALES' };
};

// Get all bills
router.get('/', async (req, res) => {
    try {
        const { status, startDate, endDate, search, billType, page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

        const query = {};
        if (status) query.paymentStatus = status;
        if (billType === 'SALES') {
            query.billType = { $in: ['SALES', 'DIRECT'] };
        } else if (billType) {
            query.billType = billType;
        }
        if (startDate && endDate) {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        if (search) {
            query.$or = [
                { billNumber: { $regex: search, $options: 'i' } },
                { referenceInvoiceNumber: { $regex: search, $options: 'i' } },
                { 'customer.name': { $regex: search, $options: 'i' } },
                { 'customer.phone': { $regex: search, $options: 'i' } },
                { partyName: { $regex: search, $options: 'i' } }
            ];
        }

        const bills = await Bill.find(query)
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .sort({ createdAt: -1 })
            .lean();

        const total = await Bill.countDocuments(query);

        res.json({
            success: true,
            data: bills.map(normalizeBillType),
            pagination: { page: pageNum, limit: limitNum, total }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get bill stats
router.get('/stats', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const dateQuery = startDate && endDate
            ? { date: { $gte: new Date(startDate), $lte: new Date(endDate) } }
            : {};

        const stats = await Bill.aggregate([
            { $match: dateQuery },
            {
                $group: {
                    _id: null,
                    totalBills: { $sum: 1 },
                    totalRevenue: { $sum: '$grandTotal' },
                    avgOrderValue: { $avg: '$grandTotal' },
                    paidCount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } }
                }
            }
        ]);

        res.json({ success: true, data: stats[0] || {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get single bill
router.get('/:id', async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id)
            .populate('items.product', 'name sku price mrp stock')
            .populate('createdBy', 'name email');
        if (!bill) {
            return res.status(404).json({ success: false, message: 'Bill not found' });
        }

        const billData = bill.toObject();
        res.json({ success: true, data: normalizeBillType(billData) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create bill (transactional stock + movement updates)
router.post('/', async (req, res) => {
    const session = await mongoose.startSession();
    let createdBill = null;

    try {
        const {
            customer,
            items = [],
            discount = 0,
            paymentMethod,
            notes,
            transport,
            fromDate,
            toDate,
            totalPacks,
            numOfBundles
        } = req.body;

        if (!customer?.name || !Array.isArray(items) || items.length === 0) {
            throw createHttpError(400, 'Customer details and at least one item are required');
        }

        await session.withTransaction(async () => {
            const billNumber = generateBillNumber();
            const billId = new mongoose.Types.ObjectId();
            const stockMovements = [];

            let subtotal = 0;
            let totalTax = 0;
            const processedItems = [];

            for (const item of items) {
                const quantity = toNumber(item.quantity, toNumber(item.noOfPacks, 0));
                const price = toNumber(item.price, 0);
                const discountRate = toNumber(item.discount, 0);

                if (!item.productId) {
                    throw createHttpError(400, 'Each item must include productId');
                }
                if (quantity <= 0) {
                    throw createHttpError(400, 'Item quantity must be greater than zero');
                }
                if (price < 0) {
                    throw createHttpError(400, 'Item price cannot be negative');
                }

                const product = await Product.findOne({ _id: item.productId, isActive: true }).session(session);
                if (!product) {
                    throw createHttpError(404, `Product not found: ${item.productId}`);
                }

                if (product.stock < quantity) {
                    throw createHttpError(400, `Insufficient stock for ${product.name}`);
                }

                const itemSubtotal = price * quantity;
                const itemDiscount = (itemSubtotal * discountRate) / 100;
                const taxableAmount = itemSubtotal - itemDiscount;
                const gstRate = toNumber(product.gstRate, 0);
                const gstAmount = (taxableAmount * gstRate) / 100;

                processedItems.push({
                    product: product._id,
                    productName: product.name,
                    sku: product.sku,
                    hsn: product.hsn,
                    hsnCode: item.hsnCode || product.hsn,
                    sizesOrPieces: item.sizesOrPieces || '',
                    quantity,
                    mrp: product.mrp,
                    price,
                    ratePerPiece: toNumber(item.ratePerPiece, price),
                    pcsInPack: toNumber(item.pcsInPack, 1),
                    ratePerPack: toNumber(item.ratePerPack, price),
                    noOfPacks: toNumber(item.noOfPacks, quantity),
                    discount: discountRate,
                    gstRate,
                    gstAmount,
                    total: taxableAmount + gstAmount
                });

                subtotal += itemSubtotal;
                totalTax += gstAmount;

                const previousStock = product.stock;
                product.stock = previousStock - quantity;
                await product.save({ session });

                stockMovements.push({
                    product: product._id,
                    type: 'out',
                    quantity,
                    previousStock,
                    newStock: product.stock,
                    reason: `Sold - Bill #${billNumber}`,
                    reference: `bill:${billId.toString()}`,
                    createdBy: req.user?.id
                });
            }

            if (processedItems.length === 0) {
                throw createHttpError(400, 'No valid bill items to process');
            }

            const discountAmount = (subtotal * toNumber(discount, 0)) / 100;
            const taxableAmount = subtotal - discountAmount;
            const cgst = totalTax / 2;
            const sgst = totalTax / 2;
            const grandTotal = taxableAmount + totalTax;

            createdBill = new Bill({
                _id: billId,
                billNumber,
                billType: 'SALES',
                partyName: customer?.name || '',
                customer,
                transport,
                fromText: fromDate || '',
                toText: toDate || '',
                totalPacks: toNumber(totalPacks, 0),
                numOfBundles: toNumber(numOfBundles, 1),
                items: processedItems,
                subtotal,
                discountAmount,
                taxableAmount,
                cgst,
                sgst,
                totalTax,
                grandTotal,
                amountInWords: numberToWords(grandTotal),
                paymentMethod,
                paymentStatus: paymentMethod === 'credit' ? 'pending' : 'paid',
                notes
            });

            await createdBill.save({ session });
            await StockMovement.insertMany(stockMovements, { session });
        });

        // Send email notification only after successful commit
        if (process.env.ADMIN_EMAIL && createdBill) {
            const emailList = process.env.ADMIN_EMAIL.split(',').map((e) => e.trim());
            sendBillNotification(createdBill, emailList).catch((err) => {
                console.error('Failed to send bill notification:', err);
            });
        }

        res.status(201).json({ success: true, data: normalizeBillType(createdBill.toObject()) });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
});

// Update bill status/details
router.put('/:id', async (req, res) => {
    try {
        const updatePayload = { ...req.body };
        if (updatePayload.billType === 'DIRECT') {
            updatePayload.billType = 'SALES';
        }

        const bill = await Bill.findByIdAndUpdate(
            req.params.id,
            updatePayload,
            { new: true }
        );
        const billData = bill ? normalizeBillType(bill.toObject()) : bill;
        res.json({ success: true, data: billData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete bill and restore stock transactionally for linked products
router.delete('/:id', async (req, res) => {
    const session = await mongoose.startSession();
    let deletedBillNumber = null;

    try {
        await session.withTransaction(async () => {
            const bill = await Bill.findById(req.params.id).session(session);
            if (!bill) {
                throw createHttpError(404, 'Bill not found');
            }

            deletedBillNumber = bill.billNumber;
            const reference = `bill:${bill._id.toString()}`;

            for (const item of bill.items) {
                if (!item.product) {
                    continue;
                }

                const quantity = toNumber(item.quantity, 0);
                if (quantity <= 0) {
                    continue;
                }

                const product = await Product.findById(item.product).session(session);
                if (!product) {
                    continue;
                }

                const previousStock = product.stock;
                product.stock = previousStock + quantity;
                await product.save({ session });

                await new StockMovement({
                    product: product._id,
                    type: 'in',
                    quantity,
                    previousStock,
                    newStock: product.stock,
                    reason: `Rollback - Deleted Bill #${bill.billNumber}`,
                    reference,
                    createdBy: req.user?.id
                }).save({ session });
            }

            await Bill.deleteOne({ _id: bill._id }, { session });
        });

        res.json({
            success: true,
            message: 'Bill deleted and linked stock restored',
            data: { billNumber: deletedBillNumber }
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
});

export default router;
