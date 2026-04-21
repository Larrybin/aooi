import { applyGeneralSettingsRuntimeValues } from './definitions/general';
import { ALL_SETTINGS } from './registry';

export type { SettingDefinition, SettingGroup } from './types';
export {
  ALL_SETTINGS,
  KNOWN_SETTING_KEYS,
  PUBLIC_SETTING_NAMES,
  SETTING_DEFINITION_BY_NAME,
  SETTING_GROUP_REGISTRY,
  getSettingDefinition,
  getSettingGroups,
  getSettingGroupsFromRegistry,
  isKnownSettingKey,
  publicSettingNames,
  type KnownSettingKey,
  type PublicSettingKey,
} from './registry';
export { getSettingTabs } from './tabs';
export { mapSettingsToForms } from './settings-form-mapper';
export { normalizeSettingOverrides } from './settings-normalizers';

export async function getSettings() {
  return applyGeneralSettingsRuntimeValues(ALL_SETTINGS);
}
