import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';
import { PUBLIC_SETTING_NAMES } from '@/domains/settings/registry';

export type ConfigMap = Record<string, string>;

export function buildPublicConfigs(allConfigs: ConfigMap): ConfigMap {
  const publicConfigs: Record<string, string> = {};

  for (const key of PUBLIC_SETTING_NAMES) {
    const value = allConfigs[key];
    if (value !== undefined) {
      publicConfigs[key] = value;
    }
  }

  return publicConfigs;
}

export async function readPublicConfigsByMode(
  mode: ConfigConsistencyMode,
  {
    readRuntimeSettingsSafeImpl,
    readRuntimeSettingsFreshImpl,
  }: {
    readRuntimeSettingsSafeImpl: () => Promise<{
      configs: ConfigMap;
      error?: Error;
    }>;
    readRuntimeSettingsFreshImpl: () => Promise<ConfigMap>;
  }
): Promise<ConfigMap> {
  if (mode === 'fresh') {
    return buildPublicConfigs(await readRuntimeSettingsFreshImpl());
  }

  const { configs } = await readRuntimeSettingsSafeImpl();
  return buildPublicConfigs(configs);
}
