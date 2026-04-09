export const SETTING_TAB_NAMES = [
  'general',
  'content',
  'auth',
  'payment',
  'email',
  'storage',
  'ai',
  'analytics',
  'ads',
  'affiliate',
  'customer_service',
] as const;

export type SettingTabName = (typeof SETTING_TAB_NAMES)[number];

export function isSettingTabName(value: string): value is SettingTabName {
  return SETTING_TAB_NAMES.includes(value as SettingTabName);
}
