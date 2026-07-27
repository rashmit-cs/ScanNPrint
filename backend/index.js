import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from './utils/prisma.js';

import authRoutes  from './routes/auth.js';
import shopRoutes  from './routes/shop.js';
import orderRoutes from './routes/order.js';
import agentRoutes from './routes/agent.js';
import adminRoutes from './routes/admin.js';
import paymentRoutes, { subscriptionWebhookHandler } from './routes/payment.js';
import printPaymentRoutes, { printWebhookHandler } from './routes/printPayment.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Safety net: in Express 4, an async route handler that throws produces an unhandled
// promise rejection, which Node terminates the whole process for by default. Without
// this, one bad request from any shop or customer could crash the server for everyone.
// This doesn't fix the underlying handler, but it keeps the process alive and logs it
// instead of taking down every shop's connection.
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});


// Sets standard hardening headers (no-sniff, no X-Frame, etc). crossOriginResourcePolicy
// relaxed so /uploads (customer files fetched by <img>/<a> tags on the frontend) still loads.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Restrict to known frontend origin(s) instead of '*'. Falls back to '*' only if you haven't
// set ALLOWED_ORIGINS yet, so this can't silently lock you out during setup — set it before
// going live. Comma-separate multiple origins, e.g. "https://app.printdrop.in,https://printdrop.in"
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length
    ? (origin, cb) => (!origin || allowedOrigins.includes(origin)) ? cb(null, true) : cb(new Error('Not allowed by CORS'))
    : true, // reflects the request's Origin — '*' can't be used once credentials:true is set
  credentials: true, // required so the browser will send/accept the admin session cookie
}));
app.use(cookieParser());

// !! Webhooks MUST be mounted directly on app with express.raw() BEFORE express.json() !!
// Razorpay signs the raw request body bytes. express.json() destroys the Buffer.
// Using a router for this doesn't work reliably — mount it here directly.
app.post('/api/print-payment/webhook',
  express.raw({ type: 'application/json' }),
  printWebhookHandler
);
app.post('/api/payment/webhook',
  express.raw({ type: 'application/json' }),
  subscriptionWebhookHandler
);

app.use(express.json({ limit: '25mb' })); // covers JSON payloads; file uploads use multer separately with their own 20MB cap
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limits on the endpoints most worth protecting: credential guessing (login, reset),
// account creation spam (signup), and anything that costs money or storage per request
// (upload, subscription/print payment creation). PC agent polling and webhooks are left
// unlimited here — they're authenticated by secret/signature, not by being rare, and an
// aggressive limit on a 5-second poll loop would break real shops rather than stop abuse.
const authLimiter    = rateLimit({ windowMs: 15*60*1000, max: 20,  standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again in a few minutes.' } });
const uploadLimiter  = rateLimit({ windowMs: 15*60*1000, max: 40,  standardHeaders: true, legacyHeaders: false, message: { error: 'Too many uploads. Try again in a few minutes.' } });
const paymentLimiter = rateLimit({ windowMs: 15*60*1000, max: 30,  standardHeaders: true, legacyHeaders: false, message: { error: 'Too many payment attempts. Try again in a few minutes.' } });

app.use('/api/auth/login',            authLimiter);
app.use('/api/auth/signup',           authLimiter);
app.use('/api/auth/verify-otp',       authLimiter);
app.use('/api/auth/resend-otp',       authLimiter);
app.use('/api/auth/forgot-password',  authLimiter);
app.use('/api/auth/reset-password',   authLimiter);
app.use('/api/shop/delete-account',   authLimiter);
app.use('/api/order/upload',          uploadLimiter);
app.use('/api/payment/create-order',  paymentLimiter);
app.use('/api/payment/verify',        paymentLimiter);
app.use('/api/print-payment/create-order',         paymentLimiter);
app.use('/api/print-payment/create-session-order', paymentLimiter);

// Admin panel auth is a single shared key (x-admin-key header) — rate limit it same as login,
// since it's the highest-value target on the whole platform if that key is ever weak or leaked.
app.use('/api/admin', authLimiter);

app.use('/api/auth',          authRoutes);
app.use('/api/shop',          shopRoutes);
app.use('/api/order',         orderRoutes);
app.use('/api/agent',         agentRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/payment',       paymentRoutes);
app.use('/api/print-payment', printPaymentRoutes);

app.get('/', (req, res) => res.json({ status: 'PrintDrop API running 🚀' }));

// ── CRON: File cleanup every 10 min ──────────────────────────────────────────
cron.schedule('*/10 * * * *', async () => {
  const now = new Date();
  const thirtyMin = new Date(now - 30*60*1000);
  const twoHours  = new Date(now - 2*60*60*1000);
  try {
    const printed = await prisma.order.findMany({ where: { status:'PRINTED', deletedAt:null, printedAt:{ lte:thirtyMin } } });
    const old     = await prisma.order.findMany({ where: { deletedAt:null, createdAt:{ lte:twoHours } } });
    const toDelete = [...new Map([...printed,...old].map(o=>[o.id,o])).values()];
    for (const o of toDelete) {
      if (o.filePath && fs.existsSync(o.filePath)) fs.unlinkSync(o.filePath);
      await prisma.order.update({ where:{ id:o.id }, data:{ deletedAt:now } });
    }
    if (toDelete.length) console.log(`[CRON] Deleted ${toDelete.length} file(s)`);
  } catch(e) { console.error('[CRON cleanup]', e.message); }
});

// ── CRON: Subscription expiry every hour ──────────────────────────────────────
cron.schedule('0 * * * *', async () => {
  try {
    const r = await prisma.shop.updateMany({
      where: { subscriptionStatus:{ in:['TRIAL','ACTIVE'] }, subscriptionEnd:{ lt:new Date() } },
      data: { subscriptionStatus:'EXPIRED' }
    });
    if (r.count) console.log(`[CRON] Expired ${r.count} subscription(s)`);
  } catch(e) { console.error('[CRON expiry]', e.message); }
});

// If a PC agent crashes, loses network, or the shop's PC reboots mid-job, the order is left
// in PRINTING forever — /api/agent/jobs only ever fetches status:'PAID', so a stuck PRINTING
// order becomes invisible and never retried. This puts it back in the queue automatically
// after a few minutes so the agent's next poll picks it up again once it reconnects.
cron.schedule('*/5 * * * *', async () => {
  try {
    const stuckSince = new Date(Date.now() - 10*60*1000);
    const r = await prisma.order.updateMany({
      where: { status: 'PRINTING', updatedAt: { lte: stuckSince } },
      data: { status: 'PAID' }
    });
    if (r.count) console.log(`[CRON] Requeued ${r.count} stuck PRINTING order(s)`);
  } catch(e) { console.error('[CRON requeue]', e.message); }
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  console.log(`PrintDrop backend on port ${PORT} 🚀`);
  // Test DB connection immediately on startup
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (e) {
    console.error('❌ Database connection FAILED:', e.message);
    console.error('Check DATABASE_URL in .env — must use port 6543 (Transaction Pooler)');
  }
});