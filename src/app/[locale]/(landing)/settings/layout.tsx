// data: settings sidebar translations + landing header/footer translations + theme layout
// cache: default (no explicit fetch); auth gating happens in middleware for `/settings/**`
// reason: keep shared shell stable; user-specific data stays in leaf pages
import type { ReactNode } from 'react';
import {
  readAuthUiRuntimeSettingsCached,
  readBillingRuntimeSettingsCached,
  readPublicUiConfigCached,
} from '@/domains/settings/application/settings-runtime.query';
import { getSignedInUserSnapshot } from '@/infra/platform/auth/session.server';
import { applyBrandToLandingHeaderFooter } from '@/infra/platform/brand/identity';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/infra/platform/brand/placeholders.server';
import { getTranslations } from 'next-intl/server';

import { LocaleDetector } from '@/shared/blocks/common/locale-detector';
import { ConsoleLayout } from '@/shared/blocks/console/layout';
import { PublicAppProvider } from '@/shared/contexts/app';
import { AuthSnapshotProvider } from '@/shared/contexts/auth-snapshot';
import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';
import LandingLayout from '@/themes/default/layouts/landing';

export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('settings.sidebar');
  const tl = await getTranslations('landing');
  const [publicUiConfig, authSettings, billingSettings] = await Promise.all([
    readPublicUiConfigCached(),
    readAuthUiRuntimeSettingsCached(),
    readBillingRuntimeSettingsCached(),
  ]);
  const initialSnapshot = await getSignedInUserSnapshot();
  const brand = buildBrandPlaceholderValues();

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
  });

  return (
    <ScopedIntlProvider
      locale={locale}
      namespaces={[
        'common.sign',
        'common.locale_switcher',
        'common.locale_detector',
        'common.uploader.image',
      ]}
    >
      <PublicAppProvider
        initialUiConfig={publicUiConfig}
        initialAuthSettings={authSettings}
        initialBillingSettings={billingSettings}
      >
        <AuthSnapshotProvider initialSnapshot={initialSnapshot}>
          <LandingLayout
            header={header}
            footer={footer}
            publicConfig={publicUiConfig}
          >
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
