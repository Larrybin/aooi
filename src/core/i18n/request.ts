import { getRequestConfig } from 'next-intl/server';

import {
  defaultLocale,
  localeMessagesPaths,
  localeMessagesRootPath,
  locales,
  type Locale,
} from '@/config/locale';

import { routing } from './config';

export async function loadMessages(path: string, locale: Locale = defaultLocale) {
  try {
    // try to load locale messages
    const messages = await import(
      `@/config/locale/messages/${locale}/${path}.json`
    );
    return messages.default;
  } catch {
    try {
      // try to load default locale messages
      const messages = await import(
        `@/config/locale/messages/${defaultLocale}/${path}.json`
      );
      return messages.default;
    } catch {
      // if default locale is not found, return empty object
      return {};
    }
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as Locale)) {
    locale = routing.defaultLocale as Locale;
  }

  if (['zh-CN'].includes(locale)) {
    locale = 'zh';
  }

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  try {
    // load all local messages
    const allMessages = await Promise.all(
      localeMessagesPaths.map((path) => loadMessages(path, locale as Locale))
    );

    // merge all local messages
    const messages: Record<string, unknown> = {};

    localeMessagesPaths.forEach((path, index) => {
      const localMessages = allMessages[index];

      const keys = path.split('/');
      let current: Record<string, unknown> = messages;

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        const next = current[key];
        if (!isRecord(next)) {
          current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
      }

      current[keys[keys.length - 1]] = localMessages;
    });

    return {
      locale,
      messages,
    };
  } catch {
    return {
      locale: defaultLocale,
      messages: await loadMessages(localeMessagesRootPath, defaultLocale),
    };
  }
});
