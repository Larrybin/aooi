import type { StorageUploadResult } from '@/extensions/storage';

export function isStorageSpikeUploadMockEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return env.STORAGE_SPIKE_UPLOAD_MOCK === 'true';
}

export function buildStorageSpikeUploadMockResult(params: {
  key: string;
  providerName?: string;
  publicDomain?: string;
}): StorageUploadResult {
  const normalizedKey = params.key.replace(/^\/+/, '');
  const baseUrl = (params.publicDomain || 'https://storage-spike.example.com')
    .replace(/\/+$/, '');
  const url = `${baseUrl}/${normalizedKey}`;

  return {
    success: true,
    provider: params.providerName || 'cloudflare-r2',
    key: normalizedKey,
    url,
    location: url,
  };
}
