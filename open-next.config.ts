import {
  defineCloudflareConfig,
  type OpenNextConfig,
} from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';
import doQueue from '@opennextjs/cloudflare/overrides/queue/do-queue';
import doShardedTagCache from '@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache';

import {
  CLOUDFLARE_SPLIT_WORKER_TARGETS,
  getSplitWorker,
} from './src/shared/config/cloudflare-worker-splits';

const disableTagCacheForAdminSettingsSmoke =
  process.env.CF_ADMIN_SETTINGS_SMOKE_DISABLE_TAG_CACHE === 'true';

const baseConfig = defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  tagCache: disableTagCacheForAdminSettingsSmoke ? 'dummy' : doShardedTagCache(),
  queue: doQueue,
});

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
