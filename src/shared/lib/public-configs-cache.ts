import 'server-only';

import { getPublicConfigs } from '@/shared/models/config';
import { unstable_cache } from '@/shared/lib/next-cache';

export const PUBLIC_CONFIGS_CACHE_TAG = 'public-configs';

export const getPublicConfigsCached = unstable_cache(
  async () => await getPublicConfigs(),
  [PUBLIC_CONFIGS_CACHE_TAG],
  {
    tags: [PUBLIC_CONFIGS_CACHE_TAG],
    revalidate: 60 * 60,
  }
);
