import crypto from 'crypto';

// ENCRYPTION_KEY must be a 32-byte value, base64 or hex encoded, set only in server env.
// Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY is not set in environment');
  const key = raw.length === 44 ? Buffer.from(raw, 'base64') : Buffer.from(raw, 'hex');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes');
  return key;
}

// Encrypts a plaintext string. Output format: iv:authTag:ciphertext (all base64), stored as one string.
export function encryptSecret(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

// Decrypts a string produced by encryptSecret. Returns null if malformed or key rejects it.
export function decryptSecret(stored) {
  if (!stored) return null;
  try {
    const key = getKey();
    const [ivB64, tagB64, dataB64] = stored.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    return null; // key rotated, tampered, or malformed — never throw a raw secret into logs
  }
}

// Masks a Razorpay Key ID for safe display in the dashboard, e.g. rzp_live_••••••3F9k
export function maskKeyId(keyId) {
  if (!keyId || keyId.length < 8) return '••••••••';
  return keyId.slice(0, 8) + '••••••' + keyId.slice(-4);
}

// Deterministic hash for identity dedup (email/phone) — NOT reversible, and NOT for secrets
// you need to decrypt later. Same input always produces the same hash, so DeletedIdentity can
// look up "has this email/phone used a trial before" without ever storing the raw value again.
// Uses a SEPARATE secret (IDENTITY_HASH_SECRET) from ENCRYPTION_KEY — rotating this secret would
// silently let previously-deleted identities claim a new trial, so treat it as permanent.
export function hashIdentity(value) {
  if (!value) return null;
  const secret = process.env.IDENTITY_HASH_SECRET;
  if (!secret) throw new Error('IDENTITY_HASH_SECRET is not set in environment');
  return crypto.createHmac('sha256', secret).update(value.trim().toLowerCase()).digest('hex');
}