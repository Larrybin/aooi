import type { SettingTabName } from '@/domains/settings/tab-names';

export const PRODUCT_MODULE_IDS = [
  'core_shell',
  'auth',
  'billing',
  'admin_settings',
  'deploy_contract',
  'docs',
  'blog',
  'ai',
  'storage',
  'analytics',
  'affiliate',
  'customer_service',
  'ads',
] as const;

export const PRODUCT_MODULE_TIERS = [
  'mainline',
  'optional',
  'experimental',
] as const;

export const PRODUCT_MODULE_VERIFICATIONS = [
  'verified',
  'partial',
  'unverified',
] as const;

export const MODULE_GUIDE_SLUGS = [
  'module-contract#core-shell',
  'modules/auth',
  'modules/billing',
  'module-contract#admin-settings',
  'module-contract#deploy-contract',
  'modules/docs-blog',
  'modules/ai',
  'modules/storage',
  'modules/growth-support',
] as const;

export type ProductModuleId = (typeof PRODUCT_MODULE_IDS)[number];
export type ProductModuleTier = (typeof PRODUCT_MODULE_TIERS)[number];
export type ProductModuleVerification =
  (typeof PRODUCT_MODULE_VERIFICATIONS)[number];
export type ModuleGuideSlug = (typeof MODULE_GUIDE_SLUGS)[number];

export interface ProductModule<SettingKey extends string = string> {
  id: ProductModuleId;
  title: string;
  tier: ProductModuleTier;
  verification: ProductModuleVerification;
  ownedTabs: SettingTabName[];
  supportingTabs: SettingTabName[];
  settingKeys: SettingKey[];
  docSlug: ModuleGuideSlug;
  entryRoutes: string[];
  externalServices: string[];
}
