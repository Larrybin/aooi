import type { Configs } from '@/domains/settings/application/settings-store';

import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';

export async function readServiceConfigsByMode(
  mode: ConfigConsistencyMode = 'cached',
  {
    readSettingsCachedImpl,
    readSettingsFreshImpl,
  }: {
    readSettingsCachedImpl: () => Promise<Configs>;
    readSettingsFreshImpl: () => Promise<Configs>;
  }
): Promise<Configs> {
  return mode === 'fresh'
    ? await readSettingsFreshImpl()
    : await readSettingsCachedImpl();
}
