import 'server-only';

import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';
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
 * Global storage service. In production this is Cloudflare R2 binding only.
 */
export async function getStorageService(options: {
  mode?: ConfigConsistencyMode;
} = {}): Promise<StorageService> {
  return await buildServiceFromLatestConfigs(
    getStorageServiceWithConfigs,
    options
  );
}
