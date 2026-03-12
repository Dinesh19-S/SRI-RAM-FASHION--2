import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { sendPasswordResetEmail, isEmailConfigured } from '../services/emailService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}

const GOOGLE_CLIENT_IDS = [
    ...(process.env.GOOGLE_CLIENT_IDS || '').split(','),
    process.env.GOOGLE_CLIENT_ID || ''
]
    .map((value) => value.trim())
    .filter(Boolean);

const googleClient = GOOGLE_CLIENT_IDS.length > 0 ? new OAuth2Client() : null;

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email, isActive: true });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Google OAuth Login
router.post('/google', async (req, res) => {
    try {
        if (!googleClient || GOOGLE_CLIENT_IDS.length === 0) {
            return res.status(503).json({
                success: false,
                message: 'Google login is not configured on this server'
            });
        }

        const { credential } = req.body;

        // Verify the Google token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_IDS
        });

        const payload = ticket.getPayload();
        const { email, name, picture, sub: googleId } = payload;

        // Check if user exists
        let user = await User.findOne({ email });

        if (!user) {
            // Create new user from Google account
            user = new User({
                name,
                email,
                password: await bcrypt.hash(googleId + Math.random().toString(), 10),
                phone: '',
                role: 'staff',
                avatar: picture,
                googleId,
                isActive: true
            });
            await user.save();
        } else {
            // Update Google ID and avatar if not set
            if (!user.googleId) {
                user.googleId = googleId;
                user.avatar = picture || user.avatar;
                await user.save();
            }
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('Google auth error:', error.message);
        console.error('Full error:', error);
        // Return more specific error message for debugging
        let errorMessage = 'Google authentication failed';
        if (error.message.includes('Token used too late')) {
            errorMessage = 'Token expired. Please try again.';
        } else if (error.message.includes('Invalid token')) {
            errorMessage = 'Invalid token. Please try again.';
        } else if (error.message.includes('audience')) {
            errorMessage = 'Client ID mismatch. Check GOOGLE_CLIENT_ID/GOOGLE_CLIENT_IDS and Google Cloud Console origins.';
        }
        res.status(401).json({ success: false, message: errorMessage, debug: error.message });
    }
});

// Login with Phone OTP (mock implementation)
router.post('/login-phone', async (req, res) => {
    try {
        const { phone, otp } = req.body;

        // In production, verify OTP from SMS service
        if (otp !== '123456') {
            return res.status(401).json({ success: false, message: 'Invalid OTP' });
        }

        let user = await User.findOne({ phone, isActive: true });
        if (!user) {
            // Create new user for phone login
            user = new User({
                name: 'Phone User',
                email: `${phone}@phone.local`,
                password: await bcrypt.hash(Math.random().toString(), 10),
                phone,
                role: 'staff'
            });
            await user.save();
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Send OTP (mock implementation)
router.post('/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        // In production, integrate with SMS service
        console.log(`OTP sent to ${phone}: 123456`);
        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// In-memory storage for password reset codes (in production, use Redis or database)
const resetCodes = new Map();

// Forgot Password - Request reset code
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email, isActive: true });
        if (!user) {
            // Don't reveal if email exists for security
            return res.json({ success: true, message: 'If the email exists, a reset code has been sent' });
        }

        // Generate 6-digit reset code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Store with 10-minute expiry
        resetCodes.set(email, {
            code: resetCode,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
        });

        // Send reset code via email
        if (isEmailConfigured()) {
            const emailResult = await sendPasswordResetEmail(email, resetCode);
            if (!emailResult.success) {
                console.warn('⚠️ Failed to send reset email:', emailResult.message);
            }
        } else {
            // Fallback: log to console when email is not configured
            console.log(`\n========================================`);
            console.log(`Password Reset Code for ${email}: ${resetCode}`);
            console.log(`This code expires in 10 minutes.`);
            console.log(`========================================\n`);
        }

        res.json({ success: true, message: 'Reset code sent to your email' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Reset Password - Verify code and set new password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        // Check if reset code exists and is valid
        const storedData = resetCodes.get(email);
        if (!storedData) {
            return res.status(400).json({ success: false, message: 'No reset code found. Please request a new one.' });
        }

        if (Date.now() > storedData.expiresAt) {
            resetCodes.delete(email);
            return res.status(400).json({ success: false, message: 'Reset code has expired. Please request a new one.' });
        }

        if (storedData.code !== code) {
            return res.status(400).json({ success: false, message: 'Invalid reset code' });
        }

        // Find user and update password
        const user = await User.findOne({ email, isActive: true });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Hash new password and save
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        // Clear the reset code
        resetCodes.delete(email);

        console.log(`Password successfully reset for ${email}`);

        res.json({ success: true, message: 'Password reset successfully. You can now login with your new password.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            role: 'staff'
        });

        await user.save();

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get Profile (protected)
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch profile' });
    }
});

export default router;
