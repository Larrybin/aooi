import 'server-only';

import type { Setting } from '../types';

export const affiliateSettings: Setting[] = [
  {
    name: 'affonso_enabled',
    title: 'Affonso Enabled',
    type: 'switch',
    value: 'false',
    group: 'affonso',
    tab: 'affiliate',
  },
  {
    name: 'affonso_id',
    title: 'Affonso ID',
    type: 'text',
    placeholder: 'xxx',
    tip: 'Affonso Program ID',
    group: 'affonso',
    tab: 'affiliate',
  },
  {
    name: 'affonso_cookie_duration',
    title: 'Affonso Cookie Duration',
    type: 'number',
    placeholder: '30',
    tip: 'Affonso Cookie Duration in days, default is 30 days',
    value: '30',
    group: 'affonso',
    tab: 'affiliate',
  },
  {
    name: 'promotekit_enabled',
    title: 'PromoteKit Enabled',
    type: 'switch',
    value: 'false',
    group: 'promotekit',
    tab: 'affiliate',
  },
  {
    name: 'promotekit_id',
    title: 'PromoteKit ID',
    type: 'text',
    placeholder: 'xxx',
    tip: 'PromoteKit Program ID',
    group: 'promotekit',
    tab: 'affiliate',
  },
];

