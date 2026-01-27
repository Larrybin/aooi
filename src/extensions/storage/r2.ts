import 'server-only';

import {
  type StorageConfigs,
  type StorageDownloadUploadOptions,
  type StorageProvider,
  type StorageUploadOptions,
  type StorageUploadResult,
} from '.';
import {
  downloadAndUploadFromUrl,
  uploadFileToS3CompatibleStorage,
} from './s3-compat';

/**
 * R2 storage provider configs
 * @docs https://developers.cloudflare.com/r2/
 */
export interface R2Configs extends StorageConfigs {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region?: string;
  endpoint?: string;
  publicDomain?: string;
}

/**
 * R2 storage provider implementation
 * @website https://www.cloudflare.com/products/r2/
 */
export class R2Provider implements StorageProvider {
  readonly name = 'r2';
  configs: R2Configs;

  constructor(configs: R2Configs) {
    this.configs = configs;
  }

  async uploadFile(
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    const uploadBucket = options.bucket || this.configs.bucket;
    if (!uploadBucket) {
      return {
        success: false,
        error: 'Bucket is required',
        provider: this.name,
      };
    }

    // R2 endpoint format: https://<accountId>.r2.cloudflarestorage.com
    // Use custom endpoint if provided, otherwise use default
    const endpoint =
      this.configs.endpoint ||
      `https://${this.configs.accountId}.r2.cloudflarestorage.com`;
    const url = `${endpoint}/${uploadBucket}/${options.key}`;

    // R2 uses "auto" as region for S3 API compatibility
    return await uploadFileToS3CompatibleStorage({
      provider: this.name,
      url,
      bucket: uploadBucket,
      key: options.key,
      body: options.body,
      contentType: options.contentType,
      disposition: options.disposition,
      publicDomain: this.configs.publicDomain,
      aws: {
        accessKeyId: this.configs.accessKeyId,
        secretAccessKey: this.configs.secretAccessKey,
        region: this.configs.region || 'auto',
      },
    });
  }

  async downloadAndUpload(
    options: StorageDownloadUploadOptions
  ): Promise<StorageUploadResult> {
    return await downloadAndUploadFromUrl({
      provider: this.name,
      options,
      upload: (uploadOptions) => this.uploadFile(uploadOptions),
    });
  }
}

/**
 * Create R2 provider with configs
 */
export function createR2Provider(configs: R2Configs): R2Provider {
  return new R2Provider(configs);
}
