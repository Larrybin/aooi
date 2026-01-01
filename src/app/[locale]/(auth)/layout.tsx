// data: envConfigs (app name) + auth shell UI (locale toggle)
// cache: default (no request-bound data; no explicit fetch)
// reason: keep auth pages lightweight; user-specific data starts after sign-in
import { setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { BrandLogo, LocaleSelector } from '@/shared/blocks/common';
import { AppContextProvider } from '@/shared/contexts/app';
import { buildBrandPlaceholderValues } from '@/shared/lib/brand-placeholders.server';
import { isConfigTrue } from '@/shared/lib/general-ui.client';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);
  const isLocaleSwitcherEnabled = isConfigTrue(
    publicConfigs,
    'general_locale_switcher_enabled'
  );

  const appName = brand.appName || envConfigs.app_name;
  return (
    <AppContextProvider>
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="absolute top-4 left-4">
          <BrandLogo
            brand={{
              title: appName,
              logo: {
                src: '/logo.png',
                alt: appName,
              },
              url: '/',
              target: '_self',
              className: '',
            }}
          />
        </div>
        <div className="absolute top-4 right-4 flex items-center gap-4">
          {isLocaleSwitcherEnabled ? <LocaleSelector type="button" /> : null}
        </div>
        <div className="w-full px-4">{children}</div>
      </div>
    </AppContextProvider>
  );
}
