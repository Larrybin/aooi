import 'server-only';

import { isAiEnabled } from '@/shared/lib/landing-visibility';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';

export async function isAiEnabledCached(): Promise<boolean> {
  const publicConfigs = await getPublicConfigsCached();
  return isAiEnabled(publicConfigs);
}
