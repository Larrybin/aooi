import {
  defineCloudflareConfig,
  type OpenNextConfig,
} from '@opennextjs/cloudflare';

import {
  CLOUDFLARE_SPLIT_WORKER_TARGETS,
  getSplitWorker,
} from './src/shared/config/cloudflare-worker-splits';

const baseConfig = defineCloudflareConfig();

const config: OpenNextConfig = {
  ...baseConfig,
  default: {
    ...baseConfig.default,
    placement: 'regional',
    runtime: 'node',
  },
  functions: Object.fromEntries(
    CLOUDFLARE_SPLIT_WORKER_TARGETS.map((target) => {
      const split = getSplitWorker(target);

      return [
        target,
        {
          ...baseConfig.default,
          placement: 'regional',
          runtime: 'node',
          routes: [...split.routeTemplates],
          patterns: [...split.patterns],
        },
      ];
    })
  ),
  middleware:
    baseConfig.middleware && 'external' in baseConfig.middleware
      ? {
          ...baseConfig.middleware,
          originResolver: 'pattern-env',
        }
      : baseConfig.middleware,
};

export default config;
