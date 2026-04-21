import 'server-only';

import { isAiEnabled } from '@/surfaces/public/navigation/landing-visibility';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';

export async function isAiEnabledCached(): Promise<boolean> {
  const publicConfigs = await getPublicConfigsCached();
  return isAiEnabled(publicConfigs);
}
