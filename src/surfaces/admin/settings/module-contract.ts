import {
  getProductModuleItemsByTab,
  type ProductModuleId,
  type ProductModuleTabRelationship,
  type ProductModuleTier,
  type ProductModuleVerification,
} from '@/config/product-modules';

export interface SettingsModuleContractRow {
  moduleId: ProductModuleId;
  title: string;
  relationship: ProductModuleTabRelationship;
  tier: ProductModuleTier;
  verification: ProductModuleVerification;
  guideHref: string;
}

export function getSettingsModuleContractRows(
  tab: Parameters<typeof getProductModuleItemsByTab>[0]
): SettingsModuleContractRow[] {
  return getProductModuleItemsByTab(tab);
}
