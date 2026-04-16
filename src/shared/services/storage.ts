import 'server-only';

import type { StorageManager } from '@/extensions/storage';
import type { Configs } from '@/shared/models/config';

import { buildServiceFromLatestConfigs } from './config_refresh_policy';
import { buildStorageServiceWithConfigs } from './storage-service-builder';

/**
 * get storage service with configs
 */
export function getStorageServiceWithConfigs(
  configs: Configs,
  options?: {
    uploadMockEnabled?: boolean;
  }
) {
  return buildStorageServiceWithConfigs(configs, options);
}

/**
 * global storage service
 */
export async function getStorageService(): Promise<StorageManager> {
  return await buildServiceFromLatestConfigs(getStorageServiceWithConfigs);
}
