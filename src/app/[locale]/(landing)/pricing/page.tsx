// data: site-scoped pricing + theme page
// cache: static (generateStaticParams) + cached public configs
// reason: marketing pricing page should stay statically prerenderable
import type { Metadata } from 'next';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/infra/platform/brand/placeholders.server';
import { getLocaleStaticParams } from '@/infra/platform/i18n/static-params';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildMetadataBaseUrl,
} from '@/infra/url/canonical';
import { site, sitePricing } from '@/site';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { locales } from '@/config/locale';
import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import type { SitePricing } from '@/shared/types/blocks/pricing';
import PricingPageView from '@/themes/default/pages/pricing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const title = sitePricing?.metadata?.title ?? 'Pricing';
  const description =
    sitePricing?.metadata?.description ?? `Choose a ${site.brand.appName} plan.`;

  return {
    metadataBase: buildMetadataBaseUrl(),
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: buildCanonicalUrl('/pricing', locale),
      languages: buildLanguageAlternates('/pricing'),
    },
    openGraph: {
      type: 'website',
      locale,
      url: buildCanonicalUrl('/pricing', locale),
      title,
      description,
      siteName: site.brand.appName,
    },
  };
}

export function generateStaticParams() {
  return getLocaleStaticParams(locales);
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!sitePricing) {
    notFound();
  }

  const brand = buildBrandPlaceholderValues();
  const pricingContent = replaceBrandPlaceholdersDeep(
    sitePricing,
    brand
  ) as SitePricing;

  return (
    <ScopedIntlProvider
      locale={locale}
      namespaces={['pricing.page', 'common.payment']}
    >
      <PricingPageView
        locale={locale}
        pricing={pricingContent.pricing}
        faq={pricingContent.faq}
        testimonials={pricingContent.testimonials}
      />
    </ScopedIntlProvider>
  );
}
