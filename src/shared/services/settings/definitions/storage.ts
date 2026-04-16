import type { SettingDefinition } from '../types';

const r2Group = {
  id: 'r2',
  titleKey: 'groups.r2',
  description: 'custom your cloudflare r2 settings',
} as const;

export const storageSettings = [
  {
    name: 'r2_access_key',
    title: 'Cloudflare Access Key',
    type: 'text',
    moduleId: 'storage',
    visibility: 'private',
    placeholder: '',
    group: r2Group,
    tab: 'storage',
  },
  {
    name: 'r2_secret_key',
    title: 'Cloudflare Secret Key',
    type: 'password',
    moduleId: 'storage',
    visibility: 'private',
    placeholder: '',
    group: r2Group,
    tab: 'storage',
  },
  {
    name: 'r2_bucket_name',
    title: 'Bucket Name',
    type: 'text',
    moduleId: 'storage',
    visibility: 'private',
    placeholder: '',
    group: r2Group,
    tab: 'storage',
  },
  {
    name: 'r2_endpoint',
    title: 'Endpoint',
    type: 'url',
    moduleId: 'storage',
    visibility: 'private',
    placeholder: 'https://<account-id>.r2.cloudflarestorage.com',
    tip: 'Leave empty to use the default R2 endpoint',
    group: r2Group,
    tab: 'storage',
  },
  {
    name: 'r2_domain',
    title: 'Domain',
    type: 'url',
    moduleId: 'storage',
    visibility: 'private',
    placeholder: '',
    group: r2Group,
    tab: 'storage',
  },
] as const satisfies readonly SettingDefinition[];
