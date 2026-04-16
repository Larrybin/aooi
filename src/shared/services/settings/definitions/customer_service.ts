import type { SettingDefinition } from '../types';

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

export const customerServiceSettings = [
  {
    name: 'crisp_enabled',
    title: 'Crisp Enabled',
    type: 'switch',
    moduleId: 'customer_service',
    visibility: 'public',
    value: 'false',
    group: crispGroup,
    tab: 'customer_service',
  },
  {
    name: 'crisp_website_id',
    title: 'Crisp Website ID',
    type: 'text',
    moduleId: 'customer_service',
    visibility: 'private',
    placeholder: '',
    group: crispGroup,
    tab: 'customer_service',
  },
  {
    name: 'tawk_enabled',
    title: 'Tawk Enabled',
    type: 'switch',
    moduleId: 'customer_service',
    visibility: 'public',
    value: 'false',
    group: tawkGroup,
    tab: 'customer_service',
  },
  {
    name: 'tawk_property_id',
    title: 'Tawk Property ID',
    tip: 'Tawk Property ID is associated with your Tawk account',
    type: 'text',
    moduleId: 'customer_service',
    visibility: 'private',
    placeholder: '',
    group: tawkGroup,
    tab: 'customer_service',
  },
  {
    name: 'tawk_widget_id',
    title: 'Tawk Widget ID',
    type: 'text',
    moduleId: 'customer_service',
    visibility: 'private',
    placeholder: '',
    group: tawkGroup,
    tab: 'customer_service',
  },
] as const satisfies readonly SettingDefinition[];
