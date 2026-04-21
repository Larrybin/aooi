// data: landing translations (header/footer) + theme layout + public configs (unstable_cache tag=public-configs, revalidate=3600s)
// cache: cached configs + default RSC
// reason: share the landing shell for AI demo pages; gate access via config
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import { LocaleDetector } from '@/shared/blocks/common/locale-detector';
import { PublicAppProvider } from '@/shared/contexts/app';
import { applyBrandToLandingHeaderFooter } from '@/infra/platform/brand/identity';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/infra/platform/brand/placeholders.server';
import { isAiEnabled } from '@/surfaces/public/navigation/landing-visibility';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';
import LandingLayout from '@/themes/default/layouts/landing';

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
        <LandingLayout header={header} footer={footer}>
          <LocaleDetector />
          {children}
        </LandingLayout>
      </PublicAppProvider>
    </ScopedIntlProvider>
  );
}
