import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import Bill from '../models/Bill.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import { generateBillPDF } from './pdfGenerator.js';
import dotenv from 'dotenv';

dotenv.config();

// ========== Resend HTTP API (Primary - works over HTTPS) ==========
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
if (resend) {
  console.log('📧 Resend HTTP email configured (API key found)');
} else {
  console.log('📧 Resend not configured - no RESEND_API_KEY in .env');
}

// ========== Nodemailer SMTP (Fallback) ==========
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
};

let transporter = createTransporter();

// Refresh transporter if env changes
export const refreshTransporter = () => {
  transporter = createTransporter();
};

// Check if email service is configured
export const isEmailConfigured = () => {
  return !!resend || !!transporter;
};

// Send email - tries Resend HTTP first, then SMTP fallback
const sendEmail = async (to, subject, html, attachments = []) => {
  // Method 1: Resend HTTP API (works on any network)
  if (resend) {
    try {
      const fromEmail = process.env.RESEND_FROM || 'Sri Ram Fashions <onboarding@resend.dev>';
      console.log('📧 Sending via Resend to:', to, 'from:', fromEmail);
      const emailPayload = {
        from: fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      };

      // Add attachments for Resend (base64 format)
      if (attachments && attachments.length > 0) {
        emailPayload.attachments = attachments.map(att => ({
          filename: att.filename,
          content: att.content, // Buffer will be auto-handled by Resend
        }));
      }

      const { data, error } = await resend.emails.send(emailPayload);
      if (error) {
        console.error('❌ Resend API error:', JSON.stringify(error));
        // Fall through to SMTP
      } else {
        console.log('✅ Email sent via Resend:', data?.id);
        return { success: true, messageId: data?.id };
      }
    } catch (error) {
      console.error('❌ Resend exception:', error.message || error);
      // Fall through to SMTP
    }
  }

  // Method 2: SMTP (Nodemailer)
  if (transporter) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || `Sri Ram Fashions <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
        attachments,
      };
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent via SMTP:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ SMTP error:', error.message);
      return { success: false, message: error.message };
    }
  }

  console.log('📧 Email not configured. Would send to:', to, 'Subject:', subject);
  return { success: false, message: 'Email service not configured. Set RESEND_API_KEY or EMAIL_USER+EMAIL_PASS in .env' };
};

// ================= PROFESSIONAL EMAIL TEMPLATE SYSTEM =================

/**
 * Build a premium, email-client-compatible HTML email layout.
 * All templates share this wrapper for consistent branding.
 *
 * @param {Object} opts
 * @param {string} opts.title       – Main heading displayed in the accent banner
 * @param {string} opts.subtitle    – Secondary text under heading (optional)
 * @param {string} opts.icon        – Emoji icon for the accent badge
 * @param {string} opts.accentFrom  – Gradient start colour for the accent banner
 * @param {string} opts.accentTo    – Gradient end colour for the accent banner
 * @param {string} opts.bodyHtml    – Inner content (unique per email type)
 * @returns {string} Complete HTML document string
 */
const buildEmailLayout = ({ title, subtitle = '', icon, accentFrom, accentTo, bodyHtml }) => {
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Sri Ram Fashions</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:32px 16px;">
    <tr><td align="center">

      <!-- Main container -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.08);">

        <!-- ===== BRAND HEADER ===== -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);padding:32px 40px 24px;text-align:center;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <!-- Brand circle badge -->
                <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;margin:0 auto 16px;line-height:56px;font-size:28px;border:2px solid rgba(255,255,255,0.2);">
                  👔
                </div>
                <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:2px;text-transform:uppercase;">SRI RAM FASHIONS</h1>
                <p style="margin:6px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:4px;color:rgba(255,255,255,0.5);font-weight:500;">Business Management System</p>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- ===== ACCENT BANNER (per-email colour) ===== -->
        <tr>
          <td style="background:linear-gradient(135deg,${accentFrom},${accentTo});padding:20px 40px;text-align:center;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <span style="font-size:28px;line-height:1;">${icon}</span>
                <h2 style="margin:8px 0 0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${title}</h2>
                ${subtitle ? `<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.85);font-weight:400;">${subtitle}</p>` : ''}
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY CONTENT ===== -->
        <tr>
          <td style="padding:32px 40px;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- ===== DIVIDER ===== -->
        <tr>
          <td style="padding:0 40px;">
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;">
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td style="padding:24px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;line-height:1.6;">
              This email was auto-generated by Sri Ram Fashions Business Management System.
            </p>
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              Please do not reply to this email directly.
            </p>
          </td>
        </tr>

        <!-- ===== BOTTOM BAR ===== -->
        <tr>
          <td style="background:#0f172a;padding:16px 40px;text-align:center;border-radius:0 0 16px 16px;">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.5px;">
              © ${year} Sri Ram Fashions. All rights reserved.
            </p>
          </td>
        </tr>

      </table>

    </td></tr>
  </table>

</body>
</html>`;
};

// ===== HELPER: Styled detail row for key-value pairs =====
const detailRow = (label, value, options = {}) => {
  const { bold = false, color = '#1f2937', large = false } = options;
  return `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;width:40%;">${label}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;color:${color};font-size:${large ? '18px' : '14px'};font-weight:${bold || large ? '700' : '600'};text-align:right;">${value}</td>
    </tr>`;
};


// ================================================================
//  1. BILL NOTIFICATION
// ================================================================
export const sendBillNotification = async (bill, recipientEmails) => {
  const subject = `New Bill Created - ${bill.billNumber}`;

  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
      A new bill has been generated in the system. Please find the details below and the bill PDF attached to this email.
    </p>

    <!-- Bill details card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      ${detailRow('Bill Number', bill.billNumber, { bold: true })}
      ${detailRow('Customer', bill.customer?.name || bill.customer?.companyName || 'Walk-in Customer')}
      ${detailRow('Date', new Date(bill.date || bill.createdAt).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }))}
      ${detailRow('Total Items', `${bill.items?.length || 0} items`)}
      ${detailRow('Grand Total', `₹${(bill.grandTotal || 0).toLocaleString('en-IN')}`, { large: true, color: '#059669' })}
      ${detailRow('Payment Status', (bill.paymentStatus || 'Pending').toUpperCase(), {
    color: bill.paymentStatus === 'paid' ? '#059669' : '#d97706'
  })}
    </table>

    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
      The invoice PDF has been attached for your records.
    </p>
  `;

  const html = buildEmailLayout({
    title: 'New Bill Created',
    subtitle: `Bill #${bill.billNumber}`,
    icon: '🧾',
    accentFrom: '#059669',
    accentTo: '#10b981',
    bodyHtml,
  });

  // Generate PDF attachment
  let attachments = [];
  try {
    console.log('📄 Generating bill PDF for email attachment...');
    const pdfBuffer = await generateBillPDF(bill);
    attachments = [{
      filename: `SRI_RAM_FASHIONS_Invoice_${bill.billNumber || 'bill'}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }];
    console.log('✅ Bill PDF generated successfully');
  } catch (pdfError) {
    console.error('⚠️ Failed to generate bill PDF, sending email without attachment:', pdfError.message);
  }

  const emails = Array.isArray(recipientEmails) ? recipientEmails : [recipientEmails];
  const results = await Promise.all(emails.map(email => sendEmail(email, subject, html, attachments)));
  return results;
};


// ================================================================
//  2. LOW STOCK ALERT
// ================================================================
export const sendLowStockAlert = async (products, recipientEmails) => {
  const subject = `⚠️ Low Stock Alert - ${products.length} Items Need Attention`;

  const productRows = products.map((p, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : '#fef2f2';
    const stockColor = p.stock <= 0 ? '#dc2626' : '#d97706';
    return `
      <tr style="background:${bg};">
        <td style="padding:12px 16px;border-bottom:1px solid #fecaca;font-size:14px;color:#1f2937;font-weight:500;">${p.name}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #fecaca;text-align:center;font-size:14px;font-weight:700;color:${stockColor};">${p.stock}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #fecaca;text-align:center;font-size:14px;color:#6b7280;">${p.lowStockThreshold}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #fecaca;text-align:center;">
          <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${p.stock <= 0 ? '#fef2f2' : '#fffbeb'};color:${p.stock <= 0 ? '#dc2626' : '#d97706'};border:1px solid ${p.stock <= 0 ? '#fecaca' : '#fde68a'};">
            ${p.stock <= 0 ? 'OUT OF STOCK' : 'LOW'}
          </span>
        </td>
      </tr>`;
  }).join('');

  const bodyHtml = `
    <!-- Alert banner -->
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#991b1b;font-weight:600;">
        🚨 ${products.length} product${products.length > 1 ? 's' : ''} ${products.length > 1 ? 'are' : 'is'} running low on stock and ${products.length > 1 ? 'need' : 'needs'} immediate attention.
      </p>
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fecaca;border-radius:12px;overflow:hidden;">
      <thead>
        <tr style="background:linear-gradient(135deg,#7f1d1d,#991b1b);">
          <th style="padding:14px 16px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#ffffff;font-weight:600;">Product</th>
          <th style="padding:14px 16px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#ffffff;font-weight:600;">Current Stock</th>
          <th style="padding:14px 16px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#ffffff;font-weight:600;">Minimum</th>
          <th style="padding:14px 16px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#ffffff;font-weight:600;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${productRows}
      </tbody>
    </table>

    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;text-align:center;">
      Please restock these items at your earliest convenience to avoid stockouts.
    </p>
  `;

  const html = buildEmailLayout({
    title: 'Low Stock Alert',
    subtitle: `${products.length} item${products.length > 1 ? 's' : ''} need restocking`,
    icon: '⚠️',
    accentFrom: '#dc2626',
    accentTo: '#f59e0b',
    bodyHtml,
  });

  const emails = Array.isArray(recipientEmails) ? recipientEmails : [recipientEmails];
  const results = await Promise.all(emails.map(email => sendEmail(email, subject, html)));
  return results;
};

// Orchestrate low stock check and notification
export const checkAndNotifyLowStock = async (product) => {
  // 1. Check if actually low stock
  if (product.stock > product.lowStockThreshold) return;

  // 2. Throttle: Only send one alert per product per 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (product.lastLowStockAlertAt && product.lastLowStockAlertAt > oneDayAgo) {
    return;
  }

  // 3. Send alert (to ADMIN_EMAIL if configured)
  if (process.env.ADMIN_EMAIL) {
    console.log(`📡 Triggering low stock alert for: ${product.name} (Stock: ${product.stock})`);
    const adminEmails = process.env.ADMIN_EMAIL.split(',').map(e => e.trim());

    // We send a list with just this one product for this trigger
    await sendLowStockAlert([product], adminEmails);

    // 4. Update last alerted timestamp
    product.lastLowStockAlertAt = new Date();
    await product.save();
  }
};


// ================================================================
//  3. DAILY SUMMARY
// ================================================================
export const sendDailySummary = async (summary, recipientEmails) => {
  const subject = `📊 Daily Business Summary - ${new Date().toLocaleDateString('en-IN')}`;

  const statCard = (value, label, icon, color) => `
    <td style="width:50%;padding:8px;">
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px 16px;text-align:center;">
        <div style="font-size:24px;margin-bottom:8px;">${icon}</div>
        <div style="font-size:26px;font-weight:800;color:${color};line-height:1.2;">${value}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:6px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${label}</div>
      </div>
    </td>`;

  const bodyHtml = `
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;text-align:center;">
      Here is your business performance overview for today.
    </p>

    <!-- Stats grid (2x2) -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${statCard(`₹${(summary.totalRevenue || 0).toLocaleString('en-IN')}`, "Today's Revenue", '💰', '#059669')}
        ${statCard(summary.totalOrders || 0, 'Total Orders', '📦', '#2563eb')}
      </tr>
      <tr>
        ${statCard(summary.newCustomers || 0, 'New Customers', '👤', '#7c3aed')}
        ${statCard(summary.lowStockItems || 0, 'Low Stock Items', '📉', summary.lowStockItems > 0 ? '#dc2626' : '#059669')}
      </tr>
    </table>
  `;

  const html = buildEmailLayout({
    title: 'Daily Business Summary',
    subtitle: new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    icon: '📊',
    accentFrom: '#2563eb',
    accentTo: '#3b82f6',
    bodyHtml,
  });

  const emails = Array.isArray(recipientEmails) ? recipientEmails : [recipientEmails];
  const results = await Promise.all(emails.map(email => sendEmail(email, subject, html)));
  return results;
};


// ================================================================
//  4. PASSWORD RESET
// ================================================================
export const sendPasswordResetEmail = async (email, resetCode) => {
  const subject = '🔐 Password Reset Code - Sri Ram Fashions';

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.7;">Hello,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
      We received a request to reset your password. Use the verification code below to complete the process.
    </p>

    <!-- Code box -->
    <div style="background:linear-gradient(135deg,#f8fafc,#f1f5f9);border:2px dashed #cbd5e1;border-radius:16px;padding:28px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Your Reset Code</p>
      <div style="font-size:36px;font-weight:800;letter-spacing:10px;color:#0f172a;font-family:'Courier New',Courier,monospace;line-height:1.4;">${resetCode}</div>
    </div>

    <!-- Warning -->
    <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 18px;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#92400e;font-weight:500;">
        ⏰ This code will expire in <strong>10 minutes</strong>. Do not share it with anyone.
      </p>
    </div>

    <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
      If you did not request a password reset, please ignore this email. Your account is safe.
    </p>
  `;

  const html = buildEmailLayout({
    title: 'Password Reset',
    subtitle: 'Secure verification code',
    icon: '🔐',
    accentFrom: '#334155',
    accentTo: '#475569',
    bodyHtml,
  });

  return sendEmail(email, subject, html);
};


// ================================================================
//  5. REPORT EMAIL
// ================================================================
export const sendReportEmail = async (data, options, recipientEmails) => {
  const { title, fromDate, toDate, type } = options;
  const subject = `📄 ${title} | Sri Ram Fashions – ${new Date().toLocaleDateString('en-IN')}`;

  const reportData = Array.isArray(data) ? data : [];
  const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN');
  const formatMoney = (value) => `₹ ${formatNumber(value)}`;
  const formatDateValue = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN');
  };

  const periodText = fromDate && toDate
    ? `From: ${fromDate}  |  To: ${toDate}`
    : fromDate
      ? `From: ${fromDate}`
      : toDate
        ? `To: ${toDate}`
        : `Date: ${new Date().toLocaleDateString('en-IN')}`;

  let headers = [];
  let alignments = [];
  let rowsHtml = '';
  let totalsRowHtml = '';

  if (type === 'stock') {
    headers = ['S.No', 'Item', 'Size', 'Quantity', 'Rate', 'Total'];
    alignments = ['left', 'left', 'left', 'right', 'right', 'right'];

    rowsHtml = reportData.map((row, i) => {
      const lineTotal = Number(row.total || (Number(row.rate || 0) * Number(row.qty || 0)));
      const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
      return `<tr style="background:${bg};">
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;">${row.sno ?? ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:500;">${row.item ?? ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;">${row.size ?? ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${formatNumber(row.qty)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${formatMoney(row.rate)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600;">${formatMoney(lineTotal)}</td>
      </tr>`;
    }).join('');

    const totQty = reportData.reduce((s, r) => s + Number(r.qty || 0), 0);
    const grandTotal = reportData.reduce((s, r) => s + Number(r.total || (Number(r.rate || 0) * Number(r.qty || 0))), 0);

    totalsRowHtml = `<tr style="background:#eef2ff;font-weight:700;border-top:2px solid #1e40af;">
      <td colspan="3" style="padding:14px 16px;font-size:14px;color:#1e40af;">GRAND TOTAL</td>
      <td style="padding:14px 16px;text-align:right;font-size:14px;color:#1e40af;">${formatNumber(totQty)}</td>
      <td style="padding:14px 16px;text-align:right;font-size:14px;"></td>
      <td style="padding:14px 16px;text-align:right;font-size:15px;color:#1e40af;">${formatMoney(grandTotal)}</td>
    </tr>`;

  } else if (type === 'auditor-sales' || type === 'auditor-purchase') {
    headers = ['Company Name', 'GSTIN', 'Date', 'Inv No', 'Taxable Amt', 'CGST', 'SGST', 'IGST', 'Total'];
    alignments = ['left', 'left', 'left', 'left', 'right', 'right', 'right', 'right', 'right'];

    rowsHtml = reportData.map((row, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
      return `<tr style="background:${bg};">
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:500;">${row.companyName ?? ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:11px;">${row.gstin ?? ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;">${formatDateValue(row.date)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;">${row.invNo ?? ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${formatMoney(row.taxableAmount)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${formatMoney(row.cgst)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${formatMoney(row.sgst)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${formatMoney(row.igst)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600;">${formatMoney(row.total)}</td>
      </tr>`;
    }).join('');

    const totals = reportData.reduce((acc, row) => ({
      taxableAmount: acc.taxableAmount + Number(row.taxableAmount || 0),
      cgst: acc.cgst + Number(row.cgst || 0),
      sgst: acc.sgst + Number(row.sgst || 0),
      igst: acc.igst + Number(row.igst || 0),
      total: acc.total + Number(row.total || 0)
    }), { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

    totalsRowHtml = `<tr style="background:#eef2ff;font-weight:700;border-top:2px solid #1e40af;">
      <td colspan="4" style="padding:14px 16px;font-size:14px;color:#1e40af;">GRAND TOTAL</td>
      <td style="padding:14px 16px;text-align:right;font-size:14px;color:#1e40af;">${formatMoney(totals.taxableAmount)}</td>
      <td style="padding:14px 16px;text-align:right;font-size:14px;color:#1e40af;">${formatMoney(totals.cgst)}</td>
      <td style="padding:14px 16px;text-align:right;font-size:14px;color:#1e40af;">${formatMoney(totals.sgst)}</td>
      <td style="padding:14px 16px;text-align:right;font-size:14px;color:#1e40af;">${formatMoney(totals.igst)}</td>
      <td style="padding:14px 16px;text-align:right;font-size:15px;color:#1e40af;">${formatMoney(totals.total)}</td>
    </tr>`;

  } else {
    headers = ['S.No', 'Date', 'Invoice No', 'Item', 'Rate', 'Qty', 'Total'];
    alignments = ['left', 'left', 'left', 'left', 'right', 'right', 'right'];

    rowsHtml = reportData.map((row, i) => {
      const lineTotal = Number(row.rate || 0) * Number(row.qty || 0);
      const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
      return `<tr style="background:${bg};">
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;">${row.sno ?? ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;">${formatDateValue(row.date)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;">${row.invNo ?? ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:500;">${row.item ?? ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${formatMoney(row.rate)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${formatNumber(row.qty)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600;">${formatMoney(lineTotal)}</td>
      </tr>`;
    }).join('');

    const totQty = reportData.reduce((s, r) => s + Number(r.qty || 0), 0);
    const grandTotal = reportData.reduce((s, r) => s + (Number(r.rate || 0) * Number(r.qty || 0)), 0);

    totalsRowHtml = `<tr style="background:#eef2ff;font-weight:700;border-top:2px solid #1e40af;">
      <td colspan="5" style="padding:14px 16px;font-size:14px;color:#1e40af;">GRAND TOTAL</td>
      <td style="padding:14px 16px;text-align:right;font-size:14px;color:#1e40af;">${formatNumber(totQty)}</td>
      <td style="padding:14px 16px;text-align:right;font-size:15px;color:#1e40af;">${formatMoney(grandTotal)}</td>
    </tr>`;
  }

  if (!rowsHtml) {
    rowsHtml = `<tr><td colspan="${headers.length || 1}" style="padding:32px;text-align:center;color:#6b7280;font-style:italic;font-size:14px;">No data available for this report.</td></tr>`;
    totalsRowHtml = '';
  }

  const thCells = headers.map((h, idx) => {
    const align = alignments[idx] || 'left';
    return `<th style="padding:12px 14px;text-align:${align};font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:#ffffff;background:linear-gradient(135deg,#1e3a5f,#1e40af);font-weight:600;">${h}</th>`;
  }).join('');

  const bodyHtml = `
    <!-- Period info -->
    <div style="background:#f0f4ff;border:1px solid #dbeafe;border-radius:10px;padding:14px 20px;margin:0 0 24px;text-align:center;">
      <p style="margin:0;font-size:13px;color:#1e40af;font-weight:600;">${periodText}</p>
    </div>

    <!-- Report table -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <thead><tr>${thCells}</tr></thead>
      <tbody>${rowsHtml}</tbody>
      ${totalsRowHtml ? `<tfoot>${totalsRowHtml}</tfoot>` : ''}
    </table>

    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
      Report generated on ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
    </p>
  `;

  const html = buildEmailLayout({
    title,
    subtitle: periodText,
    icon: '📄',
    accentFrom: '#1e3a5f',
    accentTo: '#2563eb',
    bodyHtml,
  });

  const emails = Array.isArray(recipientEmails) ? recipientEmails : [recipientEmails];
  const responses = await Promise.all(emails.map(email => sendEmail(email, subject, html)));
  return responses;
};


// ================================================================
//  6. GENERIC NOTIFICATION
// ================================================================
export const sendNotification = async (to, subject, message) => {
  const bodyHtml = `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
      <p style="margin:0;font-size:15px;color:#374151;line-height:1.8;">${message}</p>
    </div>
  `;

  const html = buildEmailLayout({
    title: 'Notification',
    icon: '🔔',
    accentFrom: '#7c3aed',
    accentTo: '#8b5cf6',
    bodyHtml,
  });

  return sendEmail(to, subject, html);
};


// ================================================================
//  DAILY SUMMARY CALCULATOR + SENDER
// ================================================================
export const calculateAndSendDailySummary = async (recipientEmails) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Calculate Today's Revenue & Orders
    const billsToday = await Bill.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    const totalRevenue = billsToday.reduce((sum, bill) => sum + (bill.grandTotal || 0), 0);
    const totalOrders = billsToday.length;

    // 2. Count New Customers
    const newCustomers = await Customer.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    // 3. Count Low Stock Items
    const lowStockItems = await Product.countDocuments({
      isActive: true,
      $expr: { $lte: ['$stock', '$lowStockThreshold'] }
    });

    const summary = {
      totalRevenue,
      totalOrders,
      newCustomers,
      lowStockItems
    };

    const results = await sendDailySummary(summary, recipientEmails);
    return { success: results.some((entry) => entry.success), data: summary, results };
  } catch (error) {
    console.error('Error calculating daily summary:', error);
    return { success: false, message: error.message };
  }
};

export default {
  sendBillNotification,
  sendPasswordResetEmail,
  sendLowStockAlert,
  sendReportEmail,
  sendNotification,
  calculateAndSendDailySummary,
  isEmailConfigured,
  checkAndNotifyLowStock
};
