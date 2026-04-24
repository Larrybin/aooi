import type { FormField, Form as FormType } from '@/shared/types/blocks/form';

import type { SettingDefinition, SettingGroup } from './types';

export function mapSettingsToForms({
  tab,
  groups,
  settings,
  configs,
  submitLabel,
  onSubmit,
}: {
  tab: string;
  groups: SettingGroup[];
  settings: readonly SettingDefinition[];
  configs: Record<string, unknown>;
  submitLabel: string;
  onSubmit: NonNullable<FormType['submit']>['handler'];
}): FormType[] {
  return groups
    .filter((group) => group.tab === tab)
    .map((group) => ({
      title: group.title,
      description: group.description,
      fields: settings
        .filter((setting) => setting.group.id === group.name)
        .map((setting) => ({
          name: setting.name,
          title: setting.title,
          type: setting.type as FormField['type'],
          placeholder: setting.placeholder,
          group: setting.group.id,
          options: setting.options,
          tip: setting.tip,
          value: setting.value,
          attributes: setting.attributes,
          metadata: setting.metadata,
        })),
      passby: {
        provider: group.name,
        tab: group.tab,
      },
      data: configs,
      submit: {
        button: {
          title: submitLabel,
        },
        handler: onSubmit,
      },
    }));
}
