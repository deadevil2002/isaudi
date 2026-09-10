import { createHash, randomBytes, randomUUID } from 'crypto';

export const SALLA_LINK_CODE_TTL_MS = 10 * 60 * 1000;

const LINK_CODE_DOMAIN = 'isaudi:salla-link-code:v1';
const NORMALIZED_CODE_PATTERN = /^[A-F0-9]{32}$/;

export function normalizeSallaLinkCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/[\s-]+/g, '').toUpperCase();
  return NORMALIZED_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function hashSallaLinkCode(value: unknown): string | null {
  const normalized = normalizeSallaLinkCode(value);
  if (!normalized) return null;
  return createHash('sha256')
    .update(`${LINK_CODE_DOMAIN}\0${normalized}`, 'utf8')
    .digest('hex');
}

export function generateSallaLinkCode(now = Date.now()) {
  const normalized = randomBytes(16).toString('hex').toUpperCase();
  const code = normalized.match(/.{1,4}/g)?.join('-') ?? normalized;
  const codeHash = hashSallaLinkCode(code);
  if (!codeHash) throw new Error('Failed to generate Salla linking code');
  return {
    id: randomUUID(),
    code,
    codeHash,
    createdAt: now,
    expiresAt: now + SALLA_LINK_CODE_TTL_MS,
  };
}