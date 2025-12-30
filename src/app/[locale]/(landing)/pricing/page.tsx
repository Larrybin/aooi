// data: pricing translations + (optional) signed-in user (better-auth) + subscription (db)
// cache: no-store (request-bound auth to render current subscription)
// reason: user-specific subscription state must not be cached across users
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme/landing';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/shared/lib/brand-placeholders.server';
import { logger } from '@/shared/lib/logger.server';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';
import { getMetadata } from '@/shared/lib/seo';
import { getCurrentSubscription } from '@/shared/models/subscription';
import { getUserInfo } from '@/shared/models/user';
import type {
  FAQ as FAQType,
  Testimonials as TestimonialsType,
} from '@/shared/types/blocks/landing';
import type { Pricing as PricingType } from '@/shared/types/blocks/pricing';

export const generateMetadata = getMetadata({
  metadataKey: 'pricing.metadata',
  canonicalUrl: '/pricing',
});

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

  // get current subscription
  let currentSubscription;
  try {
    const user = await getUserInfo();
    if (user) {
      currentSubscription = await getCurrentSubscription(user.id);
    }
  } catch (error) {
    logger.warn('landing: get current subscription failed', {
      route: '/pricing',
      locale,
      error,
    });
  }

  // load page component
  const Page = await getThemePage('pricing');

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
    <Page
      locale={locale}
      pricing={pricing}
      currentSubscription={currentSubscription}
      faq={faq}
      testimonials={testimonials}
    />
  );
}
