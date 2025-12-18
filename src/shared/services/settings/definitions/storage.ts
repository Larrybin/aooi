import 'server-only';

import type { Setting } from '../types';

export const storageSettings: Setting[] = [
  {
    name: 'r2_access_key',
    title: 'Cloudflare Access Key',
    type: 'text',
    placeholder: '',
    group: 'r2',
    tab: 'storage',
  },
  {
    name: 'r2_secret_key',
    title: 'Cloudflare Secret Key',
    type: 'password',
    placeholder: '',
    group: 'r2',
    tab: 'storage',
  },
  {
    name: 'r2_bucket_name',
    title: 'Bucket Name',
    type: 'text',
    placeholder: '',
    group: 'r2',
    tab: 'storage',
  },
  {
    name: 'r2_endpoint',
    title: 'Endpoint',
    type: 'url',
    placeholder: 'https://<account-id>.r2.cloudflarestorage.com',
    tip: 'Leave empty to use the default R2 endpoint',
    group: 'r2',
    tab: 'storage',
  },
  {
    name: 'r2_domain',
    title: 'Domain',
    type: 'url',
    placeholder: '',
    group: 'r2',
    tab: 'storage',
  },
];

