import 'server-only';

import {
  AffiliateManager,
  AffonsoAffiliateProvider,
  PromoteKitAffiliateProvider,
} from '@/extensions/affiliate';
import type { Configs } from '@/shared/models/config';

import { buildServiceFromLatestConfigs } from './config_refresh_policy';

/**
 * get affiliate manager with configs
 */
export function getAffiliateManagerWithConfigs(configs: Configs) {
  const affiliateManager: AffiliateManager = new AffiliateManager();

  // affonso
  if (configs.affonso_enabled === 'true' && configs.affonso_id) {
    affiliateManager.addProvider(
      new AffonsoAffiliateProvider({
        affonsoId: configs.affonso_id,
        cookieDuration: Number(configs.affonso_cookie_duration) ?? 30,
      })
    );
  }

  // promotekit
  if (configs.promotekit_enabled === 'true' && configs.promotekit_id) {
    affiliateManager.addProvider(
      new PromoteKitAffiliateProvider({ promotekitId: configs.promotekit_id })
    );
  }

  return affiliateManager;
}

/**
 * global affiliate service
 */
export async function getAffiliateService(): Promise<AffiliateManager> {
  return await buildServiceFromLatestConfigs(getAffiliateManagerWithConfigs);
}
