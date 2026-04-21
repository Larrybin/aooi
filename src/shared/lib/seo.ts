import 'server-only';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { defaultLocale, locales } from '@/config/locale';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';
import { buildBrandPlaceholderValues } from '@/shared/lib/brand-placeholders.server';
import { getServerPublicEnvConfigs } from '@/infra/runtime/env.server';

type MetadataFields = {
  title: string;
  description: string;
  keywords: string;
};

function stripTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizeRelativePath(value: string) {
  if (!value) return '/';
  if (value.startsWith('/')) return value;
  return `/${value}`;
}

export function buildCanonicalUrl(pathOrUrl: string, locale: string) {
  return buildCanonicalUrlWithAppUrl(
    pathOrUrl,
    locale,
    getServerPublicEnvConfigs().app_url
  );
}

export function buildCanonicalUrlWithAppUrl(
  pathOrUrl: string,
  locale: string,
  appUrl: string
) {
  if (!pathOrUrl) pathOrUrl = '/';

  if (pathOrUrl.startsWith('http')) {
    return pathOrUrl;
  }

  const baseUrl = stripTrailingSlash(appUrl);
  const relativePath = normalizeRelativePath(pathOrUrl);
  const localePrefix = !locale || locale === defaultLocale ? '' : `/${locale}`;

  if (relativePath === '/') {
    return localePrefix ? `${baseUrl}${localePrefix}` : `${baseUrl}/`;
  }

  return `${baseUrl}${localePrefix}${relativePath}`;
}

export function buildLanguageAlternates(relativePath: string) {
  return buildLanguageAlternatesWithAppUrl(
    relativePath,
    getServerPublicEnvConfigs().app_url
  );
}

export function buildLanguageAlternatesWithAppUrl(
  relativePath: string,
  appUrl: string
) {
  if (relativePath.startsWith('http')) {
    return undefined;
  }

  return Object.fromEntries(
    locales.map((locale) => [
      locale,
      buildCanonicalUrlWithAppUrl(relativePath, locale, appUrl),
    ])
  );
}

// get metadata for page component
export function getMetadata(
  options: {
    title?: string;
    description?: string;
    keywords?: string;
    metadataKey?: string;
    canonicalUrl?: string; // relative path or full url
    imageUrl?: string;
    appName?: string;
    noIndex?: boolean;
  } = {}
) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }) {
    const { locale } = await params;
    setRequestLocale(locale);

    const brand = buildBrandPlaceholderValues(await getPublicConfigsCached());

    // passed metadata
    const passedMetadata = {
      title: options.title,
      description: options.description,
      keywords: options.keywords,
    };

    // default metadata
    const defaultMetadata = applyBrandToMetadataFields(
      await getTranslatedMetadata(defaultMetadataKey, locale),
      { appName: brand.appName }
    );

    // translated metadata
    let translatedMetadata: Partial<MetadataFields> = {};
    if (options.metadataKey) {
      translatedMetadata = applyBrandToMetadataFields(
        await getTranslatedMetadata(options.metadataKey, locale),
        { appName: brand.appName }
      );
    }

    // canonical url
    const canonicalUrl = buildCanonicalUrlWithAppUrl(
      options.canonicalUrl || '/',
      locale,
      brand.appUrl
    );
    const canonicalPathForAlternates =
      options.canonicalUrl && options.canonicalUrl.startsWith('http')
        ? undefined
        : normalizeRelativePath(options.canonicalUrl || '/');
    const languageAlternates = canonicalPathForAlternates
      ? buildLanguageAlternatesWithAppUrl(
          canonicalPathForAlternates,
          brand.appUrl
        )
      : undefined;

    const title =
      passedMetadata.title || translatedMetadata.title || defaultMetadata.title;
    const description =
      passedMetadata.description ||
      translatedMetadata.description ||
      defaultMetadata.description;

    // image url
    let imageUrl = options.imageUrl || brand.appOgImage || '/logo.png';
    if (imageUrl.startsWith('http')) {
      imageUrl = imageUrl;
    } else {
      imageUrl = `${brand.appUrl}${imageUrl}`;
    }

    // app name
    let appName = options.appName;
    if (!appName) {
      appName = brand.appName || '';
    }

    return {
      metadataBase: new URL(stripTrailingSlash(brand.appUrl)),
      title:
        passedMetadata.title ||
        translatedMetadata.title ||
        defaultMetadata.title,
      description:
        passedMetadata.description ||
        translatedMetadata.description ||
        defaultMetadata.description,
      keywords:
        passedMetadata.keywords ||
        translatedMetadata.keywords ||
        defaultMetadata.keywords,
      alternates: {
        canonical: canonicalUrl,
        ...(languageAlternates ? { languages: languageAlternates } : {}),
      },
      icons: {
        icon: brand.appFavicon,
        shortcut: brand.appFavicon,
      },

      openGraph: {
        type: 'website',
        locale: locale,
        url: canonicalUrl,
        title,
        description,
        siteName: appName,
        images: [imageUrl.toString()],
      },

      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl.toString()],
        site: brand.appUrl,
      },

      robots: {
        index: options.noIndex ? false : true,
        follow: options.noIndex ? false : true,
      },
    };
  };
}

const defaultMetadataKey = 'common.metadata';

async function getTranslatedMetadata(metadataKey: string, locale: string) {
  setRequestLocale(locale);
  const t = await getTranslations(metadataKey);

  return {
    title: t.has('title') ? t('title') : '',
    description: t.has('description') ? t('description') : '',
    keywords: t.has('keywords') ? t('keywords') : '',
  };
}

function applyBrandToMetadataFields(
  fields: MetadataFields,
  brand: { appName: string }
): MetadataFields {
  const appName = brand.appName;
  if (!appName) return fields;

  return {
    title: fields.title.replaceAll('Roller Rabbit', appName),
    description: fields.description.replaceAll('Roller Rabbit', appName),
    keywords: fields.keywords.replaceAll('Roller Rabbit', appName),
  };
}
