function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export const runtime = 'nodejs';

function getAuthSecret(): string | null {
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET;
  return isNonEmptyString(secret) ? secret.trim() : null;
}

function formatConfigError(parts: string[]): Error {
  return new Error(parts.filter(Boolean).join(' '));
}

export async function register() {
  const runtime = process.env.NEXT_RUNTIME;
  if (runtime === 'edge') {
    return;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
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
