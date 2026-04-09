import { localeMessagesPaths, type Locale } from '@/config/locale';

import { resolveMessagePath } from './messages.shared';

export { normalizeLocale } from './messages.shared';

type Messages = Record<string, unknown>;

const baseMessagesLocale: Locale = 'en';
const isDevOrCI =
  process.env.NODE_ENV !== 'production' || process.env.CI === 'true';
const shouldCacheMessages = !isDevOrCI;
const namespaceCache = new Map<string, Messages>();
const scopedMessagesCache = new Map<string, Messages>();
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

const assignMessagesAtPath = (
  messages: Messages,
  messagePath: string,
  value: Messages
) => {
  const keys = messagePath.split('/');
  let current = messages;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    const next = current[key];

    if (!isPlainObject(next)) {
      current[key] = {};
    }

    current = current[key] as Messages;
  }

  current[keys[keys.length - 1]] = value;
};

async function loadMergedMessagesForPath(
  locale: Locale,
  messagePath: string
): Promise<Messages> {
  const baseMessages = await loadMessagesRequired(messagePath, baseMessagesLocale);

  if (locale === baseMessagesLocale) {
    return baseMessages;
  }

  const localizedMessages = await loadMessagesOptional(messagePath, locale);

  return localizedMessages
    ? (mergeDeep(baseMessages, localizedMessages) as Messages)
    : baseMessages;
}

export async function getScopedMessages(
  locale: Locale,
  namespaces: string[]
): Promise<Messages> {
  const messagePaths = Array.from(
    new Set(namespaces.map((namespace) => resolveMessagePath(namespace)))
  );

  if (!messagePaths.length) {
    return {};
  }

  const cacheKey = `${locale}:${messagePaths.join('|')}`;
  if (shouldCacheMessages && scopedMessagesCache.has(cacheKey)) {
    return scopedMessagesCache.get(cacheKey) as Messages;
  }

  const segments = await Promise.all(
    messagePaths.map(async (messagePath) => ({
      messagePath,
      messages: await loadMergedMessagesForPath(locale, messagePath),
    }))
  );

  const scopedMessages: Messages = {};
  for (const segment of segments) {
    assignMessagesAtPath(scopedMessages, segment.messagePath, segment.messages);
  }

  if (shouldCacheMessages) {
    scopedMessagesCache.set(cacheKey, scopedMessages);
  }

  return scopedMessages;
}

export async function getRequestMessages(locale: Locale): Promise<Messages> {
  return getScopedMessages(locale, localeMessagesPaths);
}
