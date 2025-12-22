import { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { getThemeLayout } from '@/core/theme';
import { LocaleDetector } from '@/shared/blocks/common';
import { ConsoleLayout } from '@/shared/blocks/console/layout';
import { AppContextProvider } from '@/shared/contexts/app';
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

  // settings title
  const title = t('title');

  // settings nav
  const nav = t.raw('nav');

  const topNav = t.raw('top_nav');

  const header: HeaderType = tl.raw('header');
  const footer: FooterType = tl.raw('footer');

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
