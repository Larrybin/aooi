import {
  StorageManager,
} from '@/extensions/storage';
import { R2Provider, S3Provider } from '@/extensions/storage/providers';
import type { Configs } from '@/shared/models/config';
import { getConfiguredStorageProviderContracts } from './storage-provider-contract';
import {
  isStorageSpikeUploadMockEnabled,
  wrapStorageProviderWithUploadMock,
} from './storage-upload-mock';

export function buildStorageServiceWithConfigs(
  configs: Configs,
  options?: {
    uploadMockEnabled?: boolean;
  }
) {
  const storageManager = new StorageManager();
  const uploadMockEnabled =
    options?.uploadMockEnabled ?? isStorageSpikeUploadMockEnabled();

  for (const providerContract of getConfiguredStorageProviderContracts(configs)) {
    if (providerContract.kind === 'r2') {
      const r2Provider = new R2Provider(providerContract.configs);
      storageManager.addProvider(
        uploadMockEnabled
          ? wrapStorageProviderWithUploadMock(r2Provider)
          : r2Provider,
        providerContract.isDefault
      );
      continue;
    }

    storageManager.addProvider(
      new S3Provider(providerContract.configs),
      providerContract.isDefault
    );
  }

  return storageManager;
}
