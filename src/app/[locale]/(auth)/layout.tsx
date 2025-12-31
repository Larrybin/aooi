// data: envConfigs (app name) + auth shell UI (locale toggle)
// cache: default (no request-bound data; no explicit fetch)
// reason: keep auth pages lightweight; user-specific data starts after sign-in
import { envConfigs } from '@/config';
import { BrandLogo, LocaleSelector } from '@/shared/blocks/common';
import { AppContextProvider } from '@/shared/contexts/app';
import { buildBrandPlaceholderValues } from '@/shared/lib/brand-placeholders.server';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);

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
          <LocaleSelector type="button" />
        </div>
        <div className="w-full px-4">{children}</div>
      </div>
    </AppContextProvider>
  );
}
