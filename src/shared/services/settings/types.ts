export interface Setting {
  name: string;
  title: string;
  type: string;
  placeholder?: string;
  options?: {
    title: string;
    value: string;
  }[];
  tip?: string;
  value?: string | string[] | boolean | number;
  group?: string;
  tab?: string;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SettingGroup {
  name: string;
  title: string;
  description?: string;
  tab: string;
}
