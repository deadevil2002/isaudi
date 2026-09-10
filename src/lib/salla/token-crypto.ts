import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { decrypt as decryptLegacyToken } from '@/lib/crypto';
import { getRuntimeString } from '@/lib/runtime/environment';

const PREFIX = 'salla:v1';

export class SallaTokenCryptoConfigurationError extends Error {
  constructor() {
    super('Salla token encryption is not configured');
    this.name = 'SallaTokenCryptoConfigurationError';
  }
}

function deriveKey(keyMaterial: string | undefined): Buffer {
  if (!keyMaterial || !keyMaterial.trim()) {
    throw new SallaTokenCryptoConfigurationError();
  }
  return createHash('sha256')
    .update('isaudi:salla-token:v1\0')
    .update(keyMaterial, 'utf8')
    .digest();
}

export function createSallaTokenCipher(keyMaterial: string | undefined) {
  const key = deriveKey(keyMaterial);
  return {
    encrypt(plaintext: string): string {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);
      return [
        PREFIX,
        iv.toString('base64url'),
        ciphertext.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
      ].join(':');
    },
    decrypt(ciphertext: string): string {
      if (!ciphertext.startsWith(`${PREFIX}:`)) {
        return decryptLegacyToken(ciphertext);
      }
      const parts = ciphertext.split(':');
      if (parts.length !== 5) throw new Error('Invalid Salla token ciphertext');
      const iv = Buffer.from(parts[2], 'base64url');
      const encrypted = Buffer.from(parts[3], 'base64url');
      const tag = Buffer.from(parts[4], 'base64url');
      if (iv.length !== 12 || tag.length !== 16) {
        throw new Error('Invalid Salla token ciphertext');
      }
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');
    },
  };
}

export function encryptSallaToken(plaintext: string): string {
  return createSallaTokenCipher(
    getRuntimeString('TOKEN_ENCRYPTION_KEY')
  ).encrypt(plaintext);
}

export function decryptSallaToken(ciphertext: string): string {
  return createSallaTokenCipher(
    getRuntimeString('TOKEN_ENCRYPTION_KEY')
  ).decrypt(ciphertext);
}