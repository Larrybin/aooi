import 'server-only';

import type { Setting } from '../types';

export const customerServiceSettings: Setting[] = [
  {
    name: 'crisp_enabled',
    title: 'Crisp Enabled',
    type: 'switch',
    value: 'false',
    group: 'crisp',
    tab: 'customer_service',
  },
  {
    name: 'crisp_website_id',
    title: 'Crisp Website ID',
    type: 'text',
    placeholder: 'xxx',
    group: 'crisp',
    tab: 'customer_service',
  },
  {
    name: 'tawk_enabled',
    title: 'Tawk Enabled',
    type: 'switch',
    value: 'false',
    group: 'tawk',
    tab: 'customer_service',
  },
  {
    name: 'tawk_property_id',
    title: 'Tawk Property ID',
    tip: 'Tawk Property ID is associated with your Tawk account',
    type: 'text',
    placeholder: 'xxx',
    group: 'tawk',
    tab: 'customer_service',
  },
  {
    name: 'tawk_widget_id',
    title: 'Tawk Widget ID',
    type: 'text',
    placeholder: 'xxx',
    group: 'tawk',
    tab: 'customer_service',
  },
];

