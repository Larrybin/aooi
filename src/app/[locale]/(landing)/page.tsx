import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemeLayout, getThemePage } from '@/core/theme/landing';
import { applyBrandToLandingHeaderFooter } from '@/shared/lib/brand-identity';
import { filterLandingButtons } from '@/shared/lib/landing-visibility';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';
import {
  type Footer as FooterType,
  type Header as HeaderType,
  type Landing,
} from '@/shared/types/blocks/landing';

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // load page data
  const t = await getTranslations('landing');

  const publicConfigs = await getPublicConfigsCached();

  const Layout = await getThemeLayout('landing-marketing');

  // build page params
  const hero = t.raw('hero');
  const cta = t.raw('cta');

  const page: Landing = {
    hero: hero
      ? {
          ...hero,
          buttons: filterLandingButtons(hero.buttons, publicConfigs),
        }
      : undefined,
    logos: t.raw('logos'),
    introduce: t.raw('introduce'),
    benefits: t.raw('benefits'),
    usage: t.raw('usage'),
    features: t.raw('features'),
    stats: t.raw('stats'),
    subscribe: t.raw('subscribe'),
    testimonials: t.raw('testimonials'),
    faq: t.raw('faq'),
    cta: cta
      ? {
          ...cta,
          buttons: filterLandingButtons(cta.buttons, publicConfigs),
        }
      : undefined,
  };

  // load page component
  const Page = await getThemePage('landing');

  const headerRaw: HeaderType = t.raw('header');
  const footerRaw: FooterType = t.raw('footer');
  const { header, footer } = applyBrandToLandingHeaderFooter({
    header: headerRaw,
    footer: footerRaw,
  });

  return (
    <Layout header={header} footer={footer} locale={locale}>
      <Page locale={locale} page={page} />
    </Layout>
  );
}
