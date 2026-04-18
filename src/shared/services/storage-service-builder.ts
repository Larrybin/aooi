import type {
  StorageDownloadUploadOptions,
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
} from '@/extensions/storage';
import { S3CompatibleStorageProvider } from '@/extensions/storage/providers';
import {
  BadRequestError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';
import {
  exactProviderNameKey,
  ProviderRegistry,
} from '@/shared/lib/providers/provider-registry';
import type { Configs } from '@/shared/models/config';
import { getConfiguredStorageProviderContracts } from './storage-provider-contract';
import {
  isStorageSpikeUploadMockEnabled,
  wrapStorageProviderWithUploadMock,
} from './storage-upload-mock';

export type StorageService = {
  uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult>;
  uploadFileWithProvider(
    options: StorageUploadOptions,
    providerName: string
  ): Promise<StorageUploadResult>;
  downloadAndUpload(
    options: StorageDownloadUploadOptions
  ): Promise<StorageUploadResult>;
  downloadAndUploadWithProvider(
    options: StorageDownloadUploadOptions,
    providerName: string
  ): Promise<StorageUploadResult>;
};

export function buildStorageServiceWithConfigs(
  configs: Configs,
  options?: {
    uploadMockEnabled?: boolean;
  }
) {
  const registry = new ProviderRegistry<StorageProvider>({
    toNameKey: exactProviderNameKey,
    memoizeDefault: true,
  });
  const uploadMockEnabled =
    options?.uploadMockEnabled ?? isStorageSpikeUploadMockEnabled();

  for (const providerContract of getConfiguredStorageProviderContracts(configs)) {
    const provider = new S3CompatibleStorageProvider(
      providerContract.name,
      providerContract.configs
    );

    registry.add(
      uploadMockEnabled
        ? wrapStorageProviderWithUploadMock(provider)
        : provider,
      providerContract.isDefault
    );
  }

  const getDefaultProvider = () =>
    registry.getDefaultRequired(
      () => new ServiceUnavailableError('No storage provider configured')
    );
  const getNamedProvider = (providerName: string) =>
    registry.getRequired(
      providerName,
      (name) => new BadRequestError(`Storage provider '${name}' not found`)
    );

  return {
    async uploadFile(options) {
      return await getDefaultProvider().uploadFile(options);
    },
    async uploadFileWithProvider(options, providerName) {
      return await getNamedProvider(providerName).uploadFile(options);
    },
    async downloadAndUpload(options) {
      return await getDefaultProvider().downloadAndUpload(options);
    },
    async downloadAndUploadWithProvider(options, providerName) {
      return await getNamedProvider(providerName).downloadAndUpload(options);
    },
  } satisfies StorageService;
}
