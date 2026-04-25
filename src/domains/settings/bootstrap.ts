import { ALL_SETTINGS } from './registry';
import type { SettingDefinition } from './types';

function serializeDefaultSettingValue(
  value: SettingDefinition['value']
): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return JSON.stringify(value);
}

export function createDefaultSettingsSnapshot(
  settings: readonly SettingDefinition[] = ALL_SETTINGS
): Record<string, string> {
  const snapshot: Record<string, string> = {};

  for (const setting of settings) {
    snapshot[setting.name] = serializeDefaultSettingValue(setting.value);
  }

  return snapshot;
}

export function mergeMissingDefaultSettings({
  current,
  defaults = createDefaultSettingsSnapshot(),
}: {
  current: Record<string, string>;
  defaults?: Record<string, string>;
}): Record<string, string> {
  const missing: Record<string, string> = {};

  for (const [name, value] of Object.entries(defaults)) {
    if (!(name in current)) {
      missing[name] = value;
    }
  }

  return missing;
}
