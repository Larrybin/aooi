import type { MetadataRoute } from 'next';

import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';
import {
  isLandingBlogEnabled,
  isLandingDocsEnabled,
} from '@/shared/lib/landing-visibility';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';

function stripTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function buildUrl(pathname: string, locale: string) {
  const appUrl = stripTrailingSlash(envConfigs.app_url);
  const localePrefix = locale === defaultLocale ? '' : `/${locale}`;

  if (pathname === '/') {
    return localePrefix ? `${appUrl}${localePrefix}` : `${appUrl}/`;
  }

  return `${appUrl}${localePrefix}${pathname}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicConfigs = await getPublicConfigsCached();
  const routes = [
    '/',
    '/pricing',
    ...(isLandingBlogEnabled(publicConfigs) ? ['/blog'] : []),
    ...(isLandingDocsEnabled(publicConfigs) ? ['/docs'] : []),
  ];
  const lastModified = new Date();

  return locales.flatMap((locale) =>
    routes.map((route) => ({
      url: buildUrl(route, locale),
      lastModified,
    }))
  );
}
