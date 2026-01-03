import { getRequestConfig } from 'next-intl/server';

import { localeMessagesPaths, type Locale } from '@/config/locale';

import { routing } from './config';

type Messages = Record<string, unknown>;

/**
 * Base message bundle.
 *
 * Notes:
 * - We keep a complete `en` bundle as the base.
 * - Other locales may override partially; missing namespaces fall back to `en`.
 * - In dev/CI, we keep `en/zh/zh-TW` strict to catch missing files early.
 */
const baseMessagesLocale: Locale = 'en';

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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

const isMissingModuleError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : error !== undefined
        ? String(error)
        : '';

  return (
    message.includes('Cannot find module') ||
    message.includes('Module not found') ||
    message.includes("Can't resolve")
  );
};

const isStrictLocaleInDev = (locale: Locale): boolean =>
  isDevOrCI && (locale === 'en' || locale === 'zh' || locale === 'zh-TW');

const loadMessagesRequired = async (
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
    throw createLoadError(locale, path, error);
  }
};

const loadMessagesOptional = async (
  path: string,
  locale: Locale
): Promise<Messages | undefined> => {
  try {
    return await loadMessagesRequired(path, locale);
  } catch (error) {
    if (isMissingModuleError(error) && !isStrictLocaleInDev(locale)) {
      return undefined;
    }
    throw createLoadError(locale, path, error);
  }
};

const mergeDeep = (base: unknown, override: unknown): unknown => {
  if (override === undefined) {
    return base;
  }

  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      result[key] = mergeDeep(result[key], value);
    }
    return result;
  }

  return override;
};

const mergeMessages = async (locale: Locale): Promise<Messages> => {
  const cached = shouldCacheMessages
    ? mergedMessagesCache.get(locale)
    : undefined;
  if (cached) {
    return cached;
  }

  const segments = await Promise.all(
    localeMessagesPaths.map(async (path) => {
      const base = await loadMessagesRequired(path, baseMessagesLocale);
      if (locale === baseMessagesLocale) {
        return base;
      }

      const localized = await loadMessagesOptional(path, locale);
      return localized ? (mergeDeep(base, localized) as Messages) : base;
    })
  );

  const messages: Messages = {};

  localeMessagesPaths.forEach((path, index) => {
    const localMessages = segments[index];

    const keys = path.split('/');
    let current: Messages = messages;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      const next = current[key];
      if (!isPlainObject(next)) {
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
