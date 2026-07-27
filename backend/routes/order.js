import prisma from '../utils/prisma.js';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { isFileSignatureValid } from '../utils/fileSignature.js';

import { v4 as uuidv4 } from 'uuid';
import { gateMiddleware } from '../middleware/auth.js';
import { getPageCount } from '../utils/pageCounter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();


const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.pdf','.doc','.docx','.jpg','.jpeg','.png'].includes(path.extname(file.originalname).toLowerCase());
    if (!ok) {
    return cb(new Error("Only PDF, DOC, DOCX, JPG, JPEG and PNG files are allowed."));
}

cb(null, true);
  }
});

// ── CUSTOMER ROUTES (no auth) ─────────────────────────────────────────────

// POST /api/order/upload/:shopId
// Supports single file OR multiple files in a queue session (back-to-back printing)
router.post('/upload/:shopId', upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: 'No files uploaded' });

  // multer's fileFilter only checked the filename — verify the actual bytes too.
  for (const f of req.files) {
    const ext = path.extname(f.originalname).toLowerCase();
    if (!isFileSignatureValid(f.path, ext)) {
      for (const rf of req.files) {
        try { fs.unlinkSync(rf.path); } catch {}
      }
      return res.status(400).json({ error: `"${f.originalname}" doesn't look like a valid ${ext.slice(1).toUpperCase()} file.` });
    }
  }

  const { shopId } = req.params;
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  let active = ['TRIAL','ACTIVE'].includes(shop.subscriptionStatus);
  if (active && shop.subscriptionEnd && new Date(shop.subscriptionEnd) < new Date()) active = false;
  if (!active) return res.status(403).json({ error: 'Service currently unavailable for this shop.' });
  if (!shop.isOpen) return res.status(409).json({ error: 'This print shop is currently closed.' });

  // Parse per-file options sent as JSON arrays or single values
  const printTypes  = Array.isArray(req.body.printType)  ? req.body.printType  : Array(req.files.length).fill(req.body.printType  || 'BW');
  const copiesArr   = Array.isArray(req.body.copies)     ? req.body.copies     : Array(req.files.length).fill(req.body.copies     || '1');
  const dblSidedArr = Array.isArray(req.body.doubleSided)? req.body.doubleSided: Array(req.files.length).fill(req.body.doubleSided || 'false');
  const pageRanges  = Array.isArray(req.body.pageRange)  ? req.body.pageRange  : Array(req.files.length).fill(req.body.pageRange  || 'all');
  const imagesPerPg = Array.isArray(req.body.imagesPerPage) ? req.body.imagesPerPage : Array(req.files.length).fill(req.body.imagesPerPage || '1');
  if (req.body.agreed !== 'true') {
    return res.status(400).json({ error: 'You must confirm you have the right to print these file(s) and accept the Terms & Privacy Policy.' });
  }
  const consentAt = new Date();
  let customerPhone = (req.body.customerPhone || '').trim();
  if (customerPhone) {
    if (!/^[6-9]\d{9}$/.test(customerPhone)) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }
  } else {
    customerPhone = null;
  }

  // Create a queue session ID if multiple files
  const queueSessionId = req.files.length > 1 ? uuidv4() : null;

  const isImageFile = (name) => ['.jpg','.jpeg','.png'].includes(path.extname(name).toLowerCase());

  // Images that share the same printType/copies/doubleSided/imagesPerPage get combined onto shared
  // pages (e.g. 4 photos on one sheet) instead of one page per image. Documents always stay separate.
  const docIdxs = [], imageIdxs = [];
  req.files.forEach((f, i) => (isImageFile(f.originalname) ? imageIdxs : docIdxs).push(i));

  const imageGroups = new Map();
  for (const i of imageIdxs) {
    let n = parseInt(imagesPerPg[i], 10);
    if (isNaN(n) || ![1,2,4,6].includes(n)) n = 1;
    const key = `${printTypes[i]}|${copiesArr[i]}|${dblSidedArr[i]}|${n}`;
    if (!imageGroups.has(key)) imageGroups.set(key, { n, idxs: [] });
    imageGroups.get(key).idxs.push(i);
  }

  let queuePos = 1;
  const orders = [];

  // Documents — unchanged, one order per file
  for (const i of docIdxs) {
    const file = req.files[i];
    const printType = printTypes[i] === 'COLOR' ? 'COLOR' : 'BW';

    let copies = parseInt(copiesArr[i], 10);
    if (isNaN(copies) || copies < 1) copies = 1;
    if (copies > 50) copies = 50;

    const doubleSided = dblSidedArr[i] === 'true';

    const pageRange = (pageRanges[i] || 'all').trim();
    if (pageRange !== 'all' && !/^(\d+(-\d+)?)(,\d+(-\d+)?)*$/.test(pageRange)) {
      return res.status(400).json({ error: `Invalid page range for ${file.originalname}` });
    }

    const pages = await getPageCount(file.path);
    const pricePerPage = printType === 'COLOR' ? shop.colorPrice : shop.bwPrice;
    const amount = pages * copies * pricePerPage;

    const order = await prisma.order.create({
      data: {
        shopId,
        fileName: file.originalname,
        fileUrl: `/uploads/${file.filename}`,
        filePath: file.path,
        pages,
        printType, copies, doubleSided,
        pageRange,
        amount, customerPhone,
        queueSessionId,
        queuePosition: queuePos++,
        consentAt,
        status: 'PENDING_PAYMENT'
      }
    });
    orders.push({ orderId: order.id, orderNumber: order.orderNumber, fileName: order.fileName, amount: order.amount, printType: order.printType, copies: order.copies, doubleSided: order.doubleSided, pageRange: order.pageRange, queuePosition: order.queuePosition });
  }

  // Images — combined into one order per group, billed by resulting page count, not photo count
  for (const [, group] of imageGroups) {
    const first = req.files[group.idxs[0]];
    const printType = printTypes[group.idxs[0]] === 'COLOR' ? 'COLOR' : 'BW';
    let copies = parseInt(copiesArr[group.idxs[0]], 10);
    if (isNaN(copies) || copies < 1) copies = 1;
    if (copies > 50) copies = 50;
    const doubleSided = dblSidedArr[group.idxs[0]] === 'true';

    const pages = Math.ceil(group.idxs.length / group.n);
    const pricePerPage = printType === 'COLOR' ? shop.colorPrice : shop.bwPrice;
    const amount = pages * copies * pricePerPage;

    const groupFiles = group.idxs.map(i => ({
      path: req.files[i].path,
      url: `/uploads/${req.files[i].filename}`,
      originalname: req.files[i].originalname
    }));

    const label = group.idxs.length > 1
      ? `${group.idxs.length} photos (${group.n}/page)`
      : first.originalname;

    const order = await prisma.order.create({
      data: {
        shopId,
        fileName: label,
        fileUrl: groupFiles[0].url,
        filePath: groupFiles[0].path,
        pages,
        printType, copies, doubleSided,
        pageRange: 'all',
        imagesPerPage: group.n,
        imageGroupFiles: JSON.stringify(groupFiles),
        amount, customerPhone,
        queueSessionId,
        queuePosition: queuePos++,
        consentAt,
        status: 'PENDING_PAYMENT'
      }
    });
    orders.push({ orderId: order.id, orderNumber: order.orderNumber, fileName: order.fileName, amount: order.amount, printType: order.printType, copies: order.copies, doubleSided: order.doubleSided, pageRange: order.pageRange, queuePosition: order.queuePosition });
  }

  orders.sort((a, b) => a.queuePosition - b.queuePosition);

  const totalAmount = orders.reduce((sum, o) => sum + o.amount, 0);

  res.json({
    orders,
    totalAmount,
    queueSessionId,
    shopName: shop.name,
    shopUpiId: shop.upiId || null,
    isQueue: orders.length > 1
  });
});

// GET /api/order/:id/status
router.get('/:id/status', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    select: { id:true, orderNumber:true, status:true, printType:true, copies:true, amount:true, fileName:true, queueSessionId:true, queuePosition:true }
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// GET /api/order/session/:sessionId/status — get all orders in a queue session
router.get('/session/:sessionId/status', async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { queueSessionId: req.params.sessionId },
    orderBy: { queuePosition: 'asc' },
    select: { id:true, orderNumber:true, status:true, printType:true, copies:true, amount:true, fileName:true, queuePosition:true }
  });
  res.json(orders);
});

// POST /api/order/claim-paid — claim payment for single order or entire session
router.post('/claim-paid', async (req, res) => {
  const { orderId, sessionId } = req.body;

  if (sessionId) {
    const anyOrder = await prisma.order.findFirst({ where: { queueSessionId: sessionId } });
    if (!anyOrder) return res.status(404).json({ error: 'Session not found' });
    const shop = await prisma.shop.findUnique({ where: { id: anyOrder.shopId } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    if (!shop.isOpen) return res.status(409).json({ error: 'This print shop is currently closed.' });

    // Mark all orders in session as AWAITING_CONFIRMATION
    await prisma.order.updateMany({
      where: { queueSessionId: sessionId, status: 'PENDING_PAYMENT' },
      data: { status: 'AWAITING_CONFIRMATION', customerClaimedPaidAt: new Date() }
    });
    return res.json({ success: true });
  }

  if (orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'PENDING_PAYMENT') return res.status(400).json({ error: 'Already claimed' });

    const shop = await prisma.shop.findUnique({ where: { id: order.shopId } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    if (!shop.isOpen) return res.status(409).json({ error: 'This print shop is currently closed.' });

    await prisma.order.update({ where: { id: orderId }, data: { status: 'AWAITING_CONFIRMATION', customerClaimedPaidAt: new Date() } });
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'orderId or sessionId required' });
});

// ── SHOPKEEPER ROUTES (gate) ──────────────────────────────────────────────

router.get('/shop/list', gateMiddleware, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { shopId: req.shopId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id:true, orderNumber:true, fileName:true, printType:true, copies:true, doubleSided:true, pageRange:true, amount:true, status:true, createdAt:true, printedAt:true, customerPhone:true, queueSessionId:true, queuePosition:true }
  });
  res.json(orders);
});

router.get('/shop/pending', gateMiddleware, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { shopId: req.shopId, status: 'AWAITING_CONFIRMATION' },
    orderBy: { customerClaimedPaidAt: 'asc' },
    select: { id:true, orderNumber:true, fileName:true, printType:true, copies:true, doubleSided:true, amount:true, customerPhone:true, customerClaimedPaidAt:true, queueSessionId:true, queuePosition:true }
  });
  res.json(orders);
});

router.post('/:id/confirm', gateMiddleware, async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: req.params.id, shopId: req.shopId } });
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.status !== 'AWAITING_CONFIRMATION') return res.status(400).json({ error: 'Not awaiting confirmation' });
  await prisma.order.update({ where: { id: req.params.id }, data: { status: 'PAID', confirmedAt: new Date() } });
  res.json({ success: true });
});

// Confirm all orders in a queue session at once
router.post('/session/:sessionId/confirm', gateMiddleware, async (req, res) => {
  await prisma.order.updateMany({
    where: { shopId: req.shopId, queueSessionId: req.params.sessionId, status: 'AWAITING_CONFIRMATION' },
    data: { status: 'PAID', confirmedAt: new Date() }
  });
  res.json({ success: true });
});

router.post('/:id/reject', gateMiddleware, async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: req.params.id, shopId: req.shopId } });
  if (!order) return res.status(404).json({ error: 'Not found' });
  await prisma.order.update({ where: { id: req.params.id }, data: { status: 'REJECTED' } });
  res.json({ success: true });
});

router.post('/session/:sessionId/reject', gateMiddleware, async (req, res) => {
  await prisma.order.updateMany({
    where: { shopId: req.shopId, queueSessionId: req.params.sessionId },
    data: { status: 'REJECTED' }
  });
  res.json({ success: true });
});

export default router;