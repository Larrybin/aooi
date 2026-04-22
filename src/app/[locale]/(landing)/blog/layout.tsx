// data: public configs (unstable_cache tag=public-configs, revalidate=3600s) + landing translations + theme layout
// cache: cached configs + default RSC
// reason: public blog is config-gated; keep db reads cheap
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
import { isLandingBlogEnabled } from '@/surfaces/public/navigation/landing-visibility';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';
import LandingLayout from '@/themes/default/layouts/landing';

export default async function BlogLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const publicConfigs = await getPublicConfigsCached();
  if (!isLandingBlogEnabled(publicConfigs)) {
    notFound();
  }

  const t = await getTranslations('landing');
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
        'blog.page',
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
