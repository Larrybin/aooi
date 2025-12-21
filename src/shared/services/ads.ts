import 'server-only';

import { AdsenseProvider, AdsManager } from '@/extensions/ads';
import type { Configs } from '@/shared/models/config';

import { buildServiceFromLatestConfigs } from './config_refresh_policy';

/**
 * get ads manager with configs
 */
export function getAdsManagerWithConfigs(configs: Configs) {
  const ads = new AdsManager();

  // adsense
  if (configs.adsense_code) {
    ads.addProvider(new AdsenseProvider({ adId: configs.adsense_code }));
  }

  return ads;
}

/**
 * global ads service
 */
export async function getAdsService(): Promise<AdsManager> {
  return await buildServiceFromLatestConfigs(getAdsManagerWithConfigs);
}
