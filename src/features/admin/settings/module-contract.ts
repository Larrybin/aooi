import {
  getProductModuleByTab,
  getProductModuleGuideHref,
  getSupportingProductModulesByTab,
} from '@/config/product-modules';
import type {
  ProductModuleId,
  ProductModuleTier,
  ProductModuleVerification,
} from '@/config/product-modules';
import type { SettingTabName } from '@/shared/services/settings/tab-names';

export interface SettingsModuleContractViewModel {
  moduleId: ProductModuleId;
  title: string;
  tier: ProductModuleTier;
  verification: ProductModuleVerification;
  guideHref: string;
  isSupporting: boolean;
  supportingModuleTitles: string[];
}

export function getSettingsModuleContractViewModel(
  tab: SettingTabName
): SettingsModuleContractViewModel | null {
  const productModule = getProductModuleByTab(tab);
  if (!productModule) {
    return null;
  }

  const supportingModules = getSupportingProductModulesByTab(tab);
  const isSupporting = !productModule.ownedTabs.includes(tab);

  return {
    moduleId: productModule.id,
    title: productModule.title,
    tier: productModule.tier,
    verification: productModule.verification,
    guideHref: getProductModuleGuideHref(productModule),
    isSupporting,
    supportingModuleTitles: isSupporting
      ? supportingModules.map((item) => item.title)
      : [],
  };
}
