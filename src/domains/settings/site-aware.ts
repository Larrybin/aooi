import { site } from '@/site';
import { getTranslations } from 'next-intl/server';

import {
  resolveSitePaymentCapability,
  type PaymentCapability,
} from '@/config/payment-capability';

import {
  ALL_SETTINGS,
  getSettingDefinition,
  getSettingGroupsFromDefinitions,
} from './registry';
import type { SettingTabName } from './tab-names';
import type { SettingDefinition } from './types';

function isPaymentSettingEnabled(
  setting: SettingDefinition,
  paymentCapability: PaymentCapability
) {
  if (paymentCapability === 'none') {
    return false;
  }

  return setting.group.id === paymentCapability;
}

function filterSiteAwarePaymentSettings() {
  const paymentCapability = resolveSitePaymentCapability();

  return ALL_SETTINGS.filter((setting) => {
    if (setting.tab !== 'payment') {
      return true;
    }

    return isPaymentSettingEnabled(setting, paymentCapability);
  });
}

/**
 * Capability filtering used to stop at the rendered form, which made "the admin
 * cannot see the field" the only thing keeping a disabled capability disabled.
 * The write path asks here so a hand-crafted submit cannot persist a key the
 * site does not carry.
 */
export function isSiteEnabledSettingKey(name: string) {
  const setting = getSettingDefinition(name);
  if (!setting) {
    return false;
  }

  if (setting.tab === 'payment') {
    return isPaymentSettingEnabled(setting, resolveSitePaymentCapability());
  }

  if (setting.moduleId === 'ai') {
    return Boolean(site.capabilities.ai);
  }

  return true;
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
