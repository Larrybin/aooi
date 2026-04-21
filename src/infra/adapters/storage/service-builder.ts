import type {
  StorageUploadOptions,
  StorageUploadResult,
} from '@/extensions/storage';
import type { Configs } from '@/domains/settings/application/settings-runtime.query';
import { uploadFileToCloudflareR2 } from '@/shared/platform/cloudflare/storage';
import {
  buildStorageSpikeUploadMockResult,
  isStorageSpikeUploadMockEnabled,
} from './upload-mock';

export type StorageService = {
  uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult>;
};

export function buildStorageServiceWithConfigs(
  configs: Configs,
  options?: {
    uploadMockEnabled?: boolean;
  }
) {
  const uploadMockEnabled =
    options?.uploadMockEnabled ?? isStorageSpikeUploadMockEnabled();
  const storagePublicBaseUrl = configs.storage_public_base_url?.trim() || '';

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
