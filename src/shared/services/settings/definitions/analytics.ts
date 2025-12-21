import 'server-only';

import type { Setting } from '../types';

export const analyticsSettings: Setting[] = [
  {
    name: 'google_analytics_id',
    title: 'Google Analytics ID',
    type: 'text',
    placeholder: '',
    group: 'google_analytics',
    tab: 'analytics',
  },
  {
    name: 'clarity_id',
    title: 'Clarity ID',
    type: 'text',
    placeholder: '',
    group: 'clarity',
    tab: 'analytics',
  },
  {
    name: 'plausible_domain',
    title: 'Plausible Domain',
    type: 'text',
    placeholder: 'shipany.site',
    group: 'plausible',
    tab: 'analytics',
  },
  {
    name: 'plausible_src',
    title: 'Plausible Script Src',
    type: 'url',
    placeholder: 'https://plausible.io/js/script.js',
    group: 'plausible',
    tab: 'analytics',
  },
  {
    name: 'openpanel_client_id',
    title: 'OpenPanel Client ID',
    type: 'text',
    placeholder: '',
    group: 'openpanel',
    tab: 'analytics',
  },
  {
    name: 'vercel_analytics_enabled',
    title: 'Enabled',
    type: 'switch',
    value: 'false',
    group: 'vercel_analytics',
    tab: 'analytics',
  },
];
