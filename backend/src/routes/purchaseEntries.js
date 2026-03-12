import express from 'express';
import mongoose from 'mongoose';
import PurchaseEntry from '../models/PurchaseEntry.js';
import Bill from '../models/Bill.js';
import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';

const router = express.Router();

// Generate PURCHASE bill number (PUR-0001 format)
const generatePurchaseBillNumber = async (session = null) => {
    const query = Bill.countDocuments({ billType: 'PURCHASE' });
    if (session) query.session(session);
    const count = await query;
    return `PUR-${(count + 1).toString().padStart(4, '0')}`;
};

// Number to words for Indian currency
const numberToWords = (num) => {
    return `Rupees ${Math.floor(num)} Only`;
};

const createHttpError = (statusCode, message) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildPurchaseBillItems = (items = []) => {
    let subtotal = 0;
    let totalWeight = 0;

    const billItems = items.map((item) => {
        const weightKg = parseFloat(item.weightKg) || 0;
        const ratePerKg = parseFloat(item.ratePerKg) || 0;
        const amount = weightKg * ratePerKg;

        subtotal += amount;
        totalWeight += weightKg;

        return {
            productName: item.particular,
            sizesOrPieces: item.designColor || '',
            quantity: weightKg,
            price: ratePerKg,
            weightKg,
            ratePerKg,
            hsnCode: item.hsnCode || '',
            gstRate: 0,
            gstAmount: 0,
            discount: 0,
            total: amount
        };
    });

    return { billItems, subtotal, totalWeight };
};

const buildPurchaseBillPayload = ({ entry, items, subtotal, totalWeight }) => {
    const grandTotal = Math.round(subtotal);
    const roundOff = grandTotal - subtotal;

    return {
        billType: 'PURCHASE',
        referenceInvoiceNumber: entry.invoiceNumber,
        sourcePurchaseEntry: entry._id,
        partyName: entry.supplier.name,
        date: entry.date,
        customer: {
            name: entry.supplier.name,
            phone: entry.supplier.mobile || '',
            address: entry.supplier.address || '',
            gstin: entry.supplier.gstin || '',
            state: 'Tamilnadu',
            stateCode: '33'
        },
        items,
        subtotal,
        discountAmount: 0,
        taxableAmount: subtotal,
        cgst: 0,
        sgst: 0,
        totalTax: 0,
        grandTotal,
        roundOff,
        totalPacks: totalWeight,
        numOfBundles: 1,
        amountInWords: numberToWords(grandTotal),
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        notes: `Auto-generated from Purchase Entry #${entry.invoiceNumber}`
    };
};

// Get all purchase entries with filters and pagination
router.get('/', async (req, res) => {
    try {
        const { search, fromDate, toDate, page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

        const query = {};

        // Search by invoice number or supplier name
        if (search) {
            query.$or = [
                { invoiceNumber: { $regex: search, $options: 'i' } },
                { 'supplier.name': { $regex: search, $options: 'i' } }
            ];
        }

        // Date range filter
        if (fromDate || toDate) {
            query.date = {};
            if (fromDate) query.date.$gte = new Date(fromDate);
            if (toDate) query.date.$lte = new Date(toDate);
        }

        const entries = await PurchaseEntry.find(query)
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .sort({ date: -1, createdAt: -1 })
            .lean();

        const total = await PurchaseEntry.countDocuments(query);

        res.json({
            success: true,
            data: entries,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get single purchase entry by ID
router.get('/:id', async (req, res) => {
    try {
        const entry = await PurchaseEntry.findById(req.params.id);
        if (!entry) {
            return res.status(404).json({ success: false, message: 'Purchase entry not found' });
        }
        res.json({ success: true, data: entry });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create new purchase entry + auto-generate PURCHASE bill
router.post('/', async (req, res) => {
    const session = await mongoose.startSession();
    let entry = null;
    let bill = null;

    try {
        const { supplier, date, invoiceNumber, items, notes } = req.body;

        if (!invoiceNumber) {
            throw createHttpError(400, 'Invoice number is required for purchase entries');
        }

        if (!supplier?.name && typeof supplier !== 'string') {
            throw createHttpError(400, 'Supplier name is required');
        }

        if (!Array.isArray(items) || items.length === 0) {
            throw createHttpError(400, 'At least one item is required');
        }

        await session.withTransaction(async () => {
            // Calculate totals
            let subtotal = 0;

            const processedItems = items.map((item) => {
                const weightKg = parseFloat(item.weightKg) || 0;
                const ratePerKg = parseFloat(item.ratePerKg) || 0;
                const amount = weightKg * ratePerKg;
                subtotal += amount;

                return {
                    particular: item.particular,
                    hsnCode: item.hsnCode || '',
                    designColor: item.designColor || '',
                    weightKg,
                    ratePerKg,
                    amount,
                    total: amount
                };
            });

            const grandTotal = subtotal;

            entry = new PurchaseEntry({
                invoiceNumber,
                date: date || new Date(),
                supplier: {
                    name: supplier.name || supplier,
                    mobile: supplier.mobile || '',
                    gstin: supplier.gstin || '',
                    address: supplier.address || ''
                },
                items: processedItems,
                subtotal,
                grandTotal,
                notes
            });

            await entry.save({ session });

            const stockMovements = [];
            const billId = new mongoose.Types.ObjectId();

            const { billItems, subtotal: billSubtotal, totalWeight } = buildPurchaseBillItems(entry.items);

            // Increase stock for items that match products by name
            for (const item of entry.items) {
                const product = await Product.findOne({ name: { $regex: new RegExp(`^${item.particular}$`, 'i') } }).session(session);
                if (product) {
                    const previousStock = product.stock;
                    product.stock += (item.weightKg || 0);
                    await product.save({ session });

                    stockMovements.push({
                        product: product._id,
                        type: 'in',
                        quantity: item.weightKg || 0,
                        previousStock: previousStock,
                        newStock: product.stock,
                        reason: `Purchased - Purchase Entry #${entry.invoiceNumber}`,
                        reference: `bill:${billId.toString()}`,
                        createdBy: req.user?.id
                    });
                }
            }

            bill = new Bill({
                _id: billId,
                billNumber: await generatePurchaseBillNumber(session),
                ...buildPurchaseBillPayload({
                    entry,
                    items: billItems,
                    subtotal: billSubtotal,
                    totalWeight
                })
            });

            await bill.save({ session });

            if (stockMovements.length > 0) {
                await StockMovement.insertMany(stockMovements, { session });
            }
        });

        res.status(201).json({ success: true, data: entry, bill });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
});

// Update purchase entry
router.put('/:id', async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { supplier, date, invoiceNumber, items, notes, status } = req.body;
        const existingEntry = await PurchaseEntry.findById(req.params.id).lean();

        if (!existingEntry) {
            return res.status(404).json({ success: false, message: 'Purchase entry not found' });
        }

        // Recalculate totals if items are updated
        let updateData = { notes, status };

        if (date) updateData.date = date;
        if (invoiceNumber) updateData.invoiceNumber = invoiceNumber;
        if (supplier) {
            updateData.supplier = {
                name: supplier.name || supplier,
                mobile: supplier.mobile || '',
                gstin: supplier.gstin || '',
                address: supplier.address || ''
            };
        }

        if (items && items.length > 0) {
            let subtotal = 0;

            const processedItems = items.map(item => {
                const amount = (parseFloat(item.weightKg) || 0) * (parseFloat(item.ratePerKg) || 0);
                subtotal += amount;

                return {
                    particular: item.particular,
                    hsnCode: item.hsnCode || '',
                    designColor: item.designColor || '',
                    weightKg: parseFloat(item.weightKg) || 0,
                    ratePerKg: parseFloat(item.ratePerKg) || 0,
                    amount,
                    total: amount
                };
            });

            const grandTotal = subtotal;

            updateData = {
                ...updateData,
                items: processedItems,
                subtotal,
                grandTotal
            };
        }

        let entry = null;

        await session.withTransaction(async () => {
            entry = await PurchaseEntry.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true, session }
            );

            const { billItems, subtotal: billSubtotal, totalWeight } = buildPurchaseBillItems(entry.items);
            const billPayload = buildPurchaseBillPayload({
                entry,
                items: billItems,
                subtotal: billSubtotal,
                totalWeight
            });

            const existingBill = await Bill.findOne({
                billType: 'PURCHASE',
                $or: [
                    { sourcePurchaseEntry: entry._id },
                    { referenceInvoiceNumber: existingEntry.invoiceNumber },
                    { notes: { $regex: `Purchase Entry #${escapeRegExp(existingEntry.invoiceNumber)}`, $options: 'i' } }
                ]
            }).sort({ createdAt: -1 }).session(session);

            if (existingBill) {
                existingBill.set(billPayload);
                await existingBill.save({ session });
            } else {
                await new Bill({
                    billNumber: await generatePurchaseBillNumber(session),
                    ...billPayload
                }).save({ session });
            }
        });

        res.json({ success: true, data: entry });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
});

// Delete purchase entry
router.delete('/:id', async (req, res) => {
    try {
        const entry = await PurchaseEntry.findByIdAndDelete(req.params.id);
        if (!entry) {
            return res.status(404).json({ success: false, message: 'Purchase entry not found' });
        }
        res.json({ success: true, message: 'Purchase entry deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
