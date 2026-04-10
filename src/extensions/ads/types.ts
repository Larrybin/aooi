import type { ReactNode } from 'react';

export type AdsProviderName = 'adsense' | 'adsterra';

export type AdsZoneName =
  | 'landing_inline_primary'
  | 'blog_post_inline'
  | 'blog_post_footer';

export type AdsPageType = 'landing' | 'blog-detail';

export interface AdsZoneContext {
  zone: AdsZoneName;
  pageType: AdsPageType;
}

export interface AdsProvider {
  readonly name: AdsProviderName;
  getMetaTags(): ReactNode;
  getHeadScripts(): ReactNode;
  getBodyScripts(): ReactNode;
  supportsZone(zone: AdsZoneName): boolean;
  renderZone(context: AdsZoneContext): ReactNode;
  getAdsTxtEntry(): string | null;
}
