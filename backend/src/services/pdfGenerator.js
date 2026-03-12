import PDFDocument from 'pdfkit';
import Settings from '../models/Settings.js';
import cacheService from './cacheService.js';

// Convert number to words in Indian format
const numberToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num === 0) return 'Zero';
    if (num < 0) return 'Minus ' + numberToWords(-num);

    num = Math.floor(num);
    let words = '';

    if (Math.floor(num / 10000000) > 0) {
        words += numberToWords(Math.floor(num / 10000000)) + ' Crore ';
        num %= 10000000;
    }
    if (Math.floor(num / 100000) > 0) {
        words += numberToWords(Math.floor(num / 100000)) + ' Lakh ';
        num %= 100000;
    }
    if (Math.floor(num / 1000) > 0) {
        words += numberToWords(Math.floor(num / 1000)) + ' Thousand ';
        num %= 1000;
    }
    if (Math.floor(num / 100) > 0) {
        words += numberToWords(Math.floor(num / 100)) + ' Hundred ';
        num %= 100;
    }
    if (num > 0) {
        if (words !== '') words += 'and ';
        if (num < 20) words += ones[num];
        else {
            words += tens[Math.floor(num / 10)];
            if (num % 10 > 0) words += ' ' + ones[num % 10];
        }
    }
    return words.trim();
};

const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const toAmount = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Generate a bill PDF buffer using PDFKit.
 * Layout precisely matches BillTemplate.jsx + BillTemplate.css.
 * The items table dynamically fills remaining A4 space so the bill fits exactly one page.
 */
export const generateBillPDF = async (bill) => {
    // Load settings (cached for 1 hour to reduce DB load)
    let settings = await cacheService.getOrSet(
        cacheService.CACHE_KEYS.SETTINGS,
        async () => {
            const loaded = await Settings.findOne();
            return loaded || new Settings();
        },
        cacheService.CACHE_TTL.SETTINGS
    );

    // Company details
    const companyName = settings?.company?.name || 'SRI RAM FASHIONS';
    const companyGstin = settings?.company?.gstin || '33AZRPM4425F2ZA';
    const companyAddress1 = settings?.company?.address1 || '61C9, Anupparpalayam Puthur, Tirupur. 641652';
    const companyAddress2 = settings?.company?.address2 || '81 K, Madurai Raod, SankerNager, Tirunelveli Dt. 627357';
    const companyState = settings?.company?.state || 'Tamilnadu';
    const companyStateCode = settings?.company?.stateCode || '33';
    const companyEmail = settings?.company?.email || 'sriramfashionstrp@gmail.com';
    const companyPhone = settings?.company?.phone || '9080573831';
    const companyMob = settings?.company?.phone2 || '8248893759';

    // Bank details (from cached settings)
    const bankName = settings?.bank?.bankName || 'SOUTH INDIAN BANK';
    const bankAccount = settings?.bank?.accountNumber || '0338073000002328';
    const bankBranch = settings?.bank?.branchName || 'TIRUPUR';
    const bankIfsc = settings?.bank?.ifscCode || 'SIBL0000338';
    const bankAccName = settings?.bank?.accountHolderName || 'SRI RAM FASHIONS';

    // Tax calculations / bill data
    const fallbackCgstRate = settings?.tax?.cgstRate || 2.5;
    const fallbackSgstRate = settings?.tax?.sgstRate || 2.5;
    const isPurchase = bill.billType === 'PURCHASE';
    const items = bill.items || [];
    const productAmt = toAmount(bill.subtotal);
    const discount = toAmount(bill.discountAmount);
    const taxableAmt = toAmount(bill.taxableAmount, productAmt - discount);
    const cgstAmt = toAmount(
        bill.cgst,
        isPurchase ? 0 : (taxableAmt * fallbackCgstRate) / 100
    );
    const sgstAmt = toAmount(
        bill.sgst,
        isPurchase ? 0 : (taxableAmt * fallbackSgstRate) / 100
    );
    const igstAmt = toAmount(bill.igst);
    const totalGst = toAmount(bill.totalTax, cgstAmt + sgstAmt + igstAmt);
    const rawTotal = taxableAmt + totalGst;
    const totalAmt = toAmount(bill.grandTotal, Math.round(rawTotal));
    const roundOff = toAmount(bill.roundOff, totalAmt - rawTotal);
    const cgstRate = taxableAmt > 0 && cgstAmt > 0 ? (cgstAmt * 100) / taxableAmt : (isPurchase ? 0 : fallbackCgstRate);
    const sgstRate = taxableAmt > 0 && sgstAmt > 0 ? (sgstAmt * 100) / taxableAmt : (isPurchase ? 0 : fallbackSgstRate);
    const totalQuantity = isPurchase
        ? (bill.totalPacks || items.reduce((sum, item) => sum + toAmount(item.weightKg, toAmount(item.quantity)), 0) || 0)
        : (bill.totalPacks || items.reduce((sum, item) => sum + toAmount(item.noOfPacks, toAmount(item.quantity)), 0) || 0);
    const numBundles = bill.numOfBundles || 1;
    const purchaseInvoiceNumber = bill.referenceInvoiceNumber || bill.fromText || '';

    const detailRows = isPurchase
        ? [
            ['Bill Number', bill.billNumber || ''],
            ['Bill Date', formatDate(bill.date || bill.createdAt)],
            ['Purchase Inv No', purchaseInvoiceNumber],
            ['Total Weight', `${totalQuantity}`]
        ]
        : [
            ['Invoice Number', bill.billNumber || ''],
            ['Invoice Date', formatDate(bill.date || bill.createdAt)],
            ['From', bill.fromText || ''],
            ['To', bill.toText || '']
        ];

    const buyerHeading = isPurchase ? 'Supplier Copy' : 'Consignee Copy';
    const buyerPrimaryLabel = isPurchase ? 'SUPPLIER:' : 'BUYER:';
    const buyerTertiaryLabel = isPurchase ? 'ADDRESS:' : 'TRANSPORT:';
    const buyerTertiaryValue = isPurchase ? (bill.customer?.address || '') : (bill.transport || '');
    const buyerBottomLabel = isPurchase ? 'INV NO:' : 'CODE:';
    const buyerBottomValue = isPurchase ? purchaseInvoiceNumber : (bill.customer?.stateCode || '33');
    const titleText = isPurchase ? 'PURCHASE INVOICE' : 'TAX INVOICE';
    const quantityLabel = isPurchase ? 'Total Weight' : 'Total Packs';

    const columns = isPurchase
        ? [
            { header: 'S.No', width: 0.06, align: 'center', value: (_, index) => `${index + 1}` },
            { header: 'Particular', width: 0.30, align: 'left', value: (item) => item.productName || item.name || '' },
            { header: 'HSN\nCode', width: 0.12, align: 'center', value: (item) => String(item.hsnCode || item.hsn || '') },
            { header: 'Design /\nColor', width: 0.16, align: 'center', value: (item) => String(item.designColor || item.sizesOrPieces || '') },
            { header: 'Weight\n(KG)', width: 0.12, align: 'center', value: (item) => `${toAmount(item.weightKg, toAmount(item.quantity))}` },
            { header: 'Rate Per\nKG', width: 0.12, align: 'center', value: (item) => `${toAmount(item.ratePerKg, toAmount(item.price))}` },
            { header: 'Amount\nRs.', width: 0.12, align: 'center', value: (item) => `${toAmount(item.total, toAmount(item.weightKg, toAmount(item.quantity)) * toAmount(item.ratePerKg, toAmount(item.price)))}` }
        ]
        : [
            { header: 'S.No', width: 0.05, align: 'center', value: (_, index) => `${index + 1}` },
            { header: 'Product', width: 0.18, align: 'left', value: (item) => item.productName || item.name || '' },
            { header: 'HSN\nCode', width: 0.09, align: 'center', value: (item) => String(item.hsnCode || item.hsn || '') },
            { header: 'Sizes/\nPieces', width: 0.10, align: 'center', value: (item) => String(item.sizesOrPieces || '') },
            { header: 'Rate Per\nPiece', width: 0.10, align: 'center', value: (item) => item.ratePerPiece ? `${item.ratePerPiece}` : '' },
            { header: 'Pcs in\nPack', width: 0.08, align: 'center', value: (item) => item.pcsInPack ? `${item.pcsInPack}` : '' },
            { header: 'Rate Per\nPack', width: 0.11, align: 'center', value: (item) => `${toAmount(item.ratePerPack, toAmount(item.price))}` },
            { header: 'No Of\nPacks', width: 0.09, align: 'center', value: (item) => `${toAmount(item.noOfPacks, toAmount(item.quantity))}` },
            { header: 'Amount\nRs.', width: 0.20, align: 'center', value: (item) => `${toAmount(item.total, toAmount(item.ratePerPack, toAmount(item.price)) * toAmount(item.noOfPacks, toAmount(item.quantity)))}` }
        ];

    // ===== Page dimensions =====
    const pageW = 595.28;
    const pageH = 841.89;
    const M = 22;
    const W = pageW - M * 2;
    const H = pageH - M * 2; // total content height inside border

    // ===== Fixed section heights =====
    const row1H = 36;   // Company Name + GSTIN
    const row2H = 68;   // Address + Invoice Details
    const row3H = 22;   // TAX INVOICE title
    const row4H = 56;   // Buyer / Consignee
    const thH = 26;     // Table header row
    const row6H = 80;   // Summary section
    const row7H = 85;   // Footer (terms + bank + certification)

    const fixedH = row1H + row2H + row3H + row4H + thH + row6H + row7H;
    const tableBodyH = H - fixedH; // Remaining height for table data rows

    // Dynamic row height: fill the entire table body
    const minRows = Math.max(items.length, 10);
    const rowH = Math.floor(tableBodyH / minRows);

    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: M, bottom: M, left: M, right: M }
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const pdfPromise = new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });

    // ===== Colors =====
    const BLUE = '#1a3d7c';
    const BLACK = '#000000';
    const RED = '#cc0000';
    const GRAY_TEXT = '#222222';
    const GRAY_BORDER = '#333333';
    const GRAY_LIGHT = '#555555';

    // ===== Outer border =====
    let y = M;
    doc.lineWidth(2).rect(M, M, W, H).stroke(GRAY_BORDER);

    // Helpers
    const hLine = (yPos, lw = 1.5) => {
        doc.lineWidth(lw).moveTo(M, yPos).lineTo(M + W, yPos).stroke(GRAY_BORDER);
    };
    const vLine = (x, y1, y2, lw = 1.5) => {
        doc.lineWidth(lw).moveTo(x, y1).lineTo(x, y2).stroke(GRAY_BORDER);
    };

    const PX = 16;
    const PY = 6;

    // =============================================
    // ROW 1: Company Name + GSTIN
    // =============================================
    const nameX = M + PX;
    doc.font('Helvetica-Bold').fontSize(20).fillColor(BLUE);
    doc.text(companyName.toUpperCase(), nameX, y + 10, {
        width: W * 0.6 - (nameX - (M + PX)),
        characterSpacing: 1.5
    });

    doc.font('Helvetica-Bold').fontSize(12).fillColor(BLACK);
    doc.text(`GSTIN: ${companyGstin}`, M + W * 0.45, y + 14, {
        width: W * 0.55 - PX,
        align: 'right',
        characterSpacing: 0.3
    });

    y += row1H;
    hLine(y);

    // =============================================
    // ROW 2: Address (left) + Invoice Details (right)
    // =============================================
    const row2Top = y;
    const invoiceDetailsW = 200;
    const addressW = W - invoiceDetailsW;

    vLine(M + addressW, row2Top, row2Top + row2H);

    // Address
    doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY_TEXT);
    const addrX = M + PX;
    let addrY = row2Top + PY + 2;
    const addrLineH = 11;
    doc.text(`OFF : ${companyAddress1}`, addrX, addrY, { width: addressW - PX * 2 });
    addrY += addrLineH;
    doc.text(`OFF : ${companyAddress2}`, addrX, addrY, { width: addressW - PX * 2 });
    addrY += addrLineH;
    doc.text(`State: ${companyState} (Code ${companyStateCode})`, addrX, addrY, { width: addressW - PX * 2 });
    addrY += addrLineH;
    doc.text(`Email: ${companyEmail}`, addrX, addrY, { width: addressW - PX * 2 });
    addrY += addrLineH;
    doc.text(`Mob: ${companyPhone}`, addrX, addrY, { width: addressW - PX * 2 });

    // Invoice details
    const detX = M + addressW + PX;
    const detLabelW = 80;
    const detSepW = 12;
    const detValW = invoiceDetailsW - PX * 2 - detLabelW - detSepW;
    let detY = row2Top + PY + 4;
    const detRowH = 15;

    const drawDetailRow = (label, value) => {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK);
        doc.text(label, detX, detY, { width: detLabelW });
        doc.text(':', detX + detLabelW, detY, { width: detSepW, align: 'center' });
        doc.font('Helvetica').fontSize(9).fillColor(BLACK);
        doc.text(value || '', detX + detLabelW + detSepW, detY, { width: detValW });
        detY += detRowH;
    };

    detailRows.forEach(([label, value]) => drawDetailRow(label, value));

    y += row2H;
    hLine(y);

    // =============================================
    // ROW 3: TAX INVOICE Title Bar
    // =============================================
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BLUE);
    doc.text(titleText, M, y + 4, {
        width: W,
        align: 'center',
        underline: true,
        characterSpacing: 2
    });
    y += row3H;
    hLine(y);

    // =============================================
    // ROW 4: Buyer / Consignee Section
    // =============================================
    const row4Top = y;
    const buyerRightW = invoiceDetailsW;
    const buyerLeftW = W - buyerRightW;

    vLine(M + buyerLeftW, row4Top, row4Top + row4H);

    // Left - Consignee Copy
    doc.font('Helvetica-Oblique').fontSize(7).fillColor(GRAY_LIGHT);
    doc.text(buyerHeading, M + PX, row4Top + PY);

    const bFieldX = M + PX;
    const bLabelW = 70;
    let bFieldY = row4Top + PY + 12;
    const bFieldRowH = 14;

    const drawBuyerField = (label, value) => {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK);
        doc.text(label, bFieldX, bFieldY, { width: bLabelW });
        doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK);
        doc.text((value || '').toUpperCase(), bFieldX + bLabelW + 8, bFieldY, { width: buyerLeftW - PX * 2 - bLabelW - 8 });
        bFieldY += bFieldRowH;
    };

    drawBuyerField(buyerPrimaryLabel, bill.customer?.name || '');
    drawBuyerField('STATE:', bill.customer?.state || 'Tamilnadu');

    doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK);
    doc.text(buyerTertiaryLabel, bFieldX, bFieldY, { width: bLabelW });
    doc.font('Helvetica').fontSize(9).fillColor(BLACK);
    doc.text((buyerTertiaryValue || '').toUpperCase(), bFieldX + bLabelW + 8, bFieldY, { width: buyerLeftW - PX * 2 - bLabelW - 8 });

    // Right side
    const bRightX = M + buyerLeftW + PX;
    const bRLabelW = 50;
    let bRightY = row4Top + PY + 8;
    const bRRowH = 15;

    const drawBuyerRight = (label, value) => {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK);
        doc.text(label, bRightX, bRightY, { width: bRLabelW });
        doc.font('Helvetica').fontSize(9).fillColor(BLACK);
        doc.text(value || '', bRightX + bRLabelW, bRightY, { width: buyerRightW - PX * 2 - bRLabelW });
        bRightY += bRRowH;
    };

    drawBuyerRight('MOB:', bill.customer?.phone || companyMob);
    drawBuyerRight('GSTIN:', bill.customer?.gstin || '');
    drawBuyerRight(buyerBottomLabel, buyerBottomValue);

    y += row4H;
    hLine(y);

    // =============================================
    // ROW 5: Items Table (fills remaining A4 space)
    // =============================================
    const colW = columns.map((column) => W * column.width);

    // Table header
    let tY = y;
    let tX = M;

    doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK);
    for (let i = 0; i < columns.length; i++) {
        doc.lineWidth(1).rect(tX, tY, colW[i], thH).stroke(GRAY_BORDER);
        doc.text(columns[i].header, tX + 3, tY + 4, {
            width: colW[i] - 6,
            align: 'center',
            lineGap: 0
        });
        tX += colW[i];
    }
    tY += thH;

    // Data rows - dynamically sized to fill remaining space
    for (let r = 0; r < minRows; r++) {
        tX = M;
        const item = items[r];

        for (let c = 0; c < columns.length; c++) {
            // Left border
            doc.lineWidth(1)
                .moveTo(tX, tY)
                .lineTo(tX, tY + rowH)
                .stroke(GRAY_BORDER);
            // Right border on last column
            if (c === columns.length - 1) {
                doc.moveTo(tX + colW[c], tY)
                    .lineTo(tX + colW[c], tY + rowH)
                    .stroke(GRAY_BORDER);
            }

            if (item) {
                const column = columns[c];
                const cellText = column.value(item, r);
                const align = column.align || 'center';

                if (cellText) {
                    doc.font('Helvetica').fontSize(8.5).fillColor(BLACK);
                    const textPad = (c === 1) ? 7 : 3;
                    doc.text(cellText, tX + textPad, tY + Math.max(3, (rowH - 10) / 2), {
                        width: colW[c] - textPad - 3,
                        align,
                        lineGap: 0
                    });
                }
            }

            tX += colW[c];
        }
        tY += rowH;
    }

    // Bottom border of table body
    y = tY;
    hLine(y, 2);

    // =============================================
    // ROW 6: Summary (3-column)
    // flex 1.2 : 0.8 : 1
    // =============================================
    const sumTotalFlex = 3.0;
    const sumLeftW = W * (1.2 / sumTotalFlex);
    const sumMidW = W * (0.8 / sumTotalFlex);
    const sumRightW = W * (1.0 / sumTotalFlex);

    vLine(M + sumLeftW, y, y + row6H);
    vLine(M + sumLeftW + sumMidW, y, y + row6H);

    // Left column
    const sLX = M + 14;
    let sLY = y + 10;
    const sLabelW = 68;
    const sSepW = 12;
    const sRowGap = 16;

    const drawSummaryField = (label, value, isWords = false) => {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK);
        doc.text(label, sLX, sLY, { width: sLabelW });
        doc.text(':', sLX + sLabelW, sLY, { width: sSepW, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(isWords ? 8 : 9).fillColor(BLACK);
        doc.text(value, sLX + sLabelW + sSepW + 2, sLY, { width: sumLeftW - 28 - sLabelW - sSepW - 4 });
        sLY += sRowGap;
    };

    drawSummaryField(quantityLabel, `${totalQuantity}`);
    drawSummaryField('Bill Amount', `${totalAmt.toFixed(2)}`);
    drawSummaryField('In words', `Rupees ${numberToWords(totalAmt)} Only`, true);

    // Middle column
    const sMX = M + sumLeftW + 12;
    const sMW = sumMidW - 24;

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BLACK);
    doc.text('NUM OF BUNDLES :', sMX, y + 10, { width: sMW * 0.7 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BLACK);
    doc.text(`${numBundles}`, sMX + sMW * 0.7, y + 8, { width: sMW * 0.3, align: 'right' });

    const gstBoxY = y + row6H - 32;
    const gstBoxH = 24;
    doc.lineWidth(2).rect(sMX, gstBoxY, sMW, gstBoxH).stroke(RED);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(RED);
    doc.text('TOTAL GST', sMX + 8, gstBoxY + 7, { width: sMW * 0.5 });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(RED);
    doc.text(`${totalGst.toFixed(0)}`, sMX + sMW * 0.5, gstBoxY + 5, { width: sMW * 0.45, align: 'right' });

    // Right column - Tax breakdown
    const sRX = M + sumLeftW + sumMidW + 14;
    const sRW = sumRightW - 28;
    const taxRows = [
        { label: 'Product Amt', value: productAmt.toFixed(2) },
        { label: 'Discount', value: discount.toFixed(2) },
        { label: 'Taxable Amt', value: taxableAmt.toFixed(2) },
        { label: `CGST @ ${cgstRate.toFixed(2).replace(/\.00$/, '')}%`, value: cgstAmt.toFixed(2), highlight: true },
        { label: `SGST @ ${sgstRate.toFixed(2).replace(/\.00$/, '')}%`, value: sgstAmt.toFixed(2), highlight: true },
        { label: 'Round Off', value: roundOff.toFixed(2) }
    ];
    const rightTop = y + 8;
    const totalLineY = y + row6H - 20;
    const totalTextY = y + row6H - 10;
    const taxRowGap = (totalLineY - rightTop - 2) / Math.max(taxRows.length - 1, 1);

    taxRows.forEach((row, index) => {
        const rowY = rightTop + (taxRowGap * index);
        const color = row.highlight ? RED : BLACK;
        const fontWeight = row.highlight ? 'Helvetica-Bold' : 'Helvetica';

        doc.font(fontWeight).fontSize(8.6).fillColor(color);
        doc.text(row.label, sRX, rowY, { width: sRW * 0.58 });
        doc.font('Helvetica-Bold').fontSize(8.6).fillColor(color);
        doc.text(row.value, sRX + sRW * 0.58, rowY, { width: sRW * 0.42, align: 'right' });
    });

    doc.lineWidth(1.5).moveTo(sRX - 4, totalLineY).lineTo(sRX + sRW + 4, totalLineY).stroke(BLACK);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BLACK);
    doc.text('Total Amt', sRX, totalTextY, { width: sRW * 0.58 });
    doc.text(`${totalAmt.toFixed(2)}`, sRX + sRW * 0.58, totalTextY, { width: sRW * 0.42, align: 'right' });

    y += row6H;
    hLine(y, 1.5);

    // =============================================
    // ROW 7: Footer (Terms + Bank | Certification)
    // flex 1.2 : 1
    // =============================================
    const footFlex = 2.2;
    const footLeftW = W * (1.2 / footFlex);
    const footRightW = W * (1.0 / footFlex);

    vLine(M + footLeftW, y, y + row7H);

    // Left: Terms
    const fLX = M + 14;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BLUE);
    doc.text('Terms And Conditions', fLX, y + 8, { underline: true });

    doc.font('Helvetica').fontSize(7).fillColor(GRAY_BORDER);
    doc.text(
        `Subject to Tirupur Jurisdiction.\nPayment by Cheque/DD only, payable at Tirupur.\nCheques made in favour of ${companyName} to be sent to Tirunelveli Address\nAll disputes are subjected to Tirunelveli Jurisdiction`,
        fLX, y + 20,
        { width: footLeftW - 28, lineGap: 1.5 }
    );

    // Bank box
    const bankBoxY = y + 42;
    const bankBoxW = footLeftW - 28;
    const bankBoxH = 34;
    doc.rect(fLX, bankBoxY, bankBoxW, bankBoxH).fill('#fffbe6');
    doc.lineWidth(1.5).rect(fLX, bankBoxY, bankBoxW, bankBoxH).stroke('#d4a017');

    doc.font('Helvetica-Bold').fontSize(8).fillColor(RED);
    doc.text('Bank Details:', fLX + 8, bankBoxY + 5, { underline: true });
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BLUE);
    doc.text(`ACC NAME: ${bankAccName}`, fLX + 8, bankBoxY + 14, { width: bankBoxW - 16 });
    doc.text(`BANK: ${bankName}`, fLX + 8, bankBoxY + 20, { width: bankBoxW - 16 });
    doc.text(`ACC NUM: ${bankAccount} | BRANCH: ${bankBranch} | IFSC: ${bankIfsc}`, fLX + 8, bankBoxY + 27, { width: bankBoxW - 16 });

    // Right: Certification + Signature
    const fRX = M + footLeftW + 14;
    const fRW = footRightW - 28;

    doc.font('Helvetica-Oblique').fontSize(9).fillColor(GRAY_BORDER);
    doc.text('Certified that above particulars are true\nand correct', fRX, y + 16, {
        width: fRW,
        align: 'center',
        lineGap: 2
    });

    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(BLUE);
    doc.text(`For ${companyName}`, fRX, y + 56, {
        width: fRW,
        align: 'center'
    });

    // Finalize
    doc.end();
    return pdfPromise;
};

export default { generateBillPDF };
