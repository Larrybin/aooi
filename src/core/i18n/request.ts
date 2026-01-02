import { getRequestConfig } from 'next-intl/server';

import {
  defaultLocale,
  localeMessagesPaths,
  type Locale,
} from '@/config/locale';
import { logger } from '@/shared/lib/logger.server';

import { routing } from './config';

type Messages = Record<string, unknown>;

const isDevOrCI =
  process.env.NODE_ENV !== 'production' || process.env.CI === 'true';
const shouldCacheMessages = !isDevOrCI;
const namespaceCache = new Map<string, Messages>();
const mergedMessagesCache = new Map<Locale, Messages>();

const normalizeLocale = (
  input: string | null | undefined
): Locale | undefined => {
  if (!input) return undefined;
  const normalized = input === 'zh-CN' ? 'zh' : input;

  return routing.locales.includes(normalized as Locale)
    ? (normalized as Locale)
    : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const createLoadError = (locale: Locale, path: string, cause?: unknown) => {
  const reason =
    cause instanceof Error
      ? cause.message
      : cause !== undefined
        ? String(cause)
        : undefined;
  const suffix = reason ? ` (reason: ${reason})` : '';
  return new Error(
    `[i18n] Failed to load messages for locale "${locale}" at "${path}"${suffix}`
  );
};

const importMessages = async (
  path: string,
  locale: Locale
): Promise<Messages> => {
  const messages = await import(
    `@/config/locale/messages/${locale}/${path}.json`
  );
  return messages.default;
};

const loadMessages = async (
  path: string,
  locale: Locale
): Promise<Messages> => {
  const cacheKey = `${locale}:${path}`;
  if (shouldCacheMessages && namespaceCache.has(cacheKey)) {
    return namespaceCache.get(cacheKey) as Messages;
  }

  try {
    const messages = await importMessages(path, locale);

    if (shouldCacheMessages) {
      namespaceCache.set(cacheKey, messages);
    }

    return messages;
  } catch (error) {
    const isStrictLocaleInDev =
      isDevOrCI && (locale === 'en' || locale === 'zh');
    if (locale === defaultLocale || isStrictLocaleInDev) {
      throw createLoadError(locale, path, error);
    }

    try {
      const fallbackMessages = await importMessages(path, defaultLocale);
      logger.warn('i18n: missing locale messages, fallback to default locale', {
        locale,
        path,
      });
      if (shouldCacheMessages) {
        namespaceCache.set(cacheKey, fallbackMessages);
      }
      return fallbackMessages;
    } catch (fallbackError) {
      throw createLoadError(locale, path, fallbackError);
    }
  }
};

const mergeMessages = async (locale: Locale): Promise<Messages> => {
  const cached = shouldCacheMessages
    ? mergedMessagesCache.get(locale)
    : undefined;
  if (cached) {
    return cached;
  }

  const segments = await Promise.all(
    localeMessagesPaths.map((path) => loadMessages(path, locale))
  );

  const messages: Messages = {};

  localeMessagesPaths.forEach((path, index) => {
    const localMessages = segments[index];

    const keys = path.split('/');
    let current: Messages = messages;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      const next = current[key];
      if (!isRecord(next)) {
        current[key] = {};
      }
      current = current[key] as Messages;
    }

    current[keys[keys.length - 1]] = localMessages;
  });

  if (shouldCacheMessages) {
    mergedMessagesCache.set(locale, messages);
  }

  return messages;
};

export default getRequestConfig(async ({ requestLocale }) => {
  const resolvedLocale =
    normalizeLocale(await requestLocale) ?? (routing.defaultLocale as Locale);

  return {
    locale: resolvedLocale,
    messages: await mergeMessages(resolvedLocale),
  };
});
