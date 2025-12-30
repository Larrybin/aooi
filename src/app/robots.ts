import type { MetadataRoute } from 'next';

import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';
import { buildBrandPlaceholderValues } from '@/shared/lib/brand-placeholders.server';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';

function stripTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);
  const appUrl = stripTrailingSlash(brand.appUrl || envConfigs.app_url);
  const protectedRoots = ['/admin', '/changanpenpen', '/settings', '/activity'];

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
