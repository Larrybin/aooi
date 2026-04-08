// data: landing translations (header/footer) + theme layout
// cache: default (no explicit fetch)
// reason: shared landing shell; keep data loading in leaf pages
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { getThemeLayout } from '@/core/theme/landing';
import { LocaleDetectorLazy } from '@/shared/blocks/common/locale-detector-lazy';
import { AppContextProvider } from '@/shared/contexts/app';
import { applyBrandToLandingHeaderFooter } from '@/shared/lib/brand-identity';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/shared/lib/brand-placeholders.server';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';

export default async function PricingLayout({
  children,
}: {
  children: ReactNode;
}) {
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
    <AppContextProvider>
      <Layout header={branded.header} footer={branded.footer}>
        <LocaleDetectorLazy />
        {children}
      </Layout>
    </AppContextProvider>
  );
}
