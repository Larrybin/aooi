import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { getThemeLayout } from '@/core/theme';
import { LocaleDetector } from '@/shared/blocks/common';
import { AppContextProvider } from '@/shared/contexts/app';
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

  const header: HeaderType = t.raw('header');
  const footer: FooterType = t.raw('footer');

  return (
    <AppContextProvider>
      <Layout header={header} footer={footer}>
        <LocaleDetector />
        {children}
      </Layout>
    </AppContextProvider>
  );
}
