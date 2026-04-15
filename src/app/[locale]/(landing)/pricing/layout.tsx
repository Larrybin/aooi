// data: landing translations (header/footer) + theme layout
// cache: default (no explicit fetch)
// reason: shared landing shell; keep data loading in leaf pages
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { getThemeLayout } from '@/core/theme';
import { LocaleDetectorLazy } from '@/shared/blocks/common/locale-detector-lazy';
import { PublicAppProvider } from '@/shared/contexts/app';
import { applyBrandToLandingHeaderFooter } from '@/shared/lib/brand-identity';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/shared/lib/brand-placeholders.server';
import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';

export default async function PricingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('landing');
  const Layout = await getThemeLayout('landing');

  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);

  const header: HeaderType = t.raw('header');
  const footer: FooterType = t.raw('footer');
  const branded = applyBrandToLandingHeaderFooter({
    header: replaceBrandPlaceholdersDeep(header, brand),
    footer: replaceBrandPlaceholdersDeep(footer, brand),
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
        <Layout header={branded.header} footer={branded.footer}>
          <LocaleDetectorLazy />
          {children}
        </Layout>
      </PublicAppProvider>
    </ScopedIntlProvider>
  );
}
