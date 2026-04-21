import 'server-only';

import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';
import type { Configs } from '@/domains/settings/application/settings-runtime.query';

import { buildServiceFromLatestConfigs } from '@/infra/adapters/config-refresh-policy';
import {
  buildStorageServiceWithConfigs,
  type StorageService,
} from './service-builder';

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
