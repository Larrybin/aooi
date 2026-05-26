import { site } from '@/site';

import { localeRegistry, type LocaleCode } from './registry';

export type Locale = LocaleCode;

export const locales = Object.freeze([
  ...site.i18n.supportedLocales,
]) as readonly Locale[];

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

export const defaultLocale = site.i18n.defaultLocale as Locale;

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
