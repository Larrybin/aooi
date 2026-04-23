import 'server-only';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildBrandPlaceholderValues } from '@/infra/platform/brand/placeholders.server';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildMetadataBaseUrl,
} from '@/infra/url/canonical';

type MetadataFields = {
  title: string;
  description: string;
  keywords: string;
};

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

    const brand = buildBrandPlaceholderValues();

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
    const canonicalUrl = buildCanonicalUrl(options.canonicalUrl || '/', locale);
    const canonicalPathForAlternates =
      options.canonicalUrl && options.canonicalUrl.startsWith('http')
        ? undefined
        : options.canonicalUrl || '/';
    const languageAlternates = canonicalPathForAlternates
      ? buildLanguageAlternates(canonicalPathForAlternates)
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
      metadataBase: buildMetadataBaseUrl(),
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
