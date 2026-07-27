import prisma from '../utils/prisma.js';
import express from 'express';
import bcrypt from 'bcryptjs';


const router = express.Router();


async function agentAuth(req, res, next) {
  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!auth) return res.status(401).json({ error: 'No token' });
  const [secret, shopId] = auth.split(':');
  if (!secret || !shopId) return res.status(401).json({ error: 'Bad format' });
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) return res.status(401).json({ error: 'Unauthorized' });

  let valid = false;

  if (shop.agentSecretHash) {
    valid = await bcrypt.compare(secret, shop.agentSecretHash);
  } else if (shop.agentSecret && shop.agentSecret === secret) {
    // Zero-downtime migration: this shop's PC agent was set up before secrets were hashed.
    // Its config.env still has the old plaintext value — accept it this one time, then hash
    // it and wipe the plaintext column so it's never relied on again. No manual step needed;
    // this fires automatically on the agent's next successful poll.
    valid = true;
    const agentSecretHash = await bcrypt.hash(secret, 10);
    await prisma.shop.update({ where: { id: shop.id }, data: { agentSecretHash, agentSecret: null } });
  }

  if (!valid) return res.status(401).json({ error: 'Unauthorized' });

  let active = ['TRIAL','ACTIVE'].includes(shop.subscriptionStatus);
  if (active && shop.subscriptionEnd && new Date(shop.subscriptionEnd) < new Date()) active = false;
  if (!active) return res.status(403).json({ error: 'Subscription inactive' });

  req.shopId = shopId;
  next();
}

router.post('/register-printers', agentAuth, async (req, res) => {
  const { printers } = req.body;
  if (!Array.isArray(printers)) return res.status(400).json({ error: 'Array required' });
  for (const name of printers) {
    const ex = await prisma.printer.findFirst({ where: { shopId: req.shopId, name } });
    if (ex) await prisma.printer.update({ where: { id: ex.id }, data: { isOnline: true, lastSeen: new Date() } });
    else await prisma.printer.create({ data: { shopId: req.shopId, name, type: 'BOTH', isOnline: true } });
  }
  await prisma.printer.updateMany({ where: { shopId: req.shopId, name: { notIn: printers } }, data: { isOnline: false } });
  res.json({ success: true });
});

// GET /api/agent/jobs — returns PAID orders with printer name + print options
router.get('/jobs', agentAuth, async (req, res) => {
  const jobs = await prisma.order.findMany({
    where: { shopId: req.shopId, status: 'PAID' },
    orderBy: [{ queueSessionId: 'asc' }, { queuePosition: 'asc' }],
    select: { id:true, fileName:true, fileUrl:true, filePath:true, printType:true, copies:true, doubleSided:true, pageRange:true, queueSessionId:true, queuePosition:true, imagesPerPage:true, imageGroupFiles:true }
  });
  if (!jobs.length) return res.json([]);

  const printers = await prisma.printer.findMany({ where: { shopId: req.shopId, isOnline: true } });
  const findPrinter = type =>
    printers.find(p => p.isDefault && (p.type === type || p.type === 'BOTH'))
    || printers.find(p => p.type === type || p.type === 'BOTH')
    || null;

  const enriched = jobs.map(j => ({ ...j, printerName: findPrinter(j.printType)?.name || 'default' }));
  await prisma.order.updateMany({ where: { id: { in: jobs.map(j => j.id) } }, data: { status: 'PRINTING' } });
  res.json(enriched);
});

router.post('/done/:orderId', agentAuth, async (req, res) => {
  const { pages } = req.body;
  const order = await prisma.order.findFirst({ where: { id: req.params.orderId, shopId: req.shopId } });
  if (!order) return res.status(404).json({ error: 'Not found' });
  const shop = await prisma.shop.findUnique({ where: { id: req.shopId } });
  const price = order.printType === 'COLOR' ? shop.colorPrice : shop.bwPrice;
  const finalAmount = pages ? price * pages * order.copies : order.amount;
  await prisma.order.update({ where: { id: req.params.orderId }, data: { status:'PRINTED', printedAt:new Date(), ...(pages&&{pages, amount:finalAmount}) } });
  res.json({ success: true });
});

router.post('/failed/:orderId', agentAuth, async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: req.params.orderId, shopId: req.shopId } });
  if (!order) return res.status(404).json({ error: 'Not found' });
  await prisma.order.update({ where: { id: req.params.orderId }, data: { status: 'FAILED' } });
  res.json({ success: true });
});

export default router;
