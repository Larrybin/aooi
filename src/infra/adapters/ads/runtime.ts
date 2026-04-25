import type { AdsRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';

import { AdsenseProvider } from '@/extensions/ads/adsense';
import { AdsterraProvider } from '@/extensions/ads/adsterra';
import {
  type AdsProvider,
  type AdsProviderName,
  type AdsZoneName,
} from '@/extensions/ads/types';
import { ADS_ZONE_NAMES } from '@/extensions/ads/zones';

export type ResolvedAdsRuntime =
  | { enabled: false }
  | {
      enabled: true;
      providerName: AdsProviderName;
      provider: AdsProvider;
      supportedZones: ReadonlySet<AdsZoneName>;
      adsTxtEntry: string | null;
    };

function getAdsterraZoneSnippetMap(settings: AdsRuntimeSettings) {
  return {
    landing_inline_primary: settings.adsterraZoneLandingInlinePrimarySnippet,
    blog_post_inline: settings.adsterraZoneBlogPostInlineSnippet,
    blog_post_footer: settings.adsterraZoneBlogPostFooterSnippet,
  } satisfies Partial<Record<AdsZoneName, string>>;
}

function collectSupportedZones(provider: AdsProvider) {
  return new Set(ADS_ZONE_NAMES.filter((zone) => provider.supportsZone(zone)));
}

function buildRuntime(providerName: AdsProviderName, provider: AdsProvider) {
  return {
    enabled: true as const,
    providerName,
    provider,
    supportedZones: collectSupportedZones(provider),
    adsTxtEntry: provider.getAdsTxtEntry(),
  };
}

function buildAdsenseRuntime(settings: AdsRuntimeSettings): ResolvedAdsRuntime {
  const clientId = settings.adsenseClientId;
  if (!clientId) {
    return { enabled: false };
  }

  return buildRuntime(
    'adsense',
    new AdsenseProvider({
      clientId,
      slotIds: {
        landing_inline_primary: settings.adsenseSlotLandingInlinePrimary,
        blog_post_inline: settings.adsenseSlotBlogPostInline,
        blog_post_footer: settings.adsenseSlotBlogPostFooter,
      },
    })
  );
}

function buildAdsterraRuntime(
  settings: AdsRuntimeSettings
): ResolvedAdsRuntime {
  const mode = settings.adsterraMode;
  if (
    mode !== 'social_bar' &&
    mode !== 'popunder' &&
    mode !== 'native_banner' &&
    mode !== 'display_banner'
  ) {
    return { enabled: false };
  }

  const provider = new AdsterraProvider({
    mode,
    globalSnippet: settings.adsterraGlobalSnippet,
    adsTxtEntry: settings.adsterraAdsTxtEntry,
    zoneSnippets: getAdsterraZoneSnippetMap(settings),
  });

  if (
    (mode === 'social_bar' || mode === 'popunder') &&
    !provider.getHeadScripts() &&
    !provider.getBodyScripts()
  ) {
    return { enabled: false };
  }

  if (
    (mode === 'native_banner' || mode === 'display_banner') &&
    ADS_ZONE_NAMES.every((zone) => !provider.supportsZone(zone))
  ) {
    return { enabled: false };
  }

  return buildRuntime('adsterra', provider);
}

export function resolveAdsRuntime(
  settings: AdsRuntimeSettings
): ResolvedAdsRuntime {
  if (!settings.adsEnabled) {
    return { enabled: false };
  }

  const providerName = settings.adsProvider;
  if (providerName === 'adsense') {
    return buildAdsenseRuntime(settings);
  }

  if (providerName === 'adsterra') {
    return buildAdsterraRuntime(settings);
  }

  return { enabled: false };
}

export function getAdsTxtBody(runtime: ResolvedAdsRuntime) {
  if (!runtime.enabled) {
    return '';
  }

  return runtime.adsTxtEntry || '';
}
