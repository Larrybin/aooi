function normalizeOrigin(value: string, label: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('must use http/https');
    }
    return url.origin;
  } catch (error) {
    throw new Error(`Invalid ${label}: ${value} (${String(error)})`);
  }
}

type ServerAuthBaseUrlEnv = Partial<
  Pick<NodeJS.ProcessEnv, 'NEXT_PUBLIC_APP_URL' | 'BETTER_AUTH_URL' | 'AUTH_URL'>
>;

export function resolveServerAuthBaseUrl(
  env?: ServerAuthBaseUrlEnv
): string {
  const runtimeEnv = env ?? process.env;
  const rawAppUrl = runtimeEnv.NEXT_PUBLIC_APP_URL?.trim() || '';
  const rawBetterAuthUrl = runtimeEnv.BETTER_AUTH_URL?.trim() || '';
  const rawAuthUrl = runtimeEnv.AUTH_URL?.trim() || '';

  if (!rawAppUrl) {
    if (rawBetterAuthUrl) {
      return normalizeOrigin(rawBetterAuthUrl, 'BETTER_AUTH_URL');
    }

    if (rawAuthUrl) {
      return normalizeOrigin(rawAuthUrl, 'AUTH_URL');
    }

    return 'http://localhost:3000';
  }

  const appOrigin = normalizeOrigin(rawAppUrl, 'NEXT_PUBLIC_APP_URL');

  for (const [label, value] of [
    ['BETTER_AUTH_URL', rawBetterAuthUrl],
    ['AUTH_URL', rawAuthUrl],
  ] as const) {
    if (!value) {
      continue;
    }

    const authOrigin = normalizeOrigin(value, label);
    if (authOrigin !== appOrigin) {
      throw new Error(
        `${label} must share the same origin as NEXT_PUBLIC_APP_URL (expected ${appOrigin}, got ${authOrigin})`
      );
    }
  }

  return appOrigin;
}
