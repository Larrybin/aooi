import type { AdsPageType, AdsZoneContext, AdsZoneName } from './types';

export const ADS_ZONES = {
  landing_inline_primary: {
    pageType: 'landing',
    title: 'Landing Inline Primary',
  },
  blog_post_inline: {
    pageType: 'blog-detail',
    title: 'Blog Post Inline',
  },
  blog_post_footer: {
    pageType: 'blog-detail',
    title: 'Blog Post Footer',
  },
} as const satisfies Record<
  AdsZoneName,
  {
    pageType: AdsPageType;
    title: string;
  }
>;

export const ADS_ZONE_NAMES = Object.keys(ADS_ZONES) as AdsZoneName[];

export function isAdsZoneName(value: string): value is AdsZoneName {
  return value in ADS_ZONES;
}

export function getAdsZoneContext(zone: AdsZoneName): AdsZoneContext {
  return {
    zone,
    pageType: ADS_ZONES[zone].pageType,
  };
}
