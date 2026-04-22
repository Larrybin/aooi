import type { SettingDefinition } from '../types';
import { defineSettingsGroup } from './builder';

const affonsoGroup = {
  id: 'affonso',
  titleKey: 'groups.affonso',
  description:
    'custom your <a href="https://affonso.io" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Affonso</a> settings',
} as const;

const promotekitGroup = {
  id: 'promotekit',
  titleKey: 'groups.promotekit',
  description:
    'custom your <a href="https://www.promotekit.com" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">PromoteKit</a> settings',
} as const;

const affonsoSettings = defineSettingsGroup(
  {
    moduleId: 'affiliate',
    tab: 'affiliate',
    group: affonsoGroup,
    defaultVisibility: 'private',
  },
  [
    {
      name: 'affonso_enabled',
      title: 'Affonso Enabled',
      type: 'switch',
      visibility: 'public',
      value: 'false',
    },
    {
      name: 'affonso_id',
      title: 'Affonso ID',
      type: 'text',
      placeholder: '',
      tip: 'Affonso Program ID',
    },
    {
      name: 'affonso_cookie_duration',
      title: 'Affonso Cookie Duration',
      type: 'number',
      placeholder: '30',
      tip: 'Affonso Cookie Duration in days, default is 30 days',
      value: '30',
    },
  ] as const
);

const promotekitSettings = defineSettingsGroup(
  {
    moduleId: 'affiliate',
    tab: 'affiliate',
    group: promotekitGroup,
    defaultVisibility: 'private',
  },
  [
    {
      name: 'promotekit_enabled',
      title: 'PromoteKit Enabled',
      type: 'switch',
      visibility: 'public',
      value: 'false',
    },
    {
      name: 'promotekit_id',
      title: 'PromoteKit ID',
      type: 'text',
      placeholder: '',
      tip: 'PromoteKit Program ID',
    },
  ] as const
);

export const affiliateSettings = [
  ...affonsoSettings,
  ...promotekitSettings,
] as const satisfies readonly SettingDefinition[];
