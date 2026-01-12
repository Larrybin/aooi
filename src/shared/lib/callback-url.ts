import { locales } from '@/config/locale';

const DEFAULT_FALLBACK = '/';

function stripLocalePrefix(pathname: string): string {
  for (const locale of locales) {
    const prefix = `/${locale}`;
    if (pathname === prefix) {
      return '/';
    }
    if (pathname.startsWith(`${prefix}/`)) {
      return pathname.slice(prefix.length) || '/';
    }
  }

  return pathname;
}

export function normalizeCallbackUrl(
  value: string | undefined,
  fallback: string = DEFAULT_FALLBACK
): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback; // protocol-relative

  try {
    const url = new URL(value, 'http://localhost');
    const pathname = stripLocalePrefix(url.pathname);
    return `${pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}

export function withCallbackUrl(pathname: string, callbackUrl: string): string {
  const normalized = normalizeCallbackUrl(callbackUrl);
  if (normalized === '/' || !normalized) return pathname;

  const joiner = pathname.includes('?') ? '&' : '?';
  return `${pathname}${joiner}callbackUrl=${encodeURIComponent(normalized)}`;
}
