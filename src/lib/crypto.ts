import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const DEVELOPMENT_KEY = 'dev-secret-key-must-be-32-bytes-long!';

// Ensure key is 32 bytes
const getKey = (keyMaterial?: string) => {
  const configured = keyMaterial || process.env.TOKEN_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error('Legacy token encryption is not configured');
  }
  const key = Buffer.from(configured || DEVELOPMENT_KEY);
  if (key.length === 32) return key;
  // Pad or slice
  const newKey = Buffer.alloc(32);
  key.copy(newKey);
  return newKey;
};

export const encrypt = (text: string, keyMaterial?: string): string => {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(keyMaterial), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

export const decrypt = (text: string, keyMaterial?: string): string => {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, getKey(keyMaterial), iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};
