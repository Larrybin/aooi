import type { MetadataRoute } from 'next';

import { defaultLocale, locales } from '@/config/locale';
import { buildBrandPlaceholderValues } from '@/shared/lib/brand-placeholders.server';
import {
  isLandingBlogEnabled,
  isLandingDocsEnabled,
} from '@/shared/lib/landing-visibility';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';
import { getServerPublicEnvConfigs } from '@/infra/runtime/env.server';

function stripTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function buildUrl(pathname: string, locale: string, appUrl: string) {
  const baseUrl = stripTrailingSlash(appUrl);
  const localePrefix = locale === defaultLocale ? '' : `/${locale}`;

  if (pathname === '/') {
    return localePrefix ? `${baseUrl}${localePrefix}` : `${baseUrl}/`;
  }

  return `${baseUrl}${localePrefix}${pathname}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicConfigs = await getPublicConfigsCached();
  const serverPublicEnvConfigs = getServerPublicEnvConfigs();
  const brand = buildBrandPlaceholderValues(publicConfigs);
  const routes = [
    '/',
    '/pricing',
    ...(isLandingBlogEnabled(publicConfigs) ? ['/blog'] : []),
    ...(isLandingDocsEnabled(publicConfigs) ? ['/docs'] : []),
  ];
  const lastModified = new Date();

  return locales.flatMap((locale) =>
    routes.map((route) => ({
      url: buildUrl(route, locale, brand.appUrl || serverPublicEnvConfigs.app_url),
      lastModified,
    }))
  );
}
