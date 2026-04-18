import 'server-only';

import type { Configs } from '@/shared/models/config';

import { buildServiceFromLatestConfigs } from './config_refresh_policy';
import {
  buildStorageServiceWithConfigs,
  type StorageService,
} from './storage-service-builder';

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
export async function getStorageService(): Promise<StorageService> {
  return await buildServiceFromLatestConfigs(getStorageServiceWithConfigs);
}
