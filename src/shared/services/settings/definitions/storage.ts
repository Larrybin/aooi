import type { SettingDefinition } from '../types';
import { defineSettingsGroup } from './builder';

const r2Group = {
  id: 'r2',
  titleKey: 'groups.r2',
  description: 'custom your cloudflare r2 settings',
} as const;

export const storageSettings = defineSettingsGroup(
  {
    moduleId: 'storage',
    tab: 'storage',
    group: r2Group,
  },
  [
    {
      name: 'r2_access_key',
      title: 'Cloudflare Access Key',
      type: 'text',
      placeholder: '',
    },
    {
      name: 'r2_secret_key',
      title: 'Cloudflare Secret Key',
      type: 'password',
      placeholder: '',
    },
    {
      name: 'r2_bucket_name',
      title: 'Bucket Name',
      type: 'text',
      placeholder: '',
    },
    {
      name: 'r2_endpoint',
      title: 'Endpoint',
      type: 'url',
      placeholder: 'https://<account-id>.r2.cloudflarestorage.com',
      tip: 'Leave empty to use the default R2 endpoint',
    },
    {
      name: 'r2_domain',
      title: 'Domain',
      type: 'url',
      placeholder: '',
    },
  ] as const
) satisfies readonly SettingDefinition[];
