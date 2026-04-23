import type { MetadataRoute } from 'next';

import { locales } from '@/config/locale';
import { buildBrandPlaceholderValues } from '@/infra/platform/brand/placeholders.server';
import { buildCanonicalUrl } from '@/infra/url/canonical';
import {
  isLandingBlogEnabled,
  isLandingDocsEnabled,
} from '@/surfaces/public/navigation/landing-visibility';
import { readPublicUiConfigCached } from '@/domains/settings/application/settings-runtime.query';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicConfig = await readPublicUiConfigCached();
  buildBrandPlaceholderValues();
  const routes = [
    '/',
    '/pricing',
    ...(isLandingBlogEnabled(publicConfig) ? ['/blog'] : []),
    ...(isLandingDocsEnabled(publicConfig) ? ['/docs'] : []),
  ];
  const lastModified = new Date();

  return locales.flatMap((locale) =>
    routes.map((route) => ({
      url: buildCanonicalUrl(route, locale),
      lastModified,
    }))
  );
}
