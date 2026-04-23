import { site } from '@/site';

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
  Pick<NodeJS.ProcessEnv, 'BETTER_AUTH_URL' | 'AUTH_URL'>
>;

export function resolveServerAuthBaseUrl(
  env?: ServerAuthBaseUrlEnv
): string {
  const runtimeEnv = env ?? process.env;
  const rawBetterAuthUrl = runtimeEnv.BETTER_AUTH_URL?.trim() || '';
  const rawAuthUrl = runtimeEnv.AUTH_URL?.trim() || '';
  const siteOrigin = normalizeOrigin(site.brand.appUrl, 'site.brand.appUrl');

  for (const [label, value] of [
    ['BETTER_AUTH_URL', rawBetterAuthUrl],
    ['AUTH_URL', rawAuthUrl],
  ] as const) {
    if (!value) {
      continue;
    }

    const authOrigin = normalizeOrigin(value, label);
    if (authOrigin !== siteOrigin) {
      throw new Error(
        `${label} must share the same origin as site.brand.appUrl (expected ${siteOrigin}, got ${authOrigin})`
      );
    }
  }

  return siteOrigin;
}
