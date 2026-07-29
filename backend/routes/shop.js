import prisma from '../utils/prisma.js';
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

import { authMiddleware, gateMiddleware } from '../middleware/auth.js';
import { encryptSecret, maskKeyId, hashIdentity } from '../utils/crypto.js';
import { logEvent } from '../utils/auditLog.js';

const router = express.Router();


// GET /api/shop/me — basic (used by onboarding gates)
router.get('/me', authMiddleware, async (req, res) => {
  const shop = await prisma.shop.findUnique({
    where: { id: req.shopId },
    select: {
      id:true, name:true, ownerName:true, email:true, phone:true,
      emailVerified:true, whatsappJoined:true,
      subscriptionPlan:true, subscriptionStatus:true, subscriptionEnd:true, trialUsed:true, pendingPlan:true,
      upiId:true, colorPrice:true, bwPrice:true, isOpen:true, openingTime:true, closingTime:true, qrGenerated:true, createdAt:true,
      razorpayKeyId:true, razorpayConnected:true
    }
  });
  if (!shop) return res.status(404).json({ error: 'Not found' });

  let effectiveStatus = shop.subscriptionStatus;
  if (effectiveStatus === 'ACTIVE' && shop.subscriptionEnd && new Date(shop.subscriptionEnd) < new Date())
    effectiveStatus = 'EXPIRED';

  // Never send the raw key back — only a masked display version
  const { razorpayKeyId, ...rest } = shop;
  res.json({
    ...rest,
    effectiveStatus,
    razorpayKeyMasked: razorpayKeyId ? maskKeyId(razorpayKeyId) : null
  });
});

// PUT /api/shop/razorpay-settings — shopkeeper connects their own Razorpay account for print payments.
// keyId/keySecret come from Razorpay Dashboard > Settings > API Keys (their account, not ScanNprint's).
// webhookSecret comes from Razorpay Dashboard > Settings > Webhooks, after they add our shared endpoint
// (see /agent-info style instructions in the dashboard) with event "payment.captured".
router.put('/razorpay-settings', gateMiddleware, async (req, res) => {
  const { keyId, keySecret, webhookSecret } = req.body;
  if (!keyId || !keySecret || !webhookSecret)
    return res.status(400).json({ error: 'Key ID, Key Secret, and Webhook Secret are all required' });
  if (!/^rzp_(live|test)_/.test(keyId))
    return res.status(400).json({ error: 'That doesn\'t look like a valid Razorpay Key ID (should start with rzp_live_ or rzp_test_)' });

  let razorpayKeySecretEnc, razorpayWebhookSecretEnc;
  try {
    razorpayKeySecretEnc = encryptSecret(keySecret.trim());
    razorpayWebhookSecretEnc = encryptSecret(webhookSecret.trim());
  } catch (e) {
    console.error('Encryption error:', e.message);
    return res.status(500).json({ error: 'Server encryption not configured. Contact support.' });
  }

  const shop = await prisma.shop.update({
    where: { id: req.shopId },
    data: { razorpayKeyId: keyId.trim(), razorpayKeySecretEnc, razorpayWebhookSecretEnc, razorpayConnected: true }
  });
  res.json({ success: true, razorpayKeyMasked: maskKeyId(shop.razorpayKeyId) });
});

// DELETE /api/shop/razorpay-settings — disconnect (customers fall back to manual UPI "I've Paid" flow)
router.delete('/razorpay-settings', gateMiddleware, async (req, res) => {
  await prisma.shop.update({
    where: { id: req.shopId },
    data: { razorpayKeyId: null, razorpayKeySecretEnc: null, razorpayWebhookSecretEnc: null, razorpayConnected: false }
  });
  res.json({ success: true });
});

// PUT /api/shop/settings
router.put('/settings', gateMiddleware, async (req, res) => {
  const { colorPrice, bwPrice, isOpen, upiId, openingTime, closingTime } = req.body;
  const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (openingTime !== undefined && !timeRe.test(openingTime))
    return res.status(400).json({ error: 'openingTime must be in HH:mm 24-hour format' });
  if (closingTime !== undefined && !timeRe.test(closingTime))
    return res.status(400).json({ error: 'closingTime must be in HH:mm 24-hour format' });

  const shop = await prisma.shop.update({
    where: { id: req.shopId },
    data: {
      ...(colorPrice !== undefined && { colorPrice: parseFloat(colorPrice) }),
      ...(bwPrice !== undefined && { bwPrice: parseFloat(bwPrice) }),
      ...(isOpen !== undefined && { isOpen }),
      ...(upiId !== undefined && { upiId: upiId.trim() || null }),
      ...(openingTime !== undefined && { openingTime }),
      ...(closingTime !== undefined && { closingTime }),
      qrGenerated: true
    }
  });
  res.json({ message: 'Settings saved', shop });
});

// POST /api/shop/delete-account
// Requires password + typing "DELETE" to reduce accidental deletions.
// Anonymizes the Shop row instead of hard-deleting it (Order/Printer/SubscriptionPayment
// reference shopId via FK with no cascade). Only records a DeletedIdentity (hashes only, no
// raw PII) if the shop actually used its free trial — an account that never touched the trial
// shouldn't be permanently blocked from getting one on a future signup.
router.post('/delete-account', authMiddleware, async (req, res) => {
  const { password, confirmText } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required to delete account' });
  if (confirmText !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm account deletion' });

  const shop = await prisma.shop.findUnique({ where: { id: req.shopId } });
  if (!shop) return res.status(404).json({ error: 'Not found' });

  const valid = await bcrypt.compare(password, shop.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Incorrect password' });

  const emailHash = hashIdentity(shop.email);
  const phoneHash = hashIdentity(shop.phone);

  const ops = [
    prisma.shop.update({
      where: { id: shop.id },
      data: {
        email: `deleted+${shop.id}@ScanNprint.invalid`,
        phone: `deleted-${shop.id}`.slice(0, 30),
        passwordHash: crypto.randomBytes(32).toString('hex'),
        otpCode: null, otpExpiry: null,
        resetToken: null, resetTokenExpiry: null,
        razorpayKeyId: null, razorpayKeySecretEnc: null, razorpayWebhookSecretEnc: null, razorpayConnected: false,
        agentSecret: null, agentSecretHash: null,
        subscriptionStatus: 'EXPIRED',
        accountDeletedAt: new Date(),
        tokenVersion: { increment: 1 }
      }
    })
  ];

  if (shop.trialUsed) {
    ops.unshift(
      prisma.deletedIdentity.upsert({
        where: { emailHash },
        update: { phoneHash, trialUsed: true, deletedAt: new Date() },
        create: { emailHash, phoneHash, trialUsed: true }
      })
    );
  }

  await prisma.$transaction(ops);
  await logEvent('account_deleted', shop.id, `trialUsed=${shop.trialUsed}`);

  res.json({ success: true, message: 'Account deleted.' });
});

// GET /api/shop/:id/public — customer page (no auth)
router.get('/:id/public', async (req, res) => {
  const shop = await prisma.shop.findUnique({
    where: { id: req.params.id },
    select: { id:true, name:true, isOpen:true, colorPrice:true, bwPrice:true, upiId:true, openingTime:true, closingTime:true, subscriptionStatus:true, subscriptionEnd:true, phone:true }
  });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  let active = ['TRIAL','ACTIVE'].includes(shop.subscriptionStatus);
  if (active && shop.subscriptionEnd && new Date(shop.subscriptionEnd) < new Date()) active = false;

  if (!active) return res.json({ id:shop.id, name:shop.name, isOpen:false, serviceSuspended:true });
  res.json({ id:shop.id, name:shop.name, isOpen:shop.isOpen, colorPrice:shop.colorPrice, bwPrice:shop.bwPrice, upiId:shop.upiId, openingTime:shop.openingTime, closingTime:shop.closingTime, phone:shop.phone });
});

// GET /api/shop/stats
router.get('/stats', gateMiddleware, async (req, res) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const [totalOrders, todayOrders, pendingConfirm, queued, totalRevenue] = await Promise.all([
    prisma.order.count({ where: { shopId:req.shopId, status:'PRINTED' } }),
    prisma.order.count({ where: { shopId:req.shopId, status:'PRINTED', createdAt:{ gte:today } } }),
    prisma.order.count({ where: { shopId:req.shopId, status:'AWAITING_CONFIRMATION' } }),
    prisma.order.count({ where: { shopId:req.shopId, status:'PAID' } }),
    prisma.order.aggregate({ where:{ shopId:req.shopId, status:'PRINTED' }, _sum:{ amount:true } })
  ]);
  res.json({ totalOrders, todayOrders, pendingConfirm, queued, totalRevenue: totalRevenue._sum.amount || 0 });
});

// GET /api/shop/agent-info — no secret here anymore, just whether one exists
router.get('/agent-info', gateMiddleware, async (req, res) => {
  const configured = !!(req.shop.agentSecretHash || req.shop.agentSecret);
  res.json({ shopId: req.shop.id, serverUrl: process.env.PUBLIC_URL || 'http://localhost:4000', configured });
});

// POST /api/shop/agent-secret/generate — only for a shop that has never set one up.
// Returns the plaintext secret ONCE; only the bcrypt hash is ever stored after this.
router.post('/agent-secret/generate', gateMiddleware, async (req, res) => {
  if (req.shop.agentSecretHash || req.shop.agentSecret) {
    return res.status(400).json({ error: 'Already configured. Use regenerate instead.' });
  }
  const secret = crypto.randomBytes(24).toString('hex');
  const agentSecretHash = await bcrypt.hash(secret, 10);
  await prisma.shop.update({ where: { id: req.shopId }, data: { agentSecretHash, agentSecret: null } });
  res.json({ shopId: req.shopId, secret, serverUrl: process.env.PUBLIC_URL || 'http://localhost:4000' });
});

// POST /api/shop/agent-secret/regenerate — invalidates whatever PC is currently connected
// (old secret stops matching the instant this runs) and issues a fresh one, shown once.
router.post('/agent-secret/regenerate', gateMiddleware, async (req, res) => {
  const secret = crypto.randomBytes(24).toString('hex');
  const agentSecretHash = await bcrypt.hash(secret, 10);
  await prisma.shop.update({ where: { id: req.shopId }, data: { agentSecretHash, agentSecret: null } });
  res.json({ shopId: req.shopId, secret, serverUrl: process.env.PUBLIC_URL || 'http://localhost:4000' });
});

// GET /api/shop/agent-download — the PC Agent source bundle (Python script + dependencies list
// + install guide). Static file, doesn't need shop-specific data, so no auth required.
router.get('/agent-download', (req, res) => {
  const zipPath = path.join(process.cwd(), 'public', 'downloads', 'ScanNprintAgent.zip');
  if (!fs.existsSync(zipPath)) return res.status(404).json({ error: 'Agent package not built on this server yet.' });
  res.download(zipPath, 'ScanNprintAgent.zip');
});

// Printers
router.get('/printers', gateMiddleware, async (req, res) => {
  res.json(await prisma.printer.findMany({ where:{ shopId:req.shopId }, orderBy:{ createdAt:'asc' } }));
});

router.put('/printers/:id', gateMiddleware, async (req, res) => {
  const { type, isDefault } = req.body;
  const printer = await prisma.printer.findFirst({ where:{ id:req.params.id, shopId:req.shopId } });
  if (!printer) return res.status(404).json({ error:'Printer not found' });
  if (isDefault) {
    await prisma.printer.updateMany({
      where:{ shopId:req.shopId, type: type||printer.type, id:{ not:printer.id } },
      data:{ isDefault:false }
    });
  }
  res.json(await prisma.printer.update({ where:{ id:printer.id }, data:{ ...(type!==undefined&&{type}), ...(isDefault!==undefined&&{isDefault}) } }));
});

router.delete('/printers/:id', gateMiddleware, async (req, res) => {
  await prisma.printer.deleteMany({ where:{ id:req.params.id, shopId:req.shopId } });
  res.json({ success:true });
});

export default router;