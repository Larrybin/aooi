import type { MetadataRoute } from 'next';
import { buildBrandPlaceholderValues } from '@/infra/platform/brand/placeholders.server';
import { getSite } from '@/infra/platform/site';
import { buildCanonicalUrl } from '@/infra/url/canonical';

import { locales } from '@/config/locale';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSite();
  buildBrandPlaceholderValues();
  const routes = [
    '/',
    '/pricing',
    ...(site.capabilities.blog ? ['/blog'] : []),
    ...(site.capabilities.docs ? ['/docs'] : []),
  ];
  const lastModified = new Date();

  return locales.flatMap((locale) =>
    routes.map((route) => ({
      url: buildCanonicalUrl(route, locale),
      lastModified,
    }))
  );
}
