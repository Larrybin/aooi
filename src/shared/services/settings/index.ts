import 'server-only';

import { adsSettings } from './definitions/ads';
import { affiliateSettings } from './definitions/affiliate';
import { aiSettings } from './definitions/ai';
import { analyticsSettings } from './definitions/analytics';
import { authSettings } from './definitions/auth';
import { customerServiceSettings } from './definitions/customer_service';
import { contentSettings } from './definitions/content';
import { emailSettings } from './definitions/email';
import { generalSettings } from './definitions/general';
import { paymentSettings } from './definitions/payment';
import { storageSettings } from './definitions/storage';
import type { Setting } from './types';

export type { Setting, SettingGroup } from './types';

export { getSettingGroups } from './groups';
export { getSettingTabs } from './tabs';

const ALL_SETTINGS: Setting[] = [
  ...generalSettings,
  ...contentSettings,
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

export async function getSettings() {
  return ALL_SETTINGS;
}

export { PUBLIC_SETTING_NAMES as publicSettingNames } from '@/shared/constants/public-setting-names';
