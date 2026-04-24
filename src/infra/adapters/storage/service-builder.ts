import type {
  StorageUploadOptions,
  StorageUploadResult,
} from '@/extensions/storage';
import { uploadFileToCloudflareR2 } from '@/shared/platform/cloudflare/storage';

import {
  buildStorageSpikeUploadMockResult,
  isStorageSpikeUploadMockEnabled,
} from './upload-mock';

export type StorageRuntimeBindings = {
  publicBaseUrl: string;
};

export type StorageService = {
  uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult>;
};

type StorageBuilderInput = {
  bindings: StorageRuntimeBindings;
  options?: {
    uploadMockEnabled?: boolean;
  };
};

function assertBindingOnlyInput(
  input: unknown
): asserts input is StorageBuilderInput {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('bindings' in input) ||
    'configs' in input
  ) {
    throw new Error('Storage is binding-only');
  }
}

export function buildStorageService(
  input: StorageBuilderInput
): StorageService {
  assertBindingOnlyInput(input);

  const uploadMockEnabled =
    input.options?.uploadMockEnabled ?? isStorageSpikeUploadMockEnabled();
  const storagePublicBaseUrl = input.bindings.publicBaseUrl.trim();

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
