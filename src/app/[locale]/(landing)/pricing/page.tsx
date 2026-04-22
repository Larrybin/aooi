// data: pricing translations + public configs + theme page
// cache: static (generateStaticParams) + cached public configs
// reason: marketing pricing page should stay statically prerenderable
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getLocaleStaticParams } from '@/infra/platform/i18n/static-params';
import { locales } from '@/config/locale';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/infra/platform/brand/placeholders.server';
import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';
import { getMetadata } from '@/surfaces/public/seo/metadata';
import type {
  FAQ as FAQType,
  Testimonials as TestimonialsType,
} from '@/shared/types/blocks/landing';
import type { Pricing as PricingType } from '@/shared/types/blocks/pricing';
import PricingPageView from '@/themes/default/pages/pricing';

export const generateMetadata = getMetadata({
  metadataKey: 'pricing.metadata',
  canonicalUrl: '/pricing',
});

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

  // load landing data
  const tl = await getTranslations('landing');
  // loading pricing data
  const t = await getTranslations('pricing');

  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);

  // build sections
  const pricing: PricingType = replaceBrandPlaceholdersDeep(
    t.raw('pricing'),
    brand
  );
  const faq: FAQType = replaceBrandPlaceholdersDeep(tl.raw('faq'), brand);
  const testimonials: TestimonialsType = replaceBrandPlaceholdersDeep(
    tl.raw('testimonials'),
    brand
  );

  return (
    <ScopedIntlProvider
      locale={locale}
      namespaces={['pricing.page', 'common.payment']}
    >
      <PricingPageView
        locale={locale}
        pricing={pricing}
        faq={faq}
        testimonials={testimonials}
      />
    </ScopedIntlProvider>
  );
}
