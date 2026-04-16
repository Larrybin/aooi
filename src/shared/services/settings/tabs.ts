import { getTranslations } from 'next-intl/server';

import type { Tab } from '@/shared/types/blocks/common';
import {
  SETTING_TAB_NAMES,
  type SettingTabName,
} from './tab-names';

export async function getSettingTabs(tab: SettingTabName) {
  const t = await getTranslations('admin.settings');

  const tabs: Tab[] = SETTING_TAB_NAMES.map((name) => ({
    name,
    title: t(`edit.tabs.${name}`),
    url: `/admin/settings/${name}`,
    is_active: tab === name,
  }));

  return tabs;
}
