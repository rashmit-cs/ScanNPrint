import prisma from './prisma.js';

// Fire-and-forget audit logging — never let a logging failure break the
// request it's logging. Errors are swallowed and just printed to console.
export async function logEvent(event, shopId = null, detail = null) {
  try {
    await prisma.auditLog.create({
      data: { event, shopId, detail }
    });
  } catch (e) {
    console.error('logEvent failed:', event, e.message);
  }
}