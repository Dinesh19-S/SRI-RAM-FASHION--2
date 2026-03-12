import express from 'express';
import Bill from '../models/Bill.js';
import {
    isEmailConfigured,
    sendBillNotification,
    sendNotification,
    sendReportEmail,
    calculateAndSendDailySummary
} from '../services/emailService.js';

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const splitRecipients = (value) => {
    if (Array.isArray(value)) {
        return value.flatMap((entry) => splitRecipients(entry));
    }

    return String(value || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
};

const uniqueRecipients = (values = []) => {
    const flattened = splitRecipients(values);
    return [...new Set(flattened.map((entry) => entry.toLowerCase()))];
};

const invalidRecipients = (recipients = []) => recipients.filter((entry) => !EMAIL_PATTERN.test(entry));

const resolveRecipients = (req, ...fallbackSources) => {
    const requestedRecipients = uniqueRecipients(req.body?.to);
    const fallbackRecipients = uniqueRecipients([
        req.user?.email,
        ...fallbackSources,
        process.env.ADMIN_EMAIL,
        process.env.EMAIL_USER
    ]);

    const recipients = requestedRecipients.length > 0 ? requestedRecipients : fallbackRecipients;

    return {
        recipients: recipients.filter((entry) => EMAIL_PATTERN.test(entry)),
        invalidRecipients: invalidRecipients(recipients)
    };
};

const getEmailProvider = () => {
    if (process.env.RESEND_API_KEY) return 'resend';
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) return 'smtp';
    return null;
};

const formatRecipientList = (recipients = []) => recipients.join(', ');
const appendSkippedInvalidMessage = (message, invalidRecipientsList = []) => (
    invalidRecipientsList.length > 0
        ? `${message}. Skipped invalid: ${formatRecipientList(invalidRecipientsList)}`
        : message
);
const buildMissingRecipientMessage = (invalidRecipientsList = []) => (
    invalidRecipientsList.length > 0
        ? `No valid recipient email found. Invalid: ${formatRecipientList(invalidRecipientsList)}`
        : 'No recipient email provided'
);

// Check email configuration status
router.get('/status', (req, res) => {
    const defaultRecipients = uniqueRecipients([
        req.user?.email,
        process.env.ADMIN_EMAIL,
        process.env.EMAIL_USER
    ]);

    res.json({
        success: true,
        configured: isEmailConfigured(),
        provider: getEmailProvider(),
        defaultRecipient: defaultRecipients[0] || '',
        defaultRecipients,
        emailUser: process.env.EMAIL_USER ? `${process.env.EMAIL_USER.slice(0, 3)}***` : null
    });
});

// Send test email
router.post('/test', async (req, res) => {
    try {
        if (!isEmailConfigured()) {
            return res.status(400).json({
                success: false,
                message: 'Email service not configured. Set RESEND_API_KEY or EMAIL_USER and EMAIL_PASS in .env'
            });
        }

        const { recipients, invalidRecipients: invalid } = resolveRecipients(req);
        if (recipients.length === 0) {
            return res.status(400).json({ success: false, message: buildMissingRecipientMessage(invalid) });
        }

        const result = await sendNotification(
            recipients,
            'Test Email - Sri Ram Fashions',
            'This is a test email to verify your email configuration is working correctly.'
        );

        res.json({
            success: result.success,
            invalidRecipients: invalid,
            sentRecipients: result.success ? recipients : [],
            message: result.success
                ? appendSkippedInvalidMessage(`Test email sent to ${formatRecipientList(recipients)}`, invalid)
                : result.message
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Send daily summary email
router.post('/daily-summary', async (req, res) => {
    try {
        if (!isEmailConfigured()) {
            return res.status(400).json({
                success: false,
                message: 'Email service not configured'
            });
        }

        // Force recipients to be the admin email only as per user request
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
        const recipients = [adminEmail].filter((e) => EMAIL_PATTERN.test(e));

        if (recipients.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid admin email configured' });
        }

        // Trigger calculation and sending in background for speed
        calculateAndSendDailySummary(recipients).catch(error => {
            console.error('Background Daily Summary Error:', error);
        });

        res.json({
            success: true,
            message: `Daily summary is being sent to ${formatRecipientList(recipients)}. You will receive it shortly.`,
            sentRecipients: recipients
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Send report email
router.post('/send-report', async (req, res) => {
    try {
        const { type, fromDate, toDate, data } = req.body;

        if (!isEmailConfigured()) {
            return res.status(400).json({
                success: false,
                message: 'Email service not configured'
            });
        }

        // Force recipients to be the admin email only as per user request
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
        const recipients = [adminEmail].filter((e) => EMAIL_PATTERN.test(e));

        if (recipients.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid admin email configured' });
        }

        const reportTitles = {
            sales: 'Sales Report',
            purchase: 'Purchase Report',
            stock: 'Stock Report',
            'auditor-sales': 'Auditor Sales Report',
            'auditor-purchase': 'Auditor Purchase Report'
        };
        const title = reportTitles[type] || 'Report';
        const options = { title, fromDate, toDate, type };

        // Trigger PDF generation and sending in background for speed
        sendReportEmail(data, options, recipients).catch(error => {
            console.error(`Background ${title} Error:`, error);
        });

        res.json({
            success: true,
            message: `${title} is being processed and will be sent to ${formatRecipientList(recipients)} shortly.`,
            sentRecipients: recipients
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Send bill email
router.post('/send-bill/:billId', async (req, res) => {
    try {
        const { billId } = req.params;

        const bill = await Bill.findById(billId);
        if (!bill) {
            return res.status(404).json({ success: false, message: 'Bill not found' });
        }

        if (!isEmailConfigured()) {
            return res.status(400).json({
                success: false,
                message: 'Email service not configured. Set RESEND_API_KEY or EMAIL_USER and EMAIL_PASS in .env'
            });
        }

        const { recipients, invalidRecipients: invalid } = resolveRecipients(req, bill.customer?.email);
        if (recipients.length === 0) {
            return res.status(400).json({
                success: false,
                message: buildMissingRecipientMessage(invalid)
            });
        }

        const results = await sendBillNotification(bill, recipients);
        const sentRecipients = recipients.filter((entry, index) => results[index]?.success);
        const failedRecipients = recipients.filter((entry, index) => !results[index]?.success);
        
        // At least one recipient was successful
        const sent = sentRecipients.length > 0;
        
        // Aggregate error messages from results if failed
        let errorMessage = 'Failed to send email';
        if (!sent && results.length > 0) {
            const firstError = results.find(r => r.message)?.message;
            if (firstError) {
                if (firstError.includes('sandbox_not_allowed')) {
                    errorMessage = 'Email rejected by provider (Resend Sandbox). You can only send to verified emails.';
                } else {
                    errorMessage = `Failed to send: ${firstError}`;
                }
            }
        }

        const baseMessage = sent
            ? `Bill ${bill.billNumber} emailed to ${formatRecipientList(sentRecipients)}`
            : errorMessage;
            
        const failureSuffix = (sent && failedRecipients.length > 0)
            ? `. Failed: ${formatRecipientList(failedRecipients)}`
            : '';

        res.json({
            success: sent,
            message: appendSkippedInvalidMessage(`${baseMessage}${failureSuffix}`, invalid),
            sentRecipients,
            failedRecipients,
            invalidRecipients: invalid
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
