import type { SettingDefinition } from '../types';

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

export const affiliateSettings = [
  {
    name: 'affonso_enabled',
    title: 'Affonso Enabled',
    type: 'switch',
    moduleId: 'affiliate',
    visibility: 'public',
    value: 'false',
    group: affonsoGroup,
    tab: 'affiliate',
  },
  {
    name: 'affonso_id',
    title: 'Affonso ID',
    type: 'text',
    moduleId: 'affiliate',
    visibility: 'private',
    placeholder: '',
    tip: 'Affonso Program ID',
    group: affonsoGroup,
    tab: 'affiliate',
  },
  {
    name: 'affonso_cookie_duration',
    title: 'Affonso Cookie Duration',
    type: 'number',
    moduleId: 'affiliate',
    visibility: 'private',
    placeholder: '30',
    tip: 'Affonso Cookie Duration in days, default is 30 days',
    value: '30',
    group: affonsoGroup,
    tab: 'affiliate',
  },
  {
    name: 'promotekit_enabled',
    title: 'PromoteKit Enabled',
    type: 'switch',
    moduleId: 'affiliate',
    visibility: 'public',
    value: 'false',
    group: promotekitGroup,
    tab: 'affiliate',
  },
  {
    name: 'promotekit_id',
    title: 'PromoteKit ID',
    type: 'text',
    moduleId: 'affiliate',
    visibility: 'private',
    placeholder: '',
    tip: 'PromoteKit Program ID',
    group: promotekitGroup,
    tab: 'affiliate',
  },
] as const satisfies readonly SettingDefinition[];
