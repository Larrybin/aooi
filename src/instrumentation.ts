import { getTrimmedEnvValue } from '@/config/env-contract';
import { isProductionEnv } from '@/shared/lib/env';
import { getServerRuntimeEnv } from '@/shared/lib/runtime/env.server';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export const runtime = 'nodejs';

function getAuthSecret(): string | null {
  const secret = getServerRuntimeEnv().authSecret;
  return isNonEmptyString(secret) ? secret.trim() : null;
}

function formatConfigError(parts: string[]): Error {
  return new Error(parts.filter(Boolean).join(' '));
}

export async function register() {
  const runtime = getTrimmedEnvValue(undefined, 'NEXT_RUNTIME');
  if (runtime === 'edge') {
    return;
  }

  if (!isProductionEnv()) {
    return;
  }

  const secret = getAuthSecret();
  if (!secret) {
    throw formatConfigError([
      'Auth config check failed in production: missing BETTER_AUTH_SECRET/AUTH_SECRET.',
      'Set one of these environment variables to a strong random value.',
    ]);
  }
}
