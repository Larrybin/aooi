// data: docs source + public configs (unstable_cache tag=public-configs, revalidate=3600s) + locale param
// cache: cached configs + default RSC
// reason: docs are public; config-gated while keeping db reads cheap
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import type { Translations } from 'fumadocs-ui/i18n';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { RootProvider } from 'fumadocs-ui/provider';

import {
  readDocsPageTree,
  resolveDocsLocale,
} from '@/domains/content/application/docs-content.query';
import { buildBrandPlaceholderValues } from '@/infra/platform/brand/placeholders.server';
import { isLandingDocsEnabled } from '@/surfaces/public/navigation/landing-visibility';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';

import { baseOptions } from './layout.config';

import '@/config/style/docs.css';

const zh: Partial<Translations> = {
  search: '搜索内容',
};

// available languages that will be displayed on UI
// make sure `locale` is consistent with your i18n config
const docsLocales = [
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
  const lang = resolveDocsLocale(locale);
  const brand = buildBrandPlaceholderValues();
  const options = baseOptions(lang, {
    appName: brand.appName,
    appLogo: brand.appLogo,
  });

  return (
    <RootProvider
      theme={{
        forcedTheme: 'light',
        defaultTheme: 'light',
        enableSystem: false,
      }}
      i18n={{
        locale: lang,
        locales: docsLocales,
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
        tree={readDocsPageTree(lang)}
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
