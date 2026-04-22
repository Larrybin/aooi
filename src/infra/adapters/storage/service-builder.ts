import type {
  StorageUploadOptions,
  StorageUploadResult,
} from '@/extensions/storage';
import type { Configs } from '@/domains/settings/application/settings-runtime.query';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';
import { uploadFileToCloudflareR2 } from '@/shared/platform/cloudflare/storage';
import {
  buildStorageSpikeUploadMockResult,
  isStorageSpikeUploadMockEnabled,
} from './upload-mock';

export type StorageService = {
  uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult>;
};

export function buildStorageServiceWithConfigs(
  _configs: Configs,
  options?: {
    uploadMockEnabled?: boolean;
  }
) {
  const uploadMockEnabled =
    options?.uploadMockEnabled ?? isStorageSpikeUploadMockEnabled();
  const storagePublicBaseUrl =
    getRuntimeEnvString('STORAGE_PUBLIC_BASE_URL')?.trim() || '';

  return {
    async uploadFile(options) {
      if (uploadMockEnabled) {
        return buildStorageSpikeUploadMockResult({
          key: options.key,
          publicDomain: storagePublicBaseUrl || undefined,
        });
      }

      return await uploadFileToCloudflareR2({
        options,
        storagePublicBaseUrl,
      });
    },
  } satisfies StorageService;
}
