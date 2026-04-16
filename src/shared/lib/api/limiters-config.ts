import { SETTINGS_EMAIL_VERIFICATION_CODE_TTL_MS } from '@/shared/constants/email';

export const SEND_EMAIL_RATE_LIMIT_CONFIG = {
  bucket: 'api.send-email',
  minIntervalMs: 60_000,
  ttlMs: 15 * 60 * 1000,
} as const;

export const AI_QUERY_RATE_LIMIT_CONFIG = {
  bucket: 'api.ai-query',
  minIntervalMs: 4_000,
  ttlMs: 60 * 60 * 1000,
} as const;

export const VERIFY_CODE_ATTEMPT_LIMIT_CONFIG = {
  bucket: 'api.verify-email-code',
  windowMs: SETTINGS_EMAIL_VERIFICATION_CODE_TTL_MS,
  maxAttempts: 5,
} as const;

export const EMAIL_TEST_QUOTA_LIMIT_CONFIG = {
  bucket: 'api.email-test',
  windowMs: 5 * 60 * 1000,
  maxAttempts: 3,
  maxConcurrent: 1,
} as const;

export const STORAGE_UPLOAD_CONCURRENCY_LIMIT_CONFIG = {
  bucket: 'api.storage-upload',
  maxGlobal: 4,
  maxPerKey: 2,
  leaseMs: 15 * 60 * 1000,
} as const;
