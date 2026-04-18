// data: slug/locale params + page content (content/pages/*.md) + theme page component + notFound()
// cache: default (static per slug/locale; no request-bound auth)
// reason: public markdown pages; no user-specific data
import { notFound } from 'next/navigation';
import { getDocsPage } from '@/features/docs/server/content';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { buildBrandPlaceholderValues } from '@/shared/lib/brand-placeholders.server';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';
import PageDetailPageView from '@/themes/default/pages/page-detail';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const t = await getTranslations('common.metadata');

  const { locale, slug } = await params;

  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);
  const appUrl = brand.appUrl || envConfigs.app_url;

  const canonicalUrl =
    locale !== envConfigs.locale
      ? `${appUrl}/${locale}/${slug}`
      : `${appUrl}/${slug}`;

  const page = await getDocsPage({ slug, locale });
  if (!page) {
    return {
      title: `${slug} | ${t('title')}`,
      description: t('description'),
      alternates: {
        canonical: canonicalUrl,
      },
    };
  }

  return {
    title: `${page.title} | ${t('title')}`,
    description: page.description,
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function DynamicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // Get the page from pagesSource
  const page = await getDocsPage({ slug, locale });
  if (!page) {
    return notFound();
  }

  return <PageDetailPageView locale={locale} post={page} />;
}
