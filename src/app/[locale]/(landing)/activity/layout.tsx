// data: activity sidebar translations + landing header/footer translations + theme layout
// cache: default (no explicit fetch); auth gating happens in middleware for `/activity/**`
// reason: keep shared shell stable; user-specific data stays in leaf pages
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { getThemeLayout } from '@/core/theme';
import { LocaleDetector } from '@/shared/blocks/common';
import { ConsoleLayout } from '@/shared/blocks/console/layout';
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

export default async function ActivityLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations('activity.sidebar');
  const tl = await getTranslations('landing');
  const Layout = await getThemeLayout('landing');

  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);

  // settings title
  const title = t('title');

  // settings nav
  const nav = replaceBrandPlaceholdersDeep(t.raw('nav'), brand);

  const topNav = replaceBrandPlaceholdersDeep(t.raw('top_nav'), brand);

  const headerRaw: HeaderType = tl.raw('header');
  const footerRaw: FooterType = tl.raw('footer');
  const { header, footer } = applyBrandToLandingHeaderFooter({
    header: replaceBrandPlaceholdersDeep(headerRaw, brand),
    footer: replaceBrandPlaceholdersDeep(footerRaw, brand),
    configs: publicConfigs,
  });

  return (
    <AppContextProvider>
      <Layout header={header} footer={footer}>
        <LocaleDetector />
        <ConsoleLayout
          title={title}
          nav={nav}
          topNav={topNav}
          className="py-16 md:py-20"
        >
          {children}
        </ConsoleLayout>
      </Layout>
    </AppContextProvider>
  );
}
