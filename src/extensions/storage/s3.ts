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
 * S3 storage provider configs
 * @docs https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html
 */
export interface S3Configs extends StorageConfigs {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicDomain?: string;
}

/**
 * S3 storage provider implementation
 * @website https://aws.amazon.com/s3/
 */
export class S3Provider implements StorageProvider {
  readonly name = 's3';
  configs: S3Configs;

  constructor(configs: S3Configs) {
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

    const url = `${this.configs.endpoint}/${uploadBucket}/${options.key}`;
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
        region: this.configs.region,
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
 * Create S3 provider with configs
 */
export function createS3Provider(configs: S3Configs): S3Provider {
  return new S3Provider(configs);
}
