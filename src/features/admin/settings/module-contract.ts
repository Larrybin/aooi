import {
  getProductModuleItemsByTab,
} from '@/config/product-modules';
import type {
  ProductModuleId,
  ProductModuleTabRelationship,
  ProductModuleTier,
  ProductModuleVerification,
} from '@/config/product-modules';
import type { SettingTabName } from '@/shared/services/settings/tab-names';

export interface SettingsModuleContractRow {
  moduleId: ProductModuleId;
  title: string;
  relationship: ProductModuleTabRelationship;
  tier: ProductModuleTier;
  verification: ProductModuleVerification;
  guideHref: string;
}

export function getSettingsModuleContractRows(
  tab: SettingTabName
): SettingsModuleContractRow[] {
  return getProductModuleItemsByTab(tab);
}
