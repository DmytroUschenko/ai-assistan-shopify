import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = 'enc:';

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a tagged string: `enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
 *
 * @param plaintext - The value to encrypt.
 * @param key - 32-byte hex-encoded encryption key.
 */
export function encrypt(plaintext: string, key: string): string {
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex characters)');
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts a value produced by `encrypt()`.
 *
 * @param encoded - The tagged encrypted string (`enc:<iv>:<authTag>:<ciphertext>`).
 * @param key - 32-byte hex-encoded encryption key.
 */
export function decrypt(encoded: string, key: string): string {
  if (!isEncryptedValue(encoded)) {
    throw new Error('Value is not an encrypted string');
  }
  const parts = encoded.slice(ENCRYPTED_PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted value');
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const keyBuffer = Buffer.from(key, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Returns true if the value is a tagged encrypted string produced by `encrypt()`.
 */
export function isEncryptedValue(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}
