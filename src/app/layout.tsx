// data: cached settings (env + db runtime projection) + injected ads/analytics tags
// cache: static shell; db configs cached via unstable_cache (tag=db-configs, revalidate=60s)
// reason: keep the root html shell statically analyzable; locale-specific state lives under app/[locale]
import '@/config/style/global.css';

import { defaultLocale, isRtlLocale } from '@/config/locale';

import { resolveRootRuntimeInjectionsForServer } from './root-runtime-injections.server';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const {
    adsMetaTags,
    adsHeadScripts,
    adsBodyScripts,
    analyticsMetaTags,
    analyticsHeadScripts,
    analyticsBodyScripts,
    affiliateMetaTags,
    affiliateHeadScripts,
    affiliateBodyScripts,
    customerServiceMetaTags,
    customerServiceHeadScripts,
    customerServiceBodyScripts,
  } = await resolveRootRuntimeInjectionsForServer();

  return (
    <html
      lang={defaultLocale}
      dir={isRtlLocale(defaultLocale) ? 'rtl' : 'ltr'}
      suppressHydrationWarning
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        {/* inject ads meta tags */}
        {adsMetaTags}
        {/* inject ads head scripts */}
        {adsHeadScripts}

        {/* inject analytics meta tags */}
        {analyticsMetaTags}
        {/* inject analytics head scripts */}
        {analyticsHeadScripts}

        {/* inject affiliate meta tags */}
        {affiliateMetaTags}
        {/* inject affiliate head scripts */}
        {affiliateHeadScripts}

        {/* inject customer service meta tags */}
        {customerServiceMetaTags}
        {/* inject customer service head scripts */}
        {customerServiceHeadScripts}
      </head>
      <body suppressHydrationWarning className="overflow-x-hidden">
        {children}

        {/* inject ads body scripts */}
        {adsBodyScripts}

        {/* inject analytics body scripts */}
        {analyticsBodyScripts}

        {/* inject affiliate body scripts */}
        {affiliateBodyScripts}

        {/* inject customer service body scripts */}
        {customerServiceBodyScripts}
      </body>
    </html>
  );
}
