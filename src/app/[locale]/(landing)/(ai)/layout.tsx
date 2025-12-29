// data: landing translations (header/footer) + theme layout
// cache: default (no explicit fetch)
// reason: shared public shell; keep data loading in leaf pages
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { getThemeLayout } from '@/core/theme';
import { LocaleDetector } from '@/shared/blocks/common';
import { AppContextProvider } from '@/shared/contexts/app';
import { applyBrandToLandingHeaderFooter } from '@/shared/lib/brand-identity';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';

export default async function LandingAiLayout({
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
        <LocaleDetector />
        {children}
      </Layout>
    </AppContextProvider>
  );
}
