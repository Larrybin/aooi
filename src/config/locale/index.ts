import { getTrimmedEnvValue, isProductionEnv } from '@/config/env-contract';

import { localeRegistry } from './registry';

export const locales = Object.freeze(localeRegistry.map((entry) => entry.code));

export type Locale = (typeof locales)[number];

export const localeNames = Object.fromEntries(
  localeRegistry.map((entry) => [entry.code, entry.name])
) as Record<Locale, string>;

export const localeHreflangs = Object.fromEntries(
  localeRegistry.map((entry) => [entry.code, entry.hreflang])
) as Record<Locale, string>;

export const rtlLocales = Object.freeze(
  localeRegistry
    .filter((entry) => entry.direction === 'rtl')
    .map((entry) => entry.code)
);

const rtlLocaleSet: ReadonlySet<string> = new Set(rtlLocales);

export const isRtlLocale = (locale: string) => rtlLocaleSet.has(locale);

const fallbackLocale = locales[0];
const envDefaultLocale =
  getTrimmedEnvValue(undefined, 'NEXT_PUBLIC_DEFAULT_LOCALE') || 'en';

const resolvedDefaultLocale = locales.includes(envDefaultLocale as Locale)
  ? (envDefaultLocale as Locale)
  : fallbackLocale;

if (
  !isProductionEnv() &&
  envDefaultLocale &&
  envDefaultLocale !== resolvedDefaultLocale
) {
  console.warn(
    `[i18n] NEXT_PUBLIC_DEFAULT_LOCALE="${envDefaultLocale}" 不在 locales 白名单内，已回退为 "${resolvedDefaultLocale}".`
  );
}

export const defaultLocale = resolvedDefaultLocale;

export const localePrefix = 'as-needed';

export const localeDetection = false;

export const localeMessagesRootPath = '@/config/locale/messages';

export const localeMessagesPaths = [
  'common',
  'landing',
  'blog',
  'pricing',
  'demo/ai-chatbot',
  'demo/ai-audio-generator',
  'demo/ai-video-generator',
  'settings/sidebar',
  'settings/profile',
  'settings/security',
  'settings/billing',
  'settings/payments',
  'settings/credits',
  'settings/apikeys',
  'admin/sidebar',
  'admin/users',
  'admin/roles',
  'admin/permissions',
  'admin/categories',
  'admin/posts',
  'admin/payments',
  'admin/subscriptions',
  'admin/credits',
  'admin/settings',
  'admin/apikeys',
  'admin/ai-tasks',
  'admin/chats',
  'ai/music',
  'ai/chat',
  'ai/image',
  'activity/sidebar',
  'activity/ai-tasks',
  'activity/chats',
];
