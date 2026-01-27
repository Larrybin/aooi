import 'server-only';

import { safeFetchFollowingRedirects } from '@/shared/lib/fetch/server';

import {
  toUint8Array,
  type StorageDownloadUploadOptions,
  type StorageUploadOptions,
  type StorageUploadResult,
} from '.';

type AwsClientConfigs = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

export async function uploadFileToS3CompatibleStorage({
  provider,
  url,
  bucket,
  key,
  body,
  contentType,
  disposition,
  publicDomain,
  aws,
}: {
  provider: string;
  url: string;
  bucket: string;
  key: string;
  body: Buffer | Uint8Array;
  contentType?: string;
  disposition?: 'inline' | 'attachment';
  publicDomain?: string;
  aws: AwsClientConfigs;
}): Promise<StorageUploadResult> {
  try {
    const bodyArray = toUint8Array(body);
    const bodyBytes = new Uint8Array(bodyArray);

    const { AwsClient } = await import('aws4fetch');
    const client = new AwsClient(aws);

    const headers: Record<string, string> = {
      'Content-Type': contentType || 'application/octet-stream',
      'Content-Disposition': disposition || 'inline',
      'Content-Length': bodyBytes.length.toString(),
    };

    const request = new Request(url, {
      method: 'PUT',
      headers,
      body: new Blob([bodyBytes]),
    });

    const response = await client.fetch(request);

    if (!response.ok) {
      return {
        success: false,
        error: `Upload failed: ${response.statusText}`,
        provider,
      };
    }

    const publicUrl = publicDomain ? `${publicDomain}/${key}` : url;

    return {
      success: true,
      location: url,
      bucket,
      key,
      filename: key.split('/').pop(),
      url: publicUrl,
      provider,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider,
    };
  }
}

export async function downloadAndUploadFromUrl({
  provider,
  options,
  upload,
}: {
  provider: string;
  options: StorageDownloadUploadOptions;
  upload: (options: StorageUploadOptions) => Promise<StorageUploadResult>;
}): Promise<StorageUploadResult> {
  try {
    const response = await safeFetchFollowingRedirects(
      options.url,
      { method: 'GET' },
      { timeoutMs: 30000, cache: 'no-store', maxRedirects: 5 }
    );
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP error! status: ${response.status}`,
        provider,
      };
    }

    if (!response.body) {
      return {
        success: false,
        error: 'No body in response',
        provider,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const body = new Uint8Array(arrayBuffer);

    return await upload({
      body,
      key: options.key,
      bucket: options.bucket,
      contentType: options.contentType,
      disposition: options.disposition,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider,
    };
  }
}
