// data: landing translations + public configs (unstable_cache tag=public-configs, revalidate=3600s) + theme components
// cache: cached configs + default RSC
// reason: public marketing page; allow toggles without per-request db reads
import {
  readAuthUiRuntimeSettingsCached,
  readBillingRuntimeSettingsCached,
  readPublicUiConfigCached,
} from '@/domains/settings/application/settings-runtime.query';
import { applyBrandToLandingHeaderFooter } from '@/infra/platform/brand/identity';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/infra/platform/brand/placeholders.server';
import { filterLandingButtons } from '@/surfaces/public/navigation/landing-visibility';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import {
  type Footer as FooterType,
  type Header as HeaderType,
  type Landing,
} from '@/shared/types/blocks/landing';
import LandingMarketingLayout from '@/themes/default/layouts/landing-marketing';
import LandingPageView from '@/themes/default/pages/landing';

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // load page data
  const t = await getTranslations('landing');

  const [publicUiConfig, authSettings, billingSettings] = await Promise.all([
    readPublicUiConfigCached(),
    readAuthUiRuntimeSettingsCached(),
    readBillingRuntimeSettingsCached(),
  ]);
  const brand = buildBrandPlaceholderValues();

  // build page params
  const hero = replaceBrandPlaceholdersDeep(t.raw('hero'), brand);
  const cta = replaceBrandPlaceholdersDeep(t.raw('cta'), brand);

  const page: Landing = {
    hero: hero
      ? {
          ...hero,
          buttons: filterLandingButtons(hero.buttons, publicUiConfig),
        }
      : undefined,
    logos: replaceBrandPlaceholdersDeep(t.raw('logos'), brand),
    introduce: replaceBrandPlaceholdersDeep(t.raw('introduce'), brand),
    benefits: replaceBrandPlaceholdersDeep(t.raw('benefits'), brand),
    usage: replaceBrandPlaceholdersDeep(t.raw('usage'), brand),
    features: replaceBrandPlaceholdersDeep(t.raw('features'), brand),
    stats: replaceBrandPlaceholdersDeep(t.raw('stats'), brand),
    subscribe: replaceBrandPlaceholdersDeep(t.raw('subscribe'), brand),
    testimonials: replaceBrandPlaceholdersDeep(t.raw('testimonials'), brand),
    faq: replaceBrandPlaceholdersDeep(t.raw('faq'), brand),
    cta: cta
      ? {
          ...cta,
          buttons: filterLandingButtons(cta.buttons, publicUiConfig),
        }
      : undefined,
  };

  // load page component
  const headerRaw: HeaderType = t.raw('header');
  const footerRaw: FooterType = t.raw('footer');
  const { header, footer } = applyBrandToLandingHeaderFooter({
    header: replaceBrandPlaceholdersDeep(headerRaw, brand),
    footer: replaceBrandPlaceholdersDeep(footerRaw, brand),
  });

  return (
    <LandingMarketingLayout
      header={header}
      footer={footer}
      locale={locale}
      publicUiConfig={publicUiConfig}
      authSettings={authSettings}
      billingSettings={billingSettings}
    >
      <LandingPageView locale={locale} page={page} />
    </LandingMarketingLayout>
  );
}
