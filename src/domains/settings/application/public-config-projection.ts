import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';
import type { PublicUiConfig } from './settings-runtime.contracts';
import { buildPublicUiConfig } from './settings-runtime.builders';
import type { Configs } from './settings-store';

export function buildPublicUiProjection(configs: Configs): PublicUiConfig {
  return buildPublicUiConfig(configs);
}

export async function readPublicUiConfigByMode(
  mode: ConfigConsistencyMode,
  {
    readSettingsSafeImpl,
    readSettingsFreshImpl,
  }: {
    readSettingsSafeImpl: () => Promise<{
      configs: Configs;
      error?: Error;
    }>;
    readSettingsFreshImpl: () => Promise<Configs>;
  }
): Promise<PublicUiConfig> {
  if (mode === 'fresh') {
    return buildPublicUiProjection(await readSettingsFreshImpl());
  }

  const { configs } = await readSettingsSafeImpl();
  return buildPublicUiProjection(configs);
}
