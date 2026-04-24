// data: server public env configs (app name) + auth shell UI (locale toggle)
// cache: default (no request-bound data; no explicit fetch)
// reason: keep auth pages lightweight; user-specific data starts after sign-in
import { readPublicUiConfigCached } from '@/domains/settings/application/settings-runtime.query';
import { buildBrandPlaceholderValues } from '@/infra/platform/brand/placeholders.server';
import { setRequestLocale } from 'next-intl/server';

import { BrandLogo } from '@/shared/blocks/common/brand-logo';
import { LocaleSelector } from '@/shared/blocks/common/locale-selector';
import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const publicUiConfig = await readPublicUiConfigCached();
  const brand = buildBrandPlaceholderValues();
  const isLocaleSwitcherEnabled = publicUiConfig.localeSwitcherEnabled;

  const appName = brand.appName;
  return (
    <ScopedIntlProvider
      locale={locale}
      namespaces={['common.sign', 'common.locale_switcher']}
    >
      <div className="bg-muted/45 relative min-h-screen">
        <div className="absolute top-4 left-4">
          <BrandLogo
            brand={{
              title: appName,
              logo: {
                src: brand.appLogo,
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

        <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-20 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10">
          <div className="hidden lg:block">
            <div className="max-w-md space-y-6">
              <p className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
                Welcome back
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-balance">
                Sign in to the product surface, not another empty starter repo.
              </h1>
              <p className="text-muted-foreground text-base leading-7">
                Keep auth, billing, credits, and docs in one place. The goal is
                simple, get back to shipping.
              </p>
              <div className="grid gap-3 pt-2">
                {[
                  'Auth and payment flows already wired',
                  'Clean app shell with marketing and docs',
                  'Built to launch the first real version fast',
                ].map((item) => (
                  <div
                    key={item}
                    className="bg-background/75 border-border/80 rounded-2xl border px-4 py-3 text-sm shadow-sm"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="w-full px-0 lg:px-4">{children}</div>
        </div>
      </div>
    </ScopedIntlProvider>
  );
}
