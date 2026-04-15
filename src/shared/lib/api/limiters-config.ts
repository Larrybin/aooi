import { SETTINGS_EMAIL_VERIFICATION_CODE_TTL_MS } from '@/shared/constants/email';

export const SEND_EMAIL_RATE_LIMIT_CONFIG = {
  minIntervalMs: 60_000,
  ttlMs: 15 * 60 * 1000,
  maxEntries: 10_000,
} as const;

export const AI_QUERY_RATE_LIMIT_CONFIG = {
  minIntervalMs: 4_000,
  ttlMs: 60 * 60 * 1000,
  maxEntries: 10_000,
} as const;

export const VERIFY_CODE_ATTEMPT_LIMIT_CONFIG = {
  windowMs: SETTINGS_EMAIL_VERIFICATION_CODE_TTL_MS,
  maxAttempts: 5,
  maxEntries: 10_000,
} as const;

export const EMAIL_TEST_QUOTA_LIMIT_CONFIG = {
  windowMs: 5 * 60 * 1000,
  maxAttempts: 3,
  maxConcurrent: 1,
  maxEntries: 5_000,
} as const;

export const STORAGE_UPLOAD_CONCURRENCY_LIMIT_CONFIG = {
  maxGlobal: 4,
  maxPerKey: 2,
} as const;
