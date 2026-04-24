import { getTranslations } from 'next-intl/server';

import type { Tab } from '@/shared/types/blocks/common';

import { SETTING_TAB_NAMES, type SettingTabName } from './tab-names';
import { getAvailableSettingTabs } from './index';

export async function getSettingTabs(tab: SettingTabName) {
  const t = await getTranslations('admin.settings');
  const availableTabs = await getAvailableSettingTabs();

  const tabs: Tab[] = SETTING_TAB_NAMES.filter((name) =>
    availableTabs.includes(name)
  ).map((name) => ({
    name,
    title: t(`edit.tabs.${name}`),
    url: `/admin/settings/${name}`,
    is_active: tab === name,
  }));

  return tabs;
}
