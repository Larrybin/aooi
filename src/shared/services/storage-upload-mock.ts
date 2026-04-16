import type {
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
} from '@/extensions/storage';

export function isStorageSpikeUploadMockEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return env.STORAGE_SPIKE_UPLOAD_MOCK === 'true';
}

export function buildStorageSpikeUploadMockResult(params: {
  key: string;
  providerName: string;
  publicDomain?: string;
}): StorageUploadResult {
  const normalizedKey = params.key.replace(/^\/+/, '');
  const baseUrl = (params.publicDomain || 'https://storage-spike.example.com')
    .replace(/\/+$/, '');
  const url = `${baseUrl}/${params.providerName}/${normalizedKey}`;

  return {
    success: true,
    provider: params.providerName,
    key: normalizedKey,
    url,
    location: url,
  };
}

export function wrapStorageProviderWithUploadMock(
  provider: StorageProvider
): StorageProvider {
  return {
    ...provider,
    async uploadFile(
      options: StorageUploadOptions
    ): Promise<StorageUploadResult> {
      return buildStorageSpikeUploadMockResult({
        key: options.key,
        providerName: provider.name,
        publicDomain:
          typeof provider.configs.publicDomain === 'string'
            ? provider.configs.publicDomain
            : undefined,
      });
    },
    async downloadAndUpload(options) {
      return buildStorageSpikeUploadMockResult({
        key: options.key,
        providerName: provider.name,
        publicDomain:
          typeof provider.configs.publicDomain === 'string'
            ? provider.configs.publicDomain
            : undefined,
      });
    },
  };
}
