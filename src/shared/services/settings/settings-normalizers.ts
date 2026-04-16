import { getSettingDefinition } from './registry';
import type { NormalizedSettingValueResult } from './types';

type NormalizeSettingOverridesResult =
  | { ok: true; value: Record<string, string> }
  | { ok: false; error: string };

export function normalizeSettingOverrides(
  values: Record<string, string>
): NormalizeSettingOverridesResult {
  const overrides: Record<string, string> = {};

  for (const [name, value] of Object.entries(values)) {
    const setting = getSettingDefinition(name);
    if (!setting) {
      continue;
    }

    let nextValue = value;

    if (setting.normalizer) {
      const result: NormalizedSettingValueResult = setting.normalizer(nextValue);
      if (!result.ok) {
        return result;
      }
      nextValue = result.value;
      overrides[name] = nextValue;
    }

    if (setting.validator) {
      const result = setting.validator(nextValue);
      if (!result.ok) {
        return result;
      }
    }
  }

  return { ok: true, value: overrides };
}
