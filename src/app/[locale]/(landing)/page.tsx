import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemeLayout, getThemePage } from '@/core/theme/landing';
import {
  Landing,
  type Footer as FooterType,
  type Header as HeaderType,
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

  const Layout = await getThemeLayout('landing-marketing');

  // build page params
  const page: Landing = {
    hero: t.raw('hero'),
    logos: t.raw('logos'),
    introduce: t.raw('introduce'),
    benefits: t.raw('benefits'),
    usage: t.raw('usage'),
    features: t.raw('features'),
    stats: t.raw('stats'),
    subscribe: t.raw('subscribe'),
    testimonials: t.raw('testimonials'),
    faq: t.raw('faq'),
    cta: t.raw('cta'),
  };

  // load page component
  const Page = await getThemePage('landing');

  const header: HeaderType = t.raw('header');
  const footer: FooterType = t.raw('footer');

  return (
    <Layout header={header} footer={footer} locale={locale}>
      <Page locale={locale} page={page} />
    </Layout>
  );
}
