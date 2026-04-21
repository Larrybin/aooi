import type { ProductModuleId } from '@/config/product-modules/types';

import type { SettingTabName } from '../tab-names';
import type {
  SettingDefinition,
  SettingGroupDefinition,
  SettingVisibility,
} from '../types';

type SettingGroupItem = Omit<
  SettingDefinition,
  'moduleId' | 'tab' | 'group' | 'visibility'
> & {
  visibility?: SettingVisibility;
};

type DefinedSetting<
  TSetting extends SettingGroupItem,
  TModuleId extends ProductModuleId,
  TTab extends SettingTabName,
  TGroup extends SettingGroupDefinition,
  TDefaultVisibility extends SettingVisibility | undefined,
> = Omit<TSetting, 'visibility'> & {
  moduleId: TModuleId;
  tab: TTab;
  group: TGroup;
  visibility: TSetting extends { readonly visibility: infer V }
    ? V extends SettingVisibility
      ? V
      : never
    : TDefaultVisibility extends SettingVisibility
      ? TDefaultVisibility
      : 'private';
};

type DefinedSettingsGroup<
  TSettings extends readonly SettingGroupItem[],
  TModuleId extends ProductModuleId,
  TTab extends SettingTabName,
  TGroup extends SettingGroupDefinition,
  TDefaultVisibility extends SettingVisibility | undefined,
> = {
  readonly [Index in keyof TSettings]: TSettings[Index] extends SettingGroupItem
    ? DefinedSetting<
        TSettings[Index],
        TModuleId,
        TTab,
        TGroup,
        TDefaultVisibility
      >
    : never;
};

export function defineSettingsGroup<
  const TModuleId extends ProductModuleId,
  const TTab extends SettingTabName,
  const TGroup extends SettingGroupDefinition,
  const TDefaultVisibility extends SettingVisibility | undefined,
  const TSettings extends readonly SettingGroupItem[],
>(
  base: {
    moduleId: TModuleId;
    tab: TTab;
    group: TGroup;
    defaultVisibility?: TDefaultVisibility;
  },
  settings: TSettings
): DefinedSettingsGroup<
  TSettings,
  TModuleId,
  TTab,
  TGroup,
  TDefaultVisibility
> {
  const defaultVisibility = base.defaultVisibility ?? 'private';

  return settings.map((setting) => ({
    ...setting,
    moduleId: base.moduleId,
    tab: base.tab,
    group: base.group,
    visibility: setting.visibility ?? defaultVisibility,
  })) as DefinedSettingsGroup<
    TSettings,
    TModuleId,
    TTab,
    TGroup,
    TDefaultVisibility
  >;
}
