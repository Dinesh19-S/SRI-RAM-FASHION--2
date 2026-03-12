import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
    company: {
        name: { type: String, default: 'SRI RAM FASHIONS' },
        address1: { type: String, default: '61C9, Anupparpalayam Puthur, Tirupur. 641652' },
        address2: { type: String, default: '81 K, Madurai Raod, SankerNager, Tirunelveli Dt. 627357' },
        address: String,
        city: String,
        state: { type: String, default: 'Tamilnadu' },
        stateCode: { type: String, default: '33' },
        pincode: String,
        phone: { type: String, default: '9080573831' },
        phone2: { type: String, default: '9442807770' },
        email: { type: String, default: 'sriramfashionstrp@gmail.com' },
        gstin: { type: String, default: '33AZRPM4425F2ZA' },
        pan: String,
        logo: String
    },
    bank: {
        accountHolderName: { type: String, default: 'SRI RAM FASHIONS' },
        bankName: { type: String, default: 'SOUTH INDIAN BANK' },
        accountNumber: { type: String, default: '0338073000002328' },
        ifscCode: { type: String, default: 'SIBL0000338' },
        branchName: { type: String, default: 'TIRUPUR' },
        upiId: String
    },
    tax: {
        cgstRate: { type: Number, default: 2.5 },
        sgstRate: { type: Number, default: 2.5 },
        igstRate: { type: Number, default: 5 },
        enableGst: { type: Boolean, default: true },
        inclusiveTax: { type: Boolean, default: false }
    },
    billTerms: {
        type: String,
        default: 'Cheques made in favour of SRI RAM FASHIONS to be send toTrinelveli Address\nAll disputes are subjected toTrinelveli Jurisdiction'
    },
    billFooter: {
        type: String,
        default: 'Certified that above particulars are true and correct\nFor SRI RAM FASHIONS'
    },
    billTemplate: {
        // Header Labels
        labels: {
            invoiceNumber: { type: String, default: 'INVOICE NUMBER' },
            invoiceDate: { type: String, default: 'INVOICE DATE' },
            from: { type: String, default: 'FROM' },
            to: { type: String, default: 'TO' },
            buyer: { type: String, default: 'BUYER' },
            gstin: { type: String, default: 'GSTIN' },
            state: { type: String, default: 'STATE' },
            transport: { type: String, default: 'TRANSPORT' },
            mob: { type: String, default: 'MOB' },
            code: { type: String, default: 'CODE' },
            // Table Column Labels
            sno: { type: String, default: 'S.No' },
            product: { type: String, default: 'Product' },
            hsnCode: { type: String, default: 'HSN CODE' },
            sizesPieces: { type: String, default: 'Sizes/Pieces' },
            ratePerPiece: { type: String, default: 'Rate Per Piece' },
            pcsInPack: { type: String, default: 'Pcs in Pack' },
            ratePerPack: { type: String, default: 'Rate Per Pack' },
            noOfPacks: { type: String, default: 'No Of Packs' },
            amount: { type: String, default: 'Amount Rs' },
            // Footer Labels
            totalPacks: { type: String, default: 'Total Packs' },
            billAmount: { type: String, default: 'Bill Amount' },
            inWords: { type: String, default: 'In words' },
            numOfBundles: { type: String, default: 'NUM OF BUNDLES' },
            totalGst: { type: String, default: 'TOTAL GST' },
            productAmt: { type: String, default: 'Product Amt' },
            discount: { type: String, default: 'Discount' },
            taxableAmt: { type: String, default: 'Taxable Amt' },
            roundOff: { type: String, default: 'Round Off' },
            totalAmt: { type: String, default: 'Total Amt' },
            // Bank Labels
            accName: { type: String, default: 'ACC NAME' },
            bank: { type: String, default: 'BANK' },
            accNum: { type: String, default: 'ACC NUM' },
            branch: { type: String, default: 'BRANCH' },
            ifsc: { type: String, default: 'IFSC' }
        },
        // Column Visibility
        columns: {
            sno: { type: Boolean, default: true },
            product: { type: Boolean, default: true },
            hsnCode: { type: Boolean, default: true },
            sizesPieces: { type: Boolean, default: true },
            ratePerPiece: { type: Boolean, default: true },
            pcsInPack: { type: Boolean, default: true },
            ratePerPack: { type: Boolean, default: true },
            noOfPacks: { type: Boolean, default: true },
            amount: { type: Boolean, default: true }
        },
        // Section Visibility
        sections: {
            fromToDate: { type: Boolean, default: true },
            transport: { type: Boolean, default: true },
            consignerCopy: { type: Boolean, default: true },
            numOfBundles: { type: Boolean, default: true },
            bankDetails: { type: Boolean, default: true },
            termsConditions: { type: Boolean, default: true }
        },
        // Item row count
        itemRowCount: { type: Number, default: 15 }
    }
}, {
    timestamps: true
});

export default mongoose.model('Settings', settingsSchema);
