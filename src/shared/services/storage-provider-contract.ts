import type { Configs } from '@/shared/models/config';

export function canBuildR2StorageProvider(configs: Configs) {
  return Boolean(
    configs.r2_access_key &&
      configs.r2_secret_key &&
      configs.r2_bucket_name &&
      (configs.r2_endpoint || configs.r2_account_id)
  );
}

export function canBuildS3StorageProvider(configs: Configs) {
  return Boolean(
    configs.s3_access_key &&
      configs.s3_secret_key &&
      configs.s3_bucket &&
      configs.s3_endpoint &&
      configs.s3_region
  );
}

export type StorageProviderContract =
  | {
      name: 'r2';
      isDefault: true;
      configs: {
        endpoint: string;
        region: 'auto';
        accessKeyId: string;
        secretAccessKey: string;
        bucket: string;
        publicDomain?: string;
      };
    }
  | {
      name: 's3';
      isDefault: false;
      configs: {
        endpoint: string;
        region: string;
        accessKeyId: string;
        secretAccessKey: string;
        bucket: string;
        publicDomain?: string;
      };
    };

function resolveR2Endpoint(configs: Configs) {
  if (configs.r2_endpoint) {
    return configs.r2_endpoint;
  }

  return `https://${configs.r2_account_id}.r2.cloudflarestorage.com`;
}

export function getConfiguredStorageProviderContracts(
  configs: Configs
): StorageProviderContract[] {
  const providers: StorageProviderContract[] = [];

  if (canBuildR2StorageProvider(configs)) {
    providers.push({
      name: 'r2',
      isDefault: true,
      configs: {
        endpoint: resolveR2Endpoint(configs),
        region: 'auto',
        accessKeyId: configs.r2_access_key,
        secretAccessKey: configs.r2_secret_key,
        bucket: configs.r2_bucket_name,
        publicDomain: configs.r2_domain || undefined,
      },
    });
  }

  if (canBuildS3StorageProvider(configs)) {
    providers.push({
      name: 's3',
      isDefault: false,
      configs: {
        endpoint: configs.s3_endpoint,
        region: configs.s3_region,
        accessKeyId: configs.s3_access_key,
        secretAccessKey: configs.s3_secret_key,
        bucket: configs.s3_bucket,
        publicDomain: configs.s3_domain || undefined,
      },
    });
  }

  return providers;
}
