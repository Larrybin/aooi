// data: activity sidebar translations + landing header/footer translations + theme layout
// cache: default (no explicit fetch); auth gating happens in middleware for `/activity/**`
// reason: keep shared shell stable; user-specific data stays in leaf pages
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import { LocaleDetector } from '@/shared/blocks/common/locale-detector';
import { ConsoleLayout } from '@/shared/blocks/console/layout';
import { PublicAppProvider } from '@/shared/contexts/app';
import { AuthSnapshotProvider } from '@/shared/contexts/auth-snapshot';
import { getSignedInUserSnapshot } from '@/shared/lib/auth-session.server';
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
import LandingLayout from '@/themes/default/layouts/landing';

export default async function ActivityLayout({
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
  const initialSnapshot = await getSignedInUserSnapshot();

  const t = await getTranslations('activity.sidebar');
  const tl = await getTranslations('landing');
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
    <ScopedIntlProvider
      locale={locale}
      namespaces={[
        'common.sign',
        'common.locale_switcher',
        'common.locale_detector',
      ]}
    >
      <PublicAppProvider initialConfigs={publicConfigs}>
        <AuthSnapshotProvider initialSnapshot={initialSnapshot}>
          <LandingLayout header={header} footer={footer}>
            <LocaleDetector />
            <ConsoleLayout
              title={title}
              nav={nav}
              topNav={topNav}
              className="py-16 md:py-20"
            >
              {children}
            </ConsoleLayout>
          </LandingLayout>
        </AuthSnapshotProvider>
      </PublicAppProvider>
    </ScopedIntlProvider>
  );
}
