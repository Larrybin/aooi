import { normalizeStoragePublicBaseUrl } from '@/shared/lib/storage-public-url';

import type { SettingDefinition } from '../types';
import { defineSettingsGroup } from './builder';

const storageGroup = {
  id: 'storage',
  titleKey: 'groups.r2',
  description:
    'configure the public base URL for Cloudflare R2 assets served by this app',
} as const;

export const storageSettings = defineSettingsGroup(
  {
    moduleId: 'storage',
    tab: 'storage',
    group: storageGroup,
    defaultVisibility: 'public',
  },
  [
    {
      name: 'storage_public_base_url',
      title: 'Storage Public Base URL',
      type: 'url',
      placeholder: 'https://cdn.example.com/assets/',
      tip: 'Required for uploaded brand assets and image uploads. The runtime will derive the final public URL as storage_public_base_url + objectKey.',
      normalizer: normalizeStoragePublicBaseUrl,
    },
  ] as const
) satisfies readonly SettingDefinition[];
