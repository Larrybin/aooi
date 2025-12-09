import { envConfigs } from '..';

export const locales = ['en', 'zh'] as const;

export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
};

export const defaultLocale = envConfigs.locale as Locale;

export const localePrefix = 'as-needed';

export const localeDetection = false;

export const localeMessagesRootPath = '@/config/locale/messages';

export const localeMessagesPaths = [
  'common',
  'landing',
  'showcases',
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
