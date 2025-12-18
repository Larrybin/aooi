import 'server-only';

import type { Setting } from './types';

import { adsSettings } from './definitions/ads';
import { affiliateSettings } from './definitions/affiliate';
import { aiSettings } from './definitions/ai';
import { analyticsSettings } from './definitions/analytics';
import { authSettings } from './definitions/auth';
import { customerServiceSettings } from './definitions/customer_service';
import { emailSettings } from './definitions/email';
import { generalSettings } from './definitions/general';
import { paymentSettings } from './definitions/payment';
import { storageSettings } from './definitions/storage';

export type { Setting, SettingGroup } from './types';

export { getSettingGroups } from './groups';
export { getSettingTabs } from './tabs';

export async function getSettings() {
  const settings: Setting[] = [
    ...generalSettings,
    ...authSettings,
    ...paymentSettings,
    ...analyticsSettings,
    ...emailSettings,
    ...storageSettings,
    ...aiSettings,
    ...adsSettings,
    ...affiliateSettings,
    ...customerServiceSettings,
  ];

  return settings;
}

export { PUBLIC_SETTING_NAMES as publicSettingNames } from '@/shared/constants/public-setting-names';
