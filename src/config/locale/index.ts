import {
  getTrimmedEnvValue,
  isProductionEnv,
} from '@/config/env-contract';

export const locales = [
  'en',
  'zh',
  'ar',
  'bn',
  'cs',
  'da',
  'de',
  'el',
  'es',
  'fa',
  'fi',
  'fr',
  'he',
  'hi',
  'id',
  'it',
  'ja',
  'ko',
  'ms',
  'nl',
  'no',
  'pl',
  'pt',
  'pt-BR',
  'ro',
  'ru',
  'sv',
  'th',
  'tl-PH',
  'tr',
  'uk',
  'ur',
  'vi',
  'zh-TW',
] as const;

export type Locale = (typeof locales)[number];

export const localeNames = {
  en: 'English',
  zh: '中文',
  ar: 'العربية',
  bn: 'বাংলা',
  cs: 'Čeština',
  da: 'Dansk',
  de: 'Deutsch',
  el: 'Ελληνικά',
  es: 'Español',
  fa: 'فارسی',
  fi: 'Suomi',
  fr: 'Français',
  he: 'עברית',
  hi: 'हिन्दी',
  id: 'Bahasa Indonesia',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  ms: 'Bahasa Melayu',
  nl: 'Nederlands',
  no: 'Norsk',
  pl: 'Polski',
  pt: 'Português',
  'pt-BR': 'Português (Brasil)',
  ro: 'Română',
  ru: 'Русский',
  sv: 'Svenska',
  th: 'ไทย',
  'tl-PH': 'Filipino (Philippines)',
  tr: 'Türkçe',
  uk: 'Українська',
  ur: 'اردو',
  vi: 'Tiếng Việt',
  'zh-TW': '繁體中文',
} satisfies Record<Locale, string>;

export const rtlLocales = ['ar', 'fa', 'he', 'ur'] as const;

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
