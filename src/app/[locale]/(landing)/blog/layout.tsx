import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getThemeLayout } from '@/core/theme';
import { LocaleDetector } from '@/shared/blocks/common';
import { AppContextProvider } from '@/shared/contexts/app';
import { applyBrandToLandingHeaderFooter } from '@/shared/lib/brand-identity';
import { isLandingBlogEnabled } from '@/shared/lib/landing-visibility';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';

export default async function BlogLayout({
  children,
}: {
  children: ReactNode;
}) {
  const publicConfigs = await getPublicConfigsCached();
  if (!isLandingBlogEnabled(publicConfigs)) {
    notFound();
  }

  const t = await getTranslations('landing');
  const Layout = await getThemeLayout('landing');

  const header: HeaderType = t.raw('header');
  const footer: FooterType = t.raw('footer');
  const branded = applyBrandToLandingHeaderFooter({ header, footer });

  return (
    <AppContextProvider>
      <Layout header={branded.header} footer={branded.footer}>
        <LocaleDetector />
        {children}
      </Layout>
    </AppContextProvider>
  );
}
