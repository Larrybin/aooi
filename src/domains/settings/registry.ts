import { getTranslations } from 'next-intl/server';

import { adsSettings } from './definitions/ads';
import { affiliateSettings } from './definitions/affiliate';
import { aiSettings } from './definitions/ai';
import { analyticsSettings } from './definitions/analytics';
import { authSettings } from './definitions/auth';
import { customerServiceSettings } from './definitions/customer_service';
import { emailSettings } from './definitions/email';
import { generalSettings } from './definitions/general';
import { paymentSettings } from './definitions/payment';
import type { SettingDefinition, SettingGroup } from './types';

const SETTINGS_REGISTRY = [
  ...generalSettings,
  ...authSettings,
  ...emailSettings,
  ...paymentSettings,
  ...analyticsSettings,
  ...aiSettings,
  ...affiliateSettings,
  ...customerServiceSettings,
  ...adsSettings,
] as const;

type RegistryEntry = (typeof SETTINGS_REGISTRY)[number];

type DerivedSettingGroup = {
  id: string;
  titleKey: string;
  description?: string;
  tab: RegistryEntry['tab'];
};

export function deriveSettingsRegistry(settings: readonly SettingDefinition[]) {
  const names = new Set<string>();
  const groups = new Map<string, DerivedSettingGroup>();
  const byName = new Map<string, SettingDefinition>();

  for (const setting of settings) {
    if (names.has(setting.name)) {
      throw new Error(`Duplicate setting name detected: ${setting.name}`);
    }
    names.add(setting.name);
    byName.set(setting.name, setting);

    const existingGroup = groups.get(setting.group.id);
    const nextGroup: DerivedSettingGroup = {
      id: setting.group.id,
      titleKey: setting.group.titleKey,
      description: setting.group.description,
      tab: setting.tab,
    };

    if (!existingGroup) {
      groups.set(setting.group.id, nextGroup);
      continue;
    }

    if (
      existingGroup.titleKey !== nextGroup.titleKey ||
      existingGroup.description !== nextGroup.description ||
      existingGroup.tab !== nextGroup.tab
    ) {
      throw new Error(
        `Inconsistent group metadata detected for "${setting.group.id}"`
      );
    }
  }

  return {
    byName,
    groups: [...groups.values()],
  };
}

const derivedRegistry = deriveSettingsRegistry(SETTINGS_REGISTRY);

export const ALL_SETTINGS = SETTINGS_REGISTRY;

export type KnownSettingKey = RegistryEntry['name'];
export type PublicSettingKey = Extract<
  RegistryEntry,
  { visibility: 'public' }
>['name'];

export const KNOWN_SETTING_KEYS = Object.freeze(
  ALL_SETTINGS.map((setting) => setting.name)
) as readonly KnownSettingKey[];

export const PUBLIC_SETTING_NAMES = Object.freeze(
  ALL_SETTINGS.filter((setting) => setting.visibility === 'public').map(
    (setting) => setting.name
  )
) as readonly PublicSettingKey[];

export const publicSettingNames = PUBLIC_SETTING_NAMES;

export const PUBLIC_UI_SETTING_KEYS = Object.freeze({
  aiEnabled: 'general_ai_enabled',
  localeSwitcherEnabled: 'general_locale_switcher_enabled',
  socialLinksEnabled: 'general_social_links_enabled',
  socialLinks: 'general_social_links',
  affonsoEnabled: 'affonso_enabled',
  promotekitEnabled: 'promotekit_enabled',
} as const);

export const AUTH_RUNTIME_SETTING_KEYS = Object.freeze({
  emailAuthEnabled: 'email_auth_enabled',
  googleAuthEnabled: 'google_auth_enabled',
  googleOneTapEnabled: 'google_one_tap_enabled',
  githubAuthEnabled: 'github_auth_enabled',
} as const);

export const BILLING_RUNTIME_SETTING_KEYS = Object.freeze({
  locale: 'locale',
  defaultLocale: 'default_locale',
  stripePaymentMethods: 'stripe_payment_methods',
  creemEnvironment: 'creem_environment',
  creemProductIds: 'creem_product_ids',
  paypalEnvironment: 'paypal_environment',
} as const);

export const AI_RUNTIME_SETTING_KEYS = Object.freeze({
  aiEnabled: 'general_ai_enabled',
} as const);

export const SETTING_DEFINITION_BY_NAME = derivedRegistry.byName as ReadonlyMap<
  KnownSettingKey,
  SettingDefinition
>;

export const SETTING_GROUP_REGISTRY = Object.freeze(
  derivedRegistry.groups
) as readonly DerivedSettingGroup[];

const KNOWN_SETTING_KEY_SET = new Set<string>(KNOWN_SETTING_KEYS);

export function isKnownSettingKey(name: string): name is KnownSettingKey {
  return KNOWN_SETTING_KEY_SET.has(name);
}

export function getSettingDefinition(
  name: string
): SettingDefinition | undefined {
  return SETTING_DEFINITION_BY_NAME.get(name as KnownSettingKey);
}

export function getSettingGroupsFromRegistry(
  translate: (key: string) => string
): SettingGroup[] {
  return SETTING_GROUP_REGISTRY.map((group) => ({
    name: group.id,
    title: translate(group.titleKey),
    description: group.description,
    tab: group.tab,
  }));
}

export function getSettingGroupsFromDefinitions(
  settings: readonly SettingDefinition[],
  translate: (key: string) => string
): SettingGroup[] {
  return getSettingGroupsFromRegistry(translate).filter((group) =>
    settings.some(
      (setting) =>
        setting.group.id === group.name && setting.tab === group.tab
    )
  );
}

export async function getSettingGroups() {
  const t = await getTranslations('admin.settings');
  return getSettingGroupsFromRegistry((key) => t(key));
}
