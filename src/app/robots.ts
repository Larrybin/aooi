import type { MetadataRoute } from 'next';

import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';

function stripTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

export default function robots(): MetadataRoute.Robots {
  const appUrl = stripTrailingSlash(envConfigs.app_url);
  const protectedRoots = ['/admin', '/settings', '/activity'];

  const disallow = uniqueStrings([
    '/*?*q=',
    '/privacy-policy',
    '/terms-of-service',
    ...protectedRoots.flatMap((root) => {
      const localePrefixed = locales
        .filter((locale) => locale !== defaultLocale)
        .map((locale) => `/${locale}${root}`);

      return [
        root,
        `${root}/`,
        ...localePrefixed,
        ...localePrefixed.map((p) => `${p}/`),
      ];
    }),
  ]);

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow,
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
