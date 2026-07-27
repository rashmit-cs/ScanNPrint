import prisma from '../utils/prisma.js';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth.js';
import { sendOtpEmail, sendPasswordResetEmail } from '../utils/mailer.js';
import { PLAN_DAYS, PLAN_PRICE } from '../utils/plans.js';
import { hashIdentity } from '../utils/crypto.js';
import { logEvent } from '../utils/auditLog.js';

const router = express.Router();

const genOtp = () => crypto.randomInt(100000, 1000000).toString();
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

function signToken(shop) {
  return jwt.sign({ shopId: shop.id, tv: shop.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, ownerName, email, password, phone } = req.body;
  if (!name || !email || !password || !phone || !ownerName)
    return res.status(400).json({ error: 'All fields required' });

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length !== 10)
    return res.status(400).json({ error: 'Enter a valid 10-digit phone number' });

  const [byEmail, byPhone] = await Promise.all([
    prisma.shop.findUnique({ where: { email: cleanEmail } }),
    prisma.shop.findUnique({ where: { phone: cleanPhone } })
  ]);
  if (byEmail) return res.status(400).json({ error: 'Email already registered. Please login.' });
  if (byPhone) return res.status(400).json({ error: 'Phone number already registered.' });

  // Email is OTP-verified during onboarding, so an emailHash match is trustworthy enough to
  // block a repeat trial. Phone is NOT verified anywhere yet (no SMS step), so a phoneHash-only
  // match is just flagged/logged, never used to block — otherwise someone could type a stranger's
  // number at signup and burn that stranger's future trial eligibility.
  const emailHash = hashIdentity(cleanEmail);
  const phoneHash = hashIdentity(cleanPhone);

  const [emailMatch, phoneOnlyMatch] = await Promise.all([
    prisma.deletedIdentity.findFirst({ where: { emailHash, trialUsed: true } }),
    prisma.deletedIdentity.findFirst({ where: { phoneHash, trialUsed: true } })
  ]);
  const blockTrial = !!emailMatch;

  const passwordHash = await bcrypt.hash(password, 10);
  const otpPlain = genOtp();
  const otpCode = await bcrypt.hash(otpPlain, 10);
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  const shop = await prisma.shop.create({
    data: {
      name, ownerName, email: cleanEmail, passwordHash, phone: cleanPhone,
      otpCode, otpExpiry, otpLastSentAt: new Date(),
      trialUsed: blockTrial // pre-block the free trial if this verified email has used one before
    }
  });

  if (blockTrial) {
    await logEvent('trial_denied_at_signup', shop.id, 'emailHash matched a previously deleted account');
  } else if (phoneOnlyMatch) {
    await logEvent('trial_flagged_unverified_phone', shop.id, 'phoneHash matched a deleted account but phone is unverified — trial NOT blocked');
  }

  const sent = await sendOtpEmail(cleanEmail, otpPlain, name);
  const token = signToken(shop);

  res.json({
    token,
    shop: { id: shop.id, name: shop.name, email: shop.email },
    emailSent: sent,
    devOtp: process.env.NODE_ENV !== 'production' && !sent ? otpPlain : undefined
  });
});

// POST /api/auth/verify-otp
router.post('/verify-otp', authMiddleware, async (req, res) => {
  const { otp } = req.body;
  if (!otp) return res.status(400).json({ error: 'OTP required' });

  const shop = await prisma.shop.findUnique({ where: { id: req.shopId } });
  if (!shop) return res.status(404).json({ error: 'Account not found' });
  if (shop.emailVerified) return res.json({ success: true });
  if (!shop.otpCode || !shop.otpExpiry || shop.otpExpiry < new Date())
    return res.status(400).json({ error: 'OTP expired. Please resend.' });
  if (shop.otpAttempts >= OTP_MAX_ATTEMPTS)
    return res.status(429).json({ error: 'Too many incorrect attempts. Please resend a new OTP.' });

  const valid = await bcrypt.compare(otp.trim(), shop.otpCode);
  if (!valid) {
    await prisma.shop.update({ where: { id: req.shopId }, data: { otpAttempts: { increment: 1 } } });
    return res.status(400).json({ error: 'Incorrect OTP' });
  }

  await prisma.shop.update({
    where: { id: req.shopId },
    data: { emailVerified: true, otpCode: null, otpExpiry: null, otpAttempts: 0 }
  });
  res.json({ success: true });
});

// POST /api/auth/resend-otp
router.post('/resend-otp', authMiddleware, async (req, res) => {
  const shop = await prisma.shop.findUnique({ where: { id: req.shopId } });
  if (!shop) return res.status(404).json({ error: 'Account not found' });
  if (shop.emailVerified) return res.json({ success: true });

  if (shop.otpLastSentAt && Date.now() - shop.otpLastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - shop.otpLastSentAt.getTime())) / 1000);
    return res.status(429).json({ error: `Please wait ${waitSec}s before requesting another OTP.` });
  }

  const otpPlain = genOtp();
  const otpCode = await bcrypt.hash(otpPlain, 10);
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.shop.update({
    where: { id: req.shopId },
    data: { otpCode, otpExpiry, otpAttempts: 0, otpLastSentAt: new Date() }
  });
  const sent = await sendOtpEmail(shop.email, otpPlain, shop.name);
  res.json({ success: true, devOtp: process.env.NODE_ENV !== 'production' && !sent ? otpPlain : undefined });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const shop = await prisma.shop.findUnique({ where: { email: (email || '').trim().toLowerCase() } });
  if (!shop || shop.accountDeletedAt) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, shop.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken(shop);
  res.json({ token, shop: { id: shop.id, name: shop.name, email: shop.email } });
});

// POST /api/auth/select-plan
router.post('/select-plan', authMiddleware, async (req, res) => {
  const { plan } = req.body;
  if (!PLAN_DAYS[plan]) return res.status(400).json({ error: 'Invalid plan' });
  const shop = await prisma.shop.findUnique({ where: { id: req.shopId } });
  if (!shop) return res.status(404).json({ error: 'Not found' });
  if (!shop.emailVerified) return res.status(403).json({ error: 'Verify email first' });

  if (plan === 'TRIAL') {
    if (shop.trialUsed) return res.status(400).json({ error: 'Free trial already used on this account' });
    const subscriptionEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    await prisma.shop.update({ where: { id: req.shopId }, data: { subscriptionPlan:'TRIAL', subscriptionStatus:'TRIAL', subscriptionEnd, trialUsed:true } });
    return res.json({ success: true, status: 'TRIAL', subscriptionEnd });
  }

  // Paid plans (first purchase, renewal, or upgrade) are no longer handled here —
  // they go through automated Razorpay Checkout at POST /api/payment/create-order,
  // which activates instantly via webhook/verify. No manual UPI/WhatsApp step.
  return res.status(400).json({ error: 'Use /api/payment/create-order to purchase or upgrade a paid plan.' });
});

// POST /api/auth/join-whatsapp
router.post('/join-whatsapp', authMiddleware, async (req, res) => {
  await prisma.shop.update({ where: { id: req.shopId }, data: { whatsappJoined: true } });
  res.json({ success: true });
});

// GET /api/auth/plan-info
router.get('/plan-info', (req, res) => {
  res.json({
    prices: PLAN_PRICE, days: PLAN_DAYS,
    platformUpi: process.env.PLATFORM_UPI || '',
    whatsapp: process.env.WHATSAPP_GROUP_LINK || '',
    supportEmail: process.env.SUPPORT_EMAIL || ''
  });
});

// POST /api/auth/forgot-password — always returns success (never reveal whether an email exists)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const shop = await prisma.shop.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (shop && !shop.accountDeletedAt) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.shop.update({ where: { id: shop.id }, data: { resetToken, resetTokenExpiry } });

    const base = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${base}/reset-password?token=${resetToken}`;
    const sent = await sendPasswordResetEmail(shop.email, resetLink, shop.name);
    if (!sent && process.env.NODE_ENV !== 'production') {
      return res.json({ success: true, devResetLink: resetLink });
    }
  }
  // Same response whether or not the account exists — avoids leaking which emails are registered
  res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const shop = await prisma.shop.findFirst({ where: { resetToken: token } });
  if (!shop || !shop.resetTokenExpiry || shop.resetTokenExpiry < new Date())
    return res.status(400).json({ error: 'Reset link is invalid or expired. Request a new one.' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.shop.update({
    where: { id: shop.id },
    // bump tokenVersion — a password reset should also kill any other logged-in session/device
    data: { passwordHash, resetToken: null, resetTokenExpiry: null, tokenVersion: { increment: 1 } }
  });
  await logEvent('password_reset', shop.id, null);
  res.json({ success: true, message: 'Password updated. You can now log in.' });
});

export default router;