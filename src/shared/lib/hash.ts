import { SnowflakeIdv1 } from 'simple-flakeid';
import { v4 as uuidv4 } from 'uuid';

const NONCE_CHARACTERS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function getUuid(): string {
  return uuidv4();
}

export function getUniSeq(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);

  return `${prefix}${randomPart}${timestamp}`;
}

export function getNonceStr(length: number): string {
  const normalizedLength = Math.max(0, Math.floor(length));
  if (normalizedLength === 0) return '';

  const crypto = globalThis.crypto;
  if (!crypto || typeof crypto.getRandomValues !== 'function') {
    throw new Error('secure random is not available');
  }

  const charactersLength = NONCE_CHARACTERS.length;
  const maxUnbiased = 256 - (256 % charactersLength);

  const out: string[] = [];

  while (out.length < normalizedLength) {
    const remaining = normalizedLength - out.length;
    const bytes = new Uint8Array(Math.max(1, remaining * 2));
    crypto.getRandomValues(bytes);

    for (const byte of bytes) {
      if (byte >= maxUnbiased) continue;
      out.push(NONCE_CHARACTERS[byte % charactersLength]!);
      if (out.length >= normalizedLength) break;
    }
  }

  return out.join('');
}

/**
 * get snow id
 */
export function getSnowId(): string {
  const workerId = Math.floor(Math.random() * 1024);
  const gen = new SnowflakeIdv1({ workerId });
  const snowId = gen.NextId();

  const suffix = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, '0');

  return `${snowId}${suffix}`;
}
