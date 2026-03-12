import cron from 'node-cron';
import { calculateAndSendDailySummary, isEmailConfigured } from './emailService.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Initializes all automated scheduled tasks for the system.
 */
export const initScheduler = () => {
    console.log('⏰ Initializing Business Automation Scheduler...');

    // 1. Daily Summary Email - Scheduled for 10:00 AM IST
    // IST is UTC+5:30. In many servers (UTC), this would be 04:30 UTC.
    // However, node-cron usually uses server time. 
    // We'll schedule it for 10:00 (server time) as a safe default for local/India servers.
    cron.schedule('0 10 * * *', async () => {
        console.log('📊 [Scheduler] Triggering Daily Summary Email...');

        try {
            if (!isEmailConfigured()) {
                console.warn('📊 [Scheduler] Email service not configured. Skipping daily summary.');
                return;
            }

            const recipient = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
            if (!recipient) {
                console.warn('📊 [Scheduler] No admin email configured. Skipping daily summary.');
                return;
            }

            const adminEmails = recipient.split(',').map(e => e.trim());
            const result = await calculateAndSendDailySummary(adminEmails);

            if (result.success) {
                console.log(`✅ [Scheduler] Daily summary sent successfully to ${recipient}`);
            } else {
                console.error(`❌ [Scheduler] Failed to send daily summary: ${result.message}`);
            }
        } catch (error) {
            console.error('❌ [Scheduler] Error in Daily Summary Job:', error);
        }
    });

    console.log('✅ Scheduler active: Daily Summary set for 10:00');
};

export default {
    initScheduler
};
