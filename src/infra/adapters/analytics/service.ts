import 'server-only';

import {
  AnalyticsManager,
  ClarityAnalyticsProvider,
  GoogleAnalyticsProvider,
  OpenPanelAnalyticsProvider,
  PlausibleAnalyticsProvider,
} from '@/extensions/analytics';
import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';
import type { Configs } from '@/domains/settings/application/settings-runtime.query';

import { buildServiceFromLatestConfigs } from '@/infra/adapters/config-refresh-policy';

/**
 * get analytics manager with configs
 */
export function getAnalyticsManagerWithConfigs(configs: Configs) {
  const analytics = new AnalyticsManager();

  // google analytics
  if (configs.google_analytics_id) {
    analytics.addProvider(
      new GoogleAnalyticsProvider({ gaId: configs.google_analytics_id })
    );
  }

  // clarity
  if (configs.clarity_id) {
    analytics.addProvider(
      new ClarityAnalyticsProvider({ clarityId: configs.clarity_id })
    );
  }

  // plausible
  if (configs.plausible_domain && configs.plausible_src) {
    analytics.addProvider(
      new PlausibleAnalyticsProvider({
        domain: configs.plausible_domain,
        src: configs.plausible_src,
      })
    );
  }

  // openpanel
  if (configs.openpanel_client_id) {
    analytics.addProvider(
      new OpenPanelAnalyticsProvider({
        clientId: configs.openpanel_client_id,
      })
    );
  }

  return analytics;
}

/**
 * global analytics service
 */
export async function getAnalyticsService(options: {
  mode?: ConfigConsistencyMode;
} = {}): Promise<AnalyticsManager> {
  return await buildServiceFromLatestConfigs(
    getAnalyticsManagerWithConfigs,
    options
  );
}
