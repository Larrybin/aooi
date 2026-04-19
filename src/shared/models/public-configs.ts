import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';
import { PUBLIC_SETTING_NAMES } from '@/shared/services/settings/registry';

type ConfigMap = Record<string, string>;

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
    getAllConfigsSafeImpl,
    getAllConfigsFreshImpl,
  }: {
    getAllConfigsSafeImpl: () => Promise<{
      configs: ConfigMap;
      error?: Error;
    }>;
    getAllConfigsFreshImpl: () => Promise<ConfigMap>;
  }
): Promise<ConfigMap> {
  if (mode === 'fresh') {
    return buildPublicConfigs(await getAllConfigsFreshImpl());
  }

  const { configs } = await getAllConfigsSafeImpl();
  return buildPublicConfigs(configs);
}
