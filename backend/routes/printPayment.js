import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import prisma from '../utils/prisma.js';
import { gateMiddleware } from '../middleware/auth.js';
import { decryptSecret } from '../utils/crypto.js';
import { safeEqual } from '../utils/safeCompare.js';

const router = express.Router();

// PrintDrop has no platform Razorpay account for print money — every shop pays through
// its OWN connected Razorpay account, so the money lands directly with the shopkeeper.
// This helper builds a Razorpay client from that shop's decrypted credentials.
function razorpayClientForShop(shop) {
  if (!shop.razorpayConnected || !shop.razorpayKeyId || !shop.razorpayKeySecretEnc) return null;
  const keySecret = decryptSecret(shop.razorpayKeySecretEnc);
  if (!keySecret) return null;
  return new Razorpay({ key_id: shop.razorpayKeyId, key_secret: keySecret });
}

// ── POST /api/print-payment/create-order ─────────────────────────────────
// Customer taps "Pay Online". Frontend sends { orderId } only.
// Amount is always read from DB — never trusted from frontend.
// Payment is created against the SHOP's own Razorpay account, not PrintDrop's.
router.post('/create-order', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order)                              return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'PENDING_PAYMENT')  return res.status(400).json({ error: 'Order not in PENDING_PAYMENT state' });

    const shop = await prisma.shop.findUnique({ where: { id: order.shopId } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    if (!shop.isOpen) return res.status(409).json({ error: 'This print shop is currently closed.' });

    const razorpay = razorpayClientForShop(shop);
    if (!razorpay) {
      // Shop hasn't connected Razorpay yet — frontend should fall back to the UPI deep-link + "I've Paid" flow.
      return res.status(400).json({ error: 'RAZORPAY_NOT_CONNECTED', message: 'This shop hasn\'t enabled online payment yet. Use the UPI option instead.' });
    }

    // Amount in paise (Razorpay requires integer paise)
    const amountPaise = Math.round(order.amount * 100);
    if (amountPaise < 100) return res.status(400).json({ error: 'Amount too low (minimum ₹1)' });

    // Idempotency: a double-click or page refresh calling this again before the first payment
    // completes must NOT create a second Razorpay order — that would overwrite the stored
    // razorpayOrderId, and if the customer then pays via the FIRST checkout, the webhook would
    // never find a matching order (money captured, order never marked PAID). Reuse instead.
    if (order.razorpayOrderId) {
      return res.json({
        key: shop.razorpayKeyId,
        razorpayOrderId: order.razorpayOrderId,
        amount: order.amount,
        amountPaise,
        currency: 'INR',
        orderId,
      });
    }

    const rzpOrder = await razorpay.orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt:  `PD${Date.now()}`,
      notes:    {
        orderId,
        shopId:    order.shopId,
        printType: order.printType,
        copies:    String(order.copies),
      },
    });

    // Save razorpayOrderId on the print order for reconciliation
    await prisma.order.update({
      where: { id: orderId },
      data:  { razorpayOrderId: rzpOrder.id },
    });

    res.json({
      key:          shop.razorpayKeyId,   // the SHOP's public key id, used by frontend checkout
      razorpayOrderId: rzpOrder.id,
      amount:       order.amount,        // in ₹ for display
      amountPaise,                       // in paise for Razorpay SDK
      currency:     'INR',
      orderId,
    });
  } catch (err) {
    console.error('[print-payment] create-order error:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// ── POST /api/print-payment/create-session-order ─────────────────────────
// Same as create-order, but for a whole queue session (multiple files paid
// together in ONE Razorpay checkout). razorpayOrderId is stored on the first
// order in the session; the webhook/verify handlers below resolve that back
// to every order in the session before marking them PAID.
router.post('/create-session-order', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    const orders = await prisma.order.findMany({
      where: { queueSessionId: sessionId, status: 'PENDING_PAYMENT' },
      orderBy: { queuePosition: 'asc' }
    });
    if (!orders.length) return res.status(404).json({ error: 'No payable orders found for this session' });

    const shop = await prisma.shop.findUnique({ where: { id: orders[0].shopId } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    if (!shop.isOpen) return res.status(409).json({ error: 'This print shop is currently closed.' });

    const razorpay = razorpayClientForShop(shop);
    if (!razorpay) {
      return res.status(400).json({ error: 'RAZORPAY_NOT_CONNECTED', message: 'This shop hasn\'t enabled online payment yet. Use the UPI option instead.' });
    }

    const totalAmount = orders.reduce((sum, o) => sum + o.amount, 0);
    const amountPaise = Math.round(totalAmount * 100);
    if (amountPaise < 100) return res.status(400).json({ error: 'Amount too low (minimum ₹1)' });

    // Same idempotency guard as create-order — a second click before the first payment
    // completes must reuse the existing Razorpay order, not overwrite it.
    if (orders[0].razorpayOrderId) {
      return res.json({
        key: shop.razorpayKeyId,
        razorpayOrderId: orders[0].razorpayOrderId,
        amount: totalAmount,
        amountPaise,
        currency: 'INR',
        sessionId,
        anchorOrderId: orders[0].id,
      });
    }

    const rzpOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `PD${Date.now()}`,
      notes: { sessionId, shopId: orders[0].shopId, fileCount: String(orders.length) },
    });

    // Stored only on the first order — webhook/verify expand it to the whole session
    await prisma.order.update({ where: { id: orders[0].id }, data: { razorpayOrderId: rzpOrder.id } });

    res.json({
      key: shop.razorpayKeyId,
      razorpayOrderId: rzpOrder.id,
      amount: totalAmount,
      amountPaise,
      currency: 'INR',
      sessionId,
      anchorOrderId: orders[0].id,
    });
  } catch (err) {
    console.error('[print-payment] create-session-order error:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});
// Mounted directly on app (not router) in index.js with express.raw()
// so req.body is always a raw Buffer — required for HMAC signature check.
//
// Each shop has its OWN Razorpay account and therefore its OWN webhook secret
// (set in their Razorpay Dashboard > Webhooks, pointing at this same shared URL).
// We can't know which secret to use until we see which order the event refers to,
// so we look up the order (and its shop's secret) BEFORE trusting anything — the
// signature check still happens before any state changes, so this stays safe.
export async function printWebhookHandler(req, res) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      console.warn('[print-payment] Missing signature header');
      return res.status(400).json({ error: 'Bad request' });
    }

    // req.body MUST be a Buffer here — express.raw() is set in index.js
    if (!Buffer.isBuffer(req.body)) {
      console.error('[print-payment] req.body is not a Buffer — middleware misconfigured');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    let event;
    try { event = JSON.parse(req.body.toString()); }
    catch { return res.status(400).json({ error: 'Invalid JSON' }); }

    if (event.event !== 'payment.captured') {
      return res.status(200).json({ status: 'ignored' });
    }

    const payment    = event.payload.payment.entity;
    const rzpOrderId = payment.order_id;

    const order = await prisma.order.findFirst({ where: { razorpayOrderId: rzpOrderId } });
    if (!order) {
      console.warn('[print-payment] Webhook: no order found for', rzpOrderId);
      return res.status(200).json({ status: 'order_not_found' });
    }

    const shop = await prisma.shop.findUnique({ where: { id: order.shopId } });
    const webhookSecret = shop && decryptSecret(shop.razorpayWebhookSecretEnc);
    if (!webhookSecret) {
      console.error('[print-payment] No webhook secret on file for shop', order.shopId);
      return res.status(400).json({ error: 'Shop not configured for webhooks' });
    }

    const expected = crypto.createHmac('sha256', webhookSecret).update(req.body).digest('hex');
    if (!safeEqual(signature, expected)) {
      console.warn('[print-payment] Webhook signature mismatch for shop', order.shopId, '— rejected');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    if (['PAID','PRINTING','PRINTED'].includes(order.status)) {
      return res.status(200).json({ status: 'already_paid' });
    }

    // If this order belongs to a queue session, the amount charged was the SESSION total
    // (see create-session-order) — expand payment to every pending order in that session.
    const siblingOrders = order.queueSessionId
      ? await prisma.order.findMany({ where: { queueSessionId: order.queueSessionId, status: 'PENDING_PAYMENT' } })
      : [order];

    const expectedPaise = Math.round(siblingOrders.reduce((sum, o) => sum + o.amount, 0) * 100);
    if (payment.amount !== expectedPaise) {
      console.error(`[print-payment] Amount mismatch: expected ${expectedPaise}, got ${payment.amount}`);
      return res.status(200).json({ status: 'amount_mismatch' });
    }

    await prisma.order.updateMany({
      where: { id: { in: siblingOrders.map(o => o.id) } },
      data: {
        status:         'PAID',
        paymentMethod:  payment.method,
        paymentGateway: 'RAZORPAY',
        paidAt:         new Date(),
      },
    });
    // razorpayPaymentId has a unique constraint — can only live on the one order that actually holds the rzp order id
    await prisma.order.update({ where: { id: order.id }, data: { razorpayPaymentId: payment.id } });

    console.log(`[print-payment] ${siblingOrders.length} order(s) → PAID via ${payment.method}`);
    res.status(200).json({ status: 'ok' });

  } catch (err) {
    console.error('[print-payment] Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// ── POST /api/print-payment/verify ───────────────────────────────────────
// Optional: client-side verification after Razorpay handler() fires.
// Webhook is the source of truth — this just gives the customer immediate feedback.
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const shop = await prisma.shop.findUnique({ where: { id: order.shopId } });
    const keySecret = shop && decryptSecret(shop.razorpayKeySecretEnc);
    if (!keySecret) return res.status(400).json({ error: 'Shop payment not configured' });

    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (!safeEqual(razorpay_signature, expected)) {
      return res.status(400).json({ error: 'Signature verification failed' });
    }

    // Webhook is the source of truth — this just gives the customer immediate feedback.
    res.json({
      success: true,
      status:  order.status,
      message: order.status === 'PAID'
        ? 'Payment confirmed. Your document will print shortly.'
        : 'Payment received — processing.',
    });
  } catch (err) {
    console.error('[print-payment] verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── GET /api/print-payment/status/:orderId ───────────────────────────────
// Frontend polls this after payment to show customer the print status.
router.get('/status/:orderId', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where:  { id: req.params.orderId },
      select: { id: true, status: true, amount: true, fileName: true, paidAt: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

export default router;