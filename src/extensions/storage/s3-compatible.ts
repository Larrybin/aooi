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

export interface S3CompatibleStorageConfigs extends StorageConfigs {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicDomain?: string;
}

export class S3CompatibleStorageProvider implements StorageProvider {
  readonly name: string;
  configs: S3CompatibleStorageConfigs;

  constructor(name: string, configs: S3CompatibleStorageConfigs) {
    this.name = name;
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

    return await uploadFileToS3CompatibleStorage({
      provider: this.name,
      url: `${this.configs.endpoint}/${uploadBucket}/${options.key}`,
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
