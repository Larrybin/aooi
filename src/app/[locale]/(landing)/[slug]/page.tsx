// data: slug/locale params + page content (content/pages/*.md) + theme page component + notFound()
// cache: default (static per slug/locale; no request-bound auth)
// reason: public markdown pages; no user-specific data
import { notFound } from 'next/navigation';
import { getDocsPage } from '@/domains/content/application/public-content.query';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildBrandPlaceholderValues } from '@/shared/lib/brand-placeholders.server';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';
import { getServerPublicEnvConfigs } from '@/infra/runtime/env.server';
import PageDetailPageView from '@/themes/default/pages/page-detail';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const t = await getTranslations('common.metadata');

  const { locale, slug } = await params;

  const publicConfigs = await getPublicConfigsCached();
  const serverPublicEnvConfigs = getServerPublicEnvConfigs();
  const brand = buildBrandPlaceholderValues(publicConfigs);
  const appUrl = brand.appUrl || serverPublicEnvConfigs.app_url;

  const canonicalUrl =
    locale !== serverPublicEnvConfigs.locale
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
