import 'server-only';

import { defaultLocale, locales } from '@/config/locale';
import { site } from '@/site';

function stripTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizeRelativePath(value: string) {
  if (!value) return '/';
  if (value.startsWith('/')) return value;
  return `/${value}`;
}

export function buildCanonicalUrl(pathOrUrl: string, locale?: string) {
  if (!pathOrUrl) {
    pathOrUrl = '/';
  }

  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  const baseUrl = stripTrailingSlash(site.brand.appUrl);
  const relativePath = normalizeRelativePath(pathOrUrl);
  const localePrefix =
    !locale || locale === defaultLocale ? '' : `/${locale}`;

  if (relativePath === '/') {
    return localePrefix ? `${baseUrl}${localePrefix}` : `${baseUrl}/`;
  }

  return `${baseUrl}${localePrefix}${relativePath}`;
}

export function buildMetadataBaseUrl() {
  return new URL(site.brand.appUrl);
}

export function buildLanguageAlternates(relativePath: string) {
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return undefined;
  }

  return Object.fromEntries(
    locales.map((locale) => [locale, buildCanonicalUrl(relativePath, locale)])
  );
}
