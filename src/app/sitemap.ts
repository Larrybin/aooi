import type { MetadataRoute } from 'next';

import { locales } from '@/config/locale';
import { buildBrandPlaceholderValues } from '@/infra/platform/brand/placeholders.server';
import { buildCanonicalUrl } from '@/infra/url/canonical';
import {
  isLandingBlogEnabled,
  isLandingDocsEnabled,
} from '@/surfaces/public/navigation/landing-visibility';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicConfigs = await getPublicConfigsCached();
  buildBrandPlaceholderValues();
  const routes = [
    '/',
    '/pricing',
    ...(isLandingBlogEnabled(publicConfigs) ? ['/blog'] : []),
    ...(isLandingDocsEnabled(publicConfigs) ? ['/docs'] : []),
  ];
  const lastModified = new Date();

  return locales.flatMap((locale) =>
    routes.map((route) => ({
      url: buildCanonicalUrl(route, locale),
      lastModified,
    }))
  );
}
