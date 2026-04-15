// data: landing translations (header/footer) + theme layout + public configs (unstable_cache tag=public-configs, revalidate=3600s)
// cache: cached configs + default RSC
// reason: share the landing shell for AI demo pages; gate access via config
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import { getThemeLayout } from '@/core/theme';
import { LocaleDetector } from '@/shared/blocks/common/locale-detector';
import { PublicAppProvider } from '@/shared/contexts/app';
import { applyBrandToLandingHeaderFooter } from '@/shared/lib/brand-identity';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/shared/lib/brand-placeholders.server';
import { isAiEnabled } from '@/shared/lib/landing-visibility';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';

export default async function AiLandingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const publicConfigs = await getPublicConfigsCached();
  if (!isAiEnabled(publicConfigs)) {
    notFound();
  }

  const t = await getTranslations('landing');
  const Layout = await getThemeLayout('landing');

  const brand = buildBrandPlaceholderValues(publicConfigs);

  const headerRaw: HeaderType = t.raw('header');
  const footerRaw: FooterType = t.raw('footer');
  const { header, footer } = applyBrandToLandingHeaderFooter({
    header: replaceBrandPlaceholdersDeep(headerRaw, brand),
    footer: replaceBrandPlaceholdersDeep(footerRaw, brand),
    configs: publicConfigs,
  });

  return (
    <ScopedIntlProvider
      locale={locale}
      namespaces={[
        'common.sign',
        'common.locale_switcher',
        'common.locale_detector',
      ]}
    >
      <PublicAppProvider initialConfigs={publicConfigs}>
        <Layout header={header} footer={footer}>
          <LocaleDetector />
          {children}
        </Layout>
      </PublicAppProvider>
    </ScopedIntlProvider>
  );
}
