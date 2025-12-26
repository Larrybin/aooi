import { envConfigs } from '..';

export const locales = ['en', 'zh'] as const;

export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
};

const fallbackLocale = locales[0];
const envDefaultLocale = envConfigs.locale;

const resolvedDefaultLocale = locales.includes(envDefaultLocale as Locale)
  ? (envDefaultLocale as Locale)
  : fallbackLocale;

if (
  process.env.NODE_ENV !== 'production' &&
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
