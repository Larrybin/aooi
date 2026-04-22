import type { ProductModuleId } from '@/config/product-modules/types';

import type { SettingTabName } from './tab-names';

export interface SettingOption {
  title: string;
  value: string;
}

export type SettingValue = string | string[] | boolean | number;

export type SettingVisibility = 'public' | 'private';

export type NormalizedSettingValueResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export type SettingValueValidatorResult =
  | { ok: true }
  | { ok: false; error: string };

export type SettingValueNormalizer = (
  value: string
) => NormalizedSettingValueResult;

export type SettingValueValidator = (
  value: string
) => SettingValueValidatorResult;

export interface SettingGroupDefinition {
  id: string;
  titleKey: string;
  description?: string;
}

export interface SettingDefinition {
  name: string;
  title: string;
  type: string;
  moduleId: ProductModuleId;
  group: SettingGroupDefinition;
  tab: SettingTabName;
  visibility: SettingVisibility;
  placeholder?: string;
  options?: SettingOption[];
  tip?: string;
  value?: SettingValue;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  externalService?: string;
  validator?: SettingValueValidator;
  normalizer?: SettingValueNormalizer;
}

export interface SettingGroup {
  name: string;
  title: string;
  description?: string;
  tab: SettingTabName;
}
