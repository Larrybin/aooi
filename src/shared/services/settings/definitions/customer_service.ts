import type { SettingDefinition } from '../types';
import { defineSettingsGroup } from './builder';

const crispGroup = {
  id: 'crisp',
  titleKey: 'groups.crisp',
  description:
    'custom your <a href="https://crisp.chat" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Crisp</a> settings',
} as const;

const tawkGroup = {
  id: 'tawk',
  titleKey: 'groups.tawk',
  description:
    'custom your <a href="https://www.tawk.to" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Tawk</a> settings',
} as const;

const crispSettings = defineSettingsGroup(
  {
    moduleId: 'customer_service',
    tab: 'customer_service',
    group: crispGroup,
    defaultVisibility: 'private',
  },
  [
    {
      name: 'crisp_enabled',
      title: 'Crisp Enabled',
      type: 'switch',
      visibility: 'public',
      value: 'false',
    },
    {
      name: 'crisp_website_id',
      title: 'Crisp Website ID',
      type: 'text',
      placeholder: '',
    },
  ] as const
);

const tawkSettings = defineSettingsGroup(
  {
    moduleId: 'customer_service',
    tab: 'customer_service',
    group: tawkGroup,
    defaultVisibility: 'private',
  },
  [
    {
      name: 'tawk_enabled',
      title: 'Tawk Enabled',
      type: 'switch',
      visibility: 'public',
      value: 'false',
    },
    {
      name: 'tawk_property_id',
      title: 'Tawk Property ID',
      type: 'text',
      placeholder: '',
      tip: 'Tawk Property ID is associated with your Tawk account',
    },
    {
      name: 'tawk_widget_id',
      title: 'Tawk Widget ID',
      type: 'text',
      placeholder: '',
    },
  ] as const
);

export const customerServiceSettings = [
  ...crispSettings,
  ...tawkSettings,
] as const satisfies readonly SettingDefinition[];
