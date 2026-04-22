// data: landing translations (header/footer) + theme layout
// cache: default (no explicit fetch)
// reason: shared landing shell; keep data loading in leaf pages
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import { LocaleDetector } from '@/shared/blocks/common/locale-detector';
import { PublicAppProvider } from '@/shared/contexts/app';
import { applyBrandToLandingHeaderFooter } from '@/infra/platform/brand/identity';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/infra/platform/brand/placeholders.server';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';
import LandingLayout from '@/themes/default/layouts/landing';

export default async function PageDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('landing');
  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues();

  const header: HeaderType = t.raw('header');
  const footer: FooterType = t.raw('footer');
  const branded = applyBrandToLandingHeaderFooter({
    header: replaceBrandPlaceholdersDeep(header, brand),
    footer: replaceBrandPlaceholdersDeep(footer, brand),
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
        <LandingLayout header={branded.header} footer={branded.footer}>
          <LocaleDetector />
          {children}
        </LandingLayout>
      </PublicAppProvider>
    </ScopedIntlProvider>
  );
}
