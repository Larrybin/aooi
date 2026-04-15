import { headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './config';
import type { Locale } from '@/config/locale';

import { getScopedMessages, normalizeLocale } from './messages';
import { getRequestNamespaces } from './messages.shared';

function resolveRequestPathname(requestHeaders: Headers): string {
  const pathname = requestHeaders.get('x-pathname');
  if (pathname) {
    return pathname;
  }

  const requestUrl = requestHeaders.get('x-url');
  if (requestUrl) {
    try {
      return new URL(requestUrl).pathname;
    } catch {
      return '/';
    }
  }

  return '/';
}

export default getRequestConfig(async ({ requestLocale }) => {
  const resolvedLocale =
    normalizeLocale(await requestLocale) ?? (routing.defaultLocale as Locale);
  const pathname = resolveRequestPathname(await headers());
  const namespaces = getRequestNamespaces(pathname);

  return {
    locale: resolvedLocale,
    messages: await getScopedMessages(resolvedLocale, namespaces),
  };
});
