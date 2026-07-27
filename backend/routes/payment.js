import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import prisma from '../utils/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { PLAN_DAYS, PLAN_PRICE } from '../utils/plans.js';
import { safeEqual } from '../utils/safeCompare.js';

const router = express.Router();

// Subscriptions (shop → PrintDrop) always use PrintDrop's OWN platform Razorpay account —
// unlike print orders, which use each shop's own connected account. Never mix these up.
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Deliberately NOT gateMiddleware — gateMiddleware blocks on subscriptionStatus === 'NONE' /
// 'EXPIRED', which are exactly the states a shop needs to be able to pay FROM. A shop must be
// able to buy a plan for the first time, renew after expiry, or upgrade mid-trial — all three.
// Only real requirement: they're a logged-in, email-verified shop.
async function requireVerifiedShop(req, res, next) {
  const shop = await prisma.shop.findUnique({ where: { id: req.shopId } });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (!shop.emailVerified) return res.status(403).json({ error: 'Verify your email first' });
  req.shopRecord = shop;
  next();
}

// Extends from whichever is later — "now" or the shop's current subscriptionEnd — so upgrading
// mid-trial or renewing early never discards time already banked.
function extendedEnd(shop, plan) {
  const base = shop.subscriptionEnd && new Date(shop.subscriptionEnd) > new Date() ? new Date(shop.subscriptionEnd) : new Date();
  return new Date(base.getTime() + PLAN_DAYS[plan] * 86400000);
}

// ── POST /api/payment/create-order ────────────────────────────────────────
// First purchase, renewal, or upgrade — all go through here now. No manual UPI, no WhatsApp step.
router.post('/create-order', authMiddleware, requireVerifiedShop, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLAN_PRICE[plan]) return res.status(400).json({ error: 'Invalid plan' });

    const amount = PLAN_PRICE[plan];
    const order = await razorpay.orders.create({
      amount: amount * 100, // paise
      currency: 'INR',
      receipt: `sub_${Date.now()}`,
      notes: { shopId: req.shopId, plan },
    });

    res.json({
      success: true,
      razorpayOrderId: order.id,
      amount,
      amountPaise: amount * 100,
      key: process.env.RAZORPAY_KEY_ID,
      plan,
    });
  } catch (err) {
    console.error('[payment] create-order error:', err);
    res.status(500).json({ error: 'Unable to create order' });
  }
});

// Shared activation logic used by BOTH /verify (immediate, from the browser) and the webhook
// (source of truth, works even if the browser tab closes before /verify fires). Idempotent —
// safe to call twice for the same payment.
async function activateSubscription({ shopId, plan, razorpayOrderId, razorpayPaymentId, amount }) {
  const already = await prisma.subscriptionPayment.findUnique({ where: { razorpayPaymentId } });
  if (already) return { alreadyProcessed: true, subscriptionEnd: null };

  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) throw new Error(`Shop ${shopId} not found during subscription activation`);

  const subscriptionEnd = extendedEnd(shop, plan);

  await prisma.$transaction([
    prisma.shop.update({
      where: { id: shopId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionPlan: plan,
        subscriptionEnd,
        pendingPlan: null,
        razorpayOrderId,
        razorpayPaymentId,
        subscriptionPaidAt: new Date(),
      },
    }),
    prisma.subscriptionPayment.create({
      data: { shopId, plan, amount, razorpayOrderId, razorpayPaymentId },
    }),
  ]);

  return { alreadyProcessed: false, subscriptionEnd };
}

// ── POST /api/payment/verify ──────────────────────────────────────────────
// Gives the browser immediate feedback right after Razorpay Checkout succeeds.
// The webhook below is the actual source of truth (fires server-to-server, works
// even if this call never reaches us), so this activates too, idempotently.
router.post('/verify', authMiddleware, requireVerifiedShop, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
    if (!PLAN_PRICE[plan]) return res.status(400).json({ error: 'Invalid plan' });

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (!safeEqual(expected, razorpay_signature)) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const { subscriptionEnd, alreadyProcessed } = await activateSubscription({
      shopId: req.shopId,
      plan,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      amount: PLAN_PRICE[plan],
    });

    if (alreadyProcessed) {
      const shop = await prisma.shop.findUnique({ where: { id: req.shopId } });
      return res.json({ success: true, message: 'Subscription already active', subscriptionEnd: shop.subscriptionEnd });
    }

    res.json({ success: true, message: 'Subscription activated', subscriptionEnd });
  } catch (err) {
    console.error('[payment] verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── POST /api/payment/webhook ──────────────────────────────────────────────
// Mounted directly on app (not this router) in index.js with express.raw(), BEFORE
// express.json() — same reason as the print-payment webhook: Razorpay signs the raw
// bytes, and express.json() would destroy the Buffer before we can verify it.
export async function subscriptionWebhookHandler(req, res) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!signature || !secret) return res.status(400).json({ error: 'Bad request' });

    if (!Buffer.isBuffer(req.body)) {
      console.error('[payment] webhook req.body is not a Buffer — middleware misconfigured');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    if (!safeEqual(signature, expected)) {
      console.warn('[payment] webhook signature mismatch — rejected');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(req.body.toString());
    if (event.event !== 'payment.captured') return res.status(200).json({ status: 'ignored' });

    const payment = event.payload.payment.entity;
    const { shopId, plan } = payment.notes || {};
    if (!shopId || !plan) {
      console.warn('[payment] webhook: payment missing shopId/plan notes, skipping', payment.id);
      return res.status(200).json({ status: 'missing_notes' });
    }

    const expectedPaise = (PLAN_PRICE[plan] || 0) * 100;
    if (payment.amount !== expectedPaise) {
      console.error(`[payment] webhook amount mismatch for shop ${shopId}: expected ${expectedPaise}, got ${payment.amount}`);
      return res.status(200).json({ status: 'amount_mismatch' });
    }

    const { alreadyProcessed } = await activateSubscription({
      shopId,
      plan,
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      amount: PLAN_PRICE[plan],
    });

    console.log(`[payment] webhook: shop ${shopId} → ${plan} ${alreadyProcessed ? '(already processed)' : 'ACTIVATED'}`);
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('[payment] webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// ── GET /api/payment/history ──────────────────────────────────────────────
router.get('/history', authMiddleware, async (req, res) => {
  const payments = await prisma.subscriptionPayment.findMany({
    where: { shopId: req.shopId },
    orderBy: { paidAt: 'desc' },
  });
  res.json(payments);
});

export default router;