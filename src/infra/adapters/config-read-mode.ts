import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';

type ConfigMap = Record<string, string>;

export async function readServiceConfigsByMode(
  mode: ConfigConsistencyMode = 'cached',
  {
    readRuntimeSettingsCachedImpl,
    readRuntimeSettingsFreshImpl,
  }: {
    readRuntimeSettingsCachedImpl: () => Promise<ConfigMap>;
    readRuntimeSettingsFreshImpl: () => Promise<ConfigMap>;
  }
): Promise<ConfigMap> {
  return mode === 'fresh'
    ? await readRuntimeSettingsFreshImpl()
    : await readRuntimeSettingsCachedImpl();
}
