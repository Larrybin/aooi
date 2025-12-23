import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { getThemeLayout } from '@/core/theme/landing';
import { LocaleDetectorLazy } from '@/shared/blocks/common/locale-detector-lazy';
import { AppContextProvider } from '@/shared/contexts/app';
import { applyBrandToLandingHeaderFooter } from '@/shared/lib/brand-identity';
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
  const branded = applyBrandToLandingHeaderFooter({ header, footer });

  return (
    <AppContextProvider>
      <Layout header={branded.header} footer={branded.footer}>
        <LocaleDetectorLazy />
        {children}
      </Layout>
    </AppContextProvider>
  );
}
