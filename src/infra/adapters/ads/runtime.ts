import type { Configs } from '@/domains/settings/application/settings-store';

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

function getNonEmptyConfig(configs: Configs, key: string) {
  return configs[key]?.trim() || '';
}

function getAdsterraZoneSnippetMap(configs: Configs) {
  return {
    landing_inline_primary: getNonEmptyConfig(
      configs,
      'adsterra_zone_landing_inline_primary_snippet'
    ),
    blog_post_inline: getNonEmptyConfig(
      configs,
      'adsterra_zone_blog_post_inline_snippet'
    ),
    blog_post_footer: getNonEmptyConfig(
      configs,
      'adsterra_zone_blog_post_footer_snippet'
    ),
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

function buildAdsenseRuntime(configs: Configs): ResolvedAdsRuntime {
  const clientId = getNonEmptyConfig(configs, 'adsense_client_id');
  if (!clientId) {
    return { enabled: false };
  }

  return buildRuntime(
    'adsense',
    new AdsenseProvider({
      clientId,
      slotIds: {
        landing_inline_primary: getNonEmptyConfig(
          configs,
          'adsense_slot_landing_inline_primary'
        ),
        blog_post_inline: getNonEmptyConfig(
          configs,
          'adsense_slot_blog_post_inline'
        ),
        blog_post_footer: getNonEmptyConfig(
          configs,
          'adsense_slot_blog_post_footer'
        ),
      },
    })
  );
}

function buildAdsterraRuntime(configs: Configs): ResolvedAdsRuntime {
  const mode = getNonEmptyConfig(configs, 'adsterra_mode');
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
    globalSnippet: getNonEmptyConfig(configs, 'adsterra_global_snippet'),
    adsTxtEntry: getNonEmptyConfig(configs, 'adsterra_ads_txt_entry'),
    zoneSnippets: getAdsterraZoneSnippetMap(configs),
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

export function resolveAdsRuntime(configs: Configs): ResolvedAdsRuntime {
  if (getNonEmptyConfig(configs, 'ads_enabled') !== 'true') {
    return { enabled: false };
  }

  const providerName = getNonEmptyConfig(configs, 'ads_provider');
  if (providerName === 'adsense') {
    return buildAdsenseRuntime(configs);
  }

  if (providerName === 'adsterra') {
    return buildAdsterraRuntime(configs);
  }

  return { enabled: false };
}

export function getAdsTxtBody(runtime: ResolvedAdsRuntime) {
  if (!runtime.enabled) {
    return '';
  }

  return runtime.adsTxtEntry || '';
}
