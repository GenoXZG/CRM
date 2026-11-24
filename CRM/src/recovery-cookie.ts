import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { readCookie } from './auth-cookies';

const key = randomBytes(32);
const legacyFormat = /^[a-f0-9]{64}$/;
const sealedFormat = /^[a-f0-9]{120}$/;

export function recoveryCookieValue(request: Request): string | null {
  const value = readCookie(request, 'crm_recovery');
  return value && (legacyFormat.test(value) || sealedFormat.test(value)) ? value : null;
}

// Fresh ciphertext on every response hides whether a cooldown reused a token.
export function sealRecoveryToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(token, 'hex')), cipher.final()]);
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString('hex');
}

export function openRecoveryToken(request: Request): string | null {
  const value = recoveryCookieValue(request);
  if (!value || legacyFormat.test(value)) return value;
  const bytes = Buffer.from(value, 'hex');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(44));
    return Buffer.concat([decipher.update(bytes.subarray(12, 44)), decipher.final()]).toString('hex');
  } catch {
    return null;
  }
}
