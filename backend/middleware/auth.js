import prisma from '../utils/prisma.js';
import jwt from 'jsonwebtoken';

// Basic auth — verifies JWT AND that the account hasn't been deleted / token hasn't been revoked.
// This now does one DB read (it didn't before) — necessary so account deletion or password reset
// actually invalidates outstanding tokens instead of just hiding data behind a scrambled email.
export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  let decoded;
  try { decoded = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }

  const shop = await prisma.shop.findUnique({ where: { id: decoded.shopId } });
  if (!shop) return res.status(401).json({ error: 'Account not found' });
  if (shop.accountDeletedAt) return res.status(401).json({ error: 'Account deleted' });
  if ((decoded.tv ?? 0) !== shop.tokenVersion) return res.status(401).json({ error: 'Session expired. Please log in again.' });

  req.shopId = shop.id;
  next();
}

// Full gate — email verified + whatsapp joined + subscription active
export async function gateMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  let decoded;
  try { decoded = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }

  const shop = await prisma.shop.findUnique({ where: { id: decoded.shopId } });
  if (!shop) return res.status(401).json({ error: 'Account not found' });
  if (shop.accountDeletedAt) return res.status(401).json({ error: 'Account deleted' });
  if ((decoded.tv ?? 0) !== shop.tokenVersion) return res.status(401).json({ error: 'Session expired. Please log in again.' });

  if (!shop.emailVerified)
    return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED', step: 'verify-email' });
  if (shop.subscriptionStatus === 'NONE')
    return res.status(403).json({ error: 'NO_PLAN', step: 'select-plan' });
  if (!shop.whatsappJoined)
    return res.status(403).json({ error: 'WHATSAPP_NOT_JOINED', step: 'join-whatsapp' });
  if (shop.subscriptionStatus === 'PENDING_PAYMENT')
    return res.status(403).json({ error: 'PAYMENT_PENDING', step: 'pending-approval' });

  if (shop.subscriptionEnd && new Date(shop.subscriptionEnd) < new Date()) {
    await prisma.shop.update({ where: { id: shop.id }, data: { subscriptionStatus: 'EXPIRED' } });
    return res.status(403).json({ error: 'SUBSCRIPTION_EXPIRED', step: 'subscription-expired' });
  }

  req.shopId = shop.id;
  req.shop = shop;
  next();
}