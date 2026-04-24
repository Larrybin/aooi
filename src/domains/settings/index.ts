import {
  ALL_SETTINGS,
  getSettingGroupsFromDefinitions,
} from './registry';
import { resolveSitePaymentCapability } from '@/config/payment-capability';
import type { SettingTabName } from './tab-names';
import { getTranslations } from 'next-intl/server';

export type { SettingDefinition, SettingGroup } from './types';
export {
  ALL_SETTINGS,
  KNOWN_SETTING_KEYS,
  PUBLIC_SETTING_NAMES,
  SETTING_DEFINITION_BY_NAME,
  SETTING_GROUP_REGISTRY,
  getSettingDefinition,
  getSettingGroupsFromRegistry,
  isKnownSettingKey,
  publicSettingNames,
  type KnownSettingKey,
  type PublicSettingKey,
} from './registry';
export { getSettingTabs } from './tabs';
export { mapSettingsToForms } from './settings-form-mapper';
export { normalizeSettingOverrides } from './settings-normalizers';

function filterSiteAwarePaymentSettings() {
  const paymentCapability = resolveSitePaymentCapability();

  return ALL_SETTINGS.filter((setting) => {
    if (setting.tab !== 'payment') {
      return true;
    }

    if (paymentCapability === 'none') {
      return false;
    }

    return setting.group.id === paymentCapability;
  });
}

export async function getSettings() {
  return filterSiteAwarePaymentSettings();
}

export async function getSettingGroups() {
  const settings = await getSettings();
  const t = await getTranslations('admin.settings');
  return getSettingGroupsFromDefinitions(settings, (key) => t(key));
}

export async function getAvailableSettingTabs(): Promise<SettingTabName[]> {
  const settings = await getSettings();
  return [
    ...new Set(settings.map((setting) => setting.tab)),
  ] as SettingTabName[];
}
