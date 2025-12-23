import { ReactNode } from 'react';

import { AnalyticsConfigs, AnalyticsProvider } from '.';
import { VercelAnalyticsClient } from './vercel-analytics-client';

type Mode = 'auto' | 'development' | 'production';

/**
 * Vercel analytics configs
 * @docs https://vercel.com/docs/analytics/quickstart
 */
export interface VercelAnalyticsConfigs extends AnalyticsConfigs {
  mode?: Mode;
  debug?: boolean;
}

/**
 * Vercel analytics provider
 * @website https://vercel.com/
 */
export class VercelAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'vercel-analytics';

  configs: VercelAnalyticsConfigs;

  constructor(configs: VercelAnalyticsConfigs) {
    this.configs = configs;
  }

  getHeadScripts(): ReactNode {
    return null;
  }

  getBodyScripts(): ReactNode {
    return (
      <VercelAnalyticsClient
        mode={this.configs.mode}
        debug={this.configs.debug}
      />
    );
  }

  getMetaTags(): ReactNode {
    return null;
  }
}
