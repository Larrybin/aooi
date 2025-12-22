import 'server-only';

import { unstable_cache } from 'next/cache';

import { getPublicConfigs } from '@/shared/models/config';

export const PUBLIC_CONFIGS_CACHE_TAG = 'public-configs';

export const getPublicConfigsCached = unstable_cache(
  async () => await getPublicConfigs(),
  [PUBLIC_CONFIGS_CACHE_TAG],
  {
    tags: [PUBLIC_CONFIGS_CACHE_TAG],
    revalidate: 60 * 60,
  }
);

