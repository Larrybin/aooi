import { getProductModuleItemsByTab } from '@/config/product-modules';
import type {
  ProductModuleId,
  ProductModuleTabRelationship,
  ProductModuleTier,
  ProductModuleVerification,
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
