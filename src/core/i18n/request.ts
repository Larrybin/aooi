import { getRequestConfig } from 'next-intl/server';

import { routing } from './config';
import type { Locale } from '@/config/locale';

import { getRequestMessages, normalizeLocale } from './messages';

export default getRequestConfig(async ({ requestLocale }) => {
  const resolvedLocale =
    normalizeLocale(await requestLocale) ?? (routing.defaultLocale as Locale);

  return {
    locale: resolvedLocale,
    messages: await getRequestMessages(resolvedLocale),
  };
});
