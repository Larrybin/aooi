import type { Configs } from '@/shared/models/config';

export function canBuildR2StorageProvider(configs: Configs) {
  return Boolean(
    configs.r2_access_key &&
      configs.r2_secret_key &&
      configs.r2_bucket_name &&
      (configs.r2_endpoint || configs.r2_account_id)
  );
}

export type StorageProviderContract =
  | {
      kind: 'r2';
      isDefault: true;
      configs: {
        accountId: string;
        accessKeyId: string;
        secretAccessKey: string;
        bucket: string;
        region: 'auto';
        endpoint?: string;
        publicDomain?: string;
      };
    }
  | {
      kind: 's3';
      isDefault: false;
      configs: {
        endpoint?: string;
        region?: string;
        accessKeyId: string;
        secretAccessKey: string;
        bucket: string;
        publicDomain?: string;
      };
    };

export function getConfiguredStorageProviderContracts(
  configs: Configs
): StorageProviderContract[] {
  const providers: StorageProviderContract[] = [];

  if (canBuildR2StorageProvider(configs)) {
    providers.push({
      kind: 'r2',
      isDefault: true,
      configs: {
        accountId: configs.r2_account_id || '',
        accessKeyId: configs.r2_access_key,
        secretAccessKey: configs.r2_secret_key,
        bucket: configs.r2_bucket_name,
        region: 'auto',
        endpoint: configs.r2_endpoint || undefined,
        publicDomain: configs.r2_domain || undefined,
      },
    });
  }

  if (configs.s3_access_key && configs.s3_secret_key && configs.s3_bucket) {
    providers.push({
      kind: 's3',
      isDefault: false,
      configs: {
        endpoint: configs.s3_endpoint || undefined,
        region: configs.s3_region || undefined,
        accessKeyId: configs.s3_access_key,
        secretAccessKey: configs.s3_secret_key,
        bucket: configs.s3_bucket,
        publicDomain: configs.s3_domain || undefined,
      },
    });
  }

  return providers;
}
