import { timingSafeEqual } from 'crypto';

// Constant-time string compare — use for HMAC signatures and secret keys so
// comparison time can't leak information about how many leading bytes matched.
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}