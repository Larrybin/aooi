import type { Configs } from '@/domains/settings/application/settings-store';

import { isKnownSettingKey } from './registry';

export function mergeRegisteredSettingValues({
  initialConfigs,
  values,
  normalizedOverrides,
}: {
  initialConfigs: Configs;
  values: Record<string, string>;
  normalizedOverrides: Record<string, string>;
}) {
  const nextConfigs: Configs = { ...initialConfigs };

  for (const [name, value] of Object.entries(values)) {
    if (!isKnownSettingKey(name)) {
      continue;
    }

    nextConfigs[name] = normalizedOverrides[name] ?? value;
  }

  return nextConfigs;
}
