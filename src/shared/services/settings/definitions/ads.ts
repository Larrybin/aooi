import 'server-only';

import type { Setting } from '../types';

export const adsSettings: Setting[] = [
  {
    name: 'adsense_code',
    title: 'Adsense Code',
    type: 'text',
    placeholder: 'ca-pub-xxx',
    group: 'adsense',
    tab: 'ads',
  },
];
