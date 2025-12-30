import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import type { Translations } from 'fumadocs-ui/i18n';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { RootProvider } from 'fumadocs-ui/provider';

import { source } from '@/core/docs/source';
import { isLandingDocsEnabled } from '@/shared/lib/landing-visibility';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';
import { buildBrandPlaceholderValues } from '@/shared/lib/brand-placeholders.server';

import { baseOptions } from './layout.config';

import '@/config/style/docs.css';

const zh: Partial<Translations> = {
  search: '搜索内容',
};
// available languages that will be displayed on UI
// make sure `locale` is consistent with your i18n config
const locales = [
  {
    name: 'English',
    locale: 'en',
  },
  {
    name: '简体中文',
    locale: 'zh',
  },
];

export default async function DocsRootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale?: string }>;
}) {
  const publicConfigs = await getPublicConfigsCached();
  if (!isLandingDocsEnabled(publicConfigs)) {
    notFound();
  }

  const { locale } = await params;
  const lang = locale || 'en';
  const brand = buildBrandPlaceholderValues(publicConfigs);
  const options = baseOptions(lang, { appName: brand.appName });

  return (
    <RootProvider
      i18n={{
        locale: lang,
        locales,
        translations: { zh }[lang],
      }}
      search={{
        options: {
          api: '/api/docs/search',
        },
      }}
    >
      <DocsLayout
        {...options}
        tree={source.pageTree[lang]}
        nav={{ ...options.nav, mode: 'top' }}
        sidebar={{
          tabs: [],
        }}
        tabMode="sidebar"
      >
        <main role="main">{children}</main>
      </DocsLayout>
    </RootProvider>
  );
}
