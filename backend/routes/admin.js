import prisma from '../utils/prisma.js';
import express from 'express';
import { PLAN_DAYS } from '../utils/plans.js';
import { safeEqual } from '../utils/safeCompare.js';

const router = express.Router();
const isProd = process.env.NODE_ENV === 'production';
const ADMIN_COOKIE = 'admin_session';

// POST /api/admin/login — exchanges the admin key for an httpOnly session
// cookie, so the key no longer has to live in localStorage (readable by any
// script that ever runs on the page) or be resent as a header on every call.
router.post('/login', express.json(), (req, res) => {
  const { key } = req.body || {};
  if (!key || !safeEqual(key, process.env.ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Invalid admin key' });
  }
  res.cookie(ADMIN_COOKIE, process.env.ADMIN_PASSWORD, {
    httpOnly: true,
    secure: isProd,                     // requires HTTPS in production
    sameSite: isProd ? 'none' : 'lax',  // 'none' needed if frontend/backend are on different domains
    maxAge: 12 * 60 * 60 * 1000,        // 12 hours
  });
  res.json({ success: true });
});

router.post('/logout', (req, res) => {
  res.clearCookie(ADMIN_COOKIE);
  res.json({ success: true });
});

function adminAuth(req, res, next) {
  const key = req.cookies?.[ADMIN_COOKIE];
  if (!key || !safeEqual(key, process.env.ADMIN_PASSWORD))
    return res.status(401).json({ error: 'Invalid admin key' });
  next();
}

router.get('/announcement', adminAuth, async (req, res) => {
  const a = await prisma.announcement.findUnique({ where: { id: 'singleton' } });
  res.json({ message: a?.message || '', updatedAt: a?.updatedAt || null });
});

router.post('/announcement', adminAuth, express.json(), async (req, res) => {
  const { message } = req.body || {};
  const a = await prisma.announcement.upsert({
    where: { id: 'singleton' },
    update: { message: message || null },
    create: { id: 'singleton', message: message || null },
  });
  res.json({ success: true, message: a.message, updatedAt: a.updatedAt });
});

router.get('/shops', adminAuth, async (req, res) => {
  const shops = await prisma.shop.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id:true, name:true, ownerName:true, email:true, phone:true, upiId:true, emailVerified:true, whatsappJoined:true, subscriptionPlan:true, subscriptionStatus:true, subscriptionEnd:true, pendingPlan:true, isOpen:true, createdAt:true, _count:{ select:{ orders:true } } }
  });
  res.json(shops);
});

router.post('/shops/:id/approve', adminAuth, async (req, res) => {
  const shop = await prisma.shop.findUnique({ where: { id: req.params.id } });
  if (!shop) return res.status(404).json({ error: 'Not found' });

  if (shop.pendingPlan) {
    // Upgrade approved while the shop's current trial/subscription was still running —
    // extend from whichever end date is later, don't restart from today and don't
    // discard time they already paid/were trialing for.
    const days = PLAN_DAYS[shop.pendingPlan] || 30;
    const base = shop.subscriptionEnd && new Date(shop.subscriptionEnd) > new Date() ? new Date(shop.subscriptionEnd) : new Date();
    const subscriptionEnd = new Date(base.getTime() + days * 86400000);
    await prisma.shop.update({
      where: { id: req.params.id },
      data: { subscriptionPlan: shop.pendingPlan, subscriptionStatus: 'ACTIVE', subscriptionEnd, pendingPlan: null }
    });
    return res.json({ success: true, subscriptionEnd });
  }

  // Original path: brand-new signup or renewal after expiry (status is PENDING_PAYMENT)
  const days = PLAN_DAYS[shop.subscriptionPlan] || 30;
  const subscriptionEnd = new Date(Date.now() + days * 86400000);
  await prisma.shop.update({ where: { id: req.params.id }, data: { subscriptionStatus:'ACTIVE', subscriptionEnd } });
  res.json({ success: true, subscriptionEnd });
});

router.post('/shops/:id/extend', adminAuth, async (req, res) => {
  const { days } = req.body;
  const shop = await prisma.shop.findUnique({ where: { id: req.params.id } });
  if (!shop) return res.status(404).json({ error: 'Not found' });
  const base = shop.subscriptionEnd && new Date(shop.subscriptionEnd) > new Date() ? new Date(shop.subscriptionEnd) : new Date();
  const subscriptionEnd = new Date(base.getTime() + (parseInt(days)||30) * 86400000);
  await prisma.shop.update({ where: { id: req.params.id }, data: { subscriptionStatus:'ACTIVE', subscriptionEnd } });
  res.json({ success: true, subscriptionEnd });
});

router.post('/shops/:id/suspend', adminAuth, async (req, res) => {
  await prisma.shop.update({ where: { id: req.params.id }, data: { subscriptionStatus:'EXPIRED' } });
  res.json({ success: true });
});

router.post('/shops/:id/verify-email', adminAuth, async (req, res) => {
  await prisma.shop.update({ where: { id: req.params.id }, data: { emailVerified:true, otpCode:null } });
  res.json({ success: true });
});

export default router;