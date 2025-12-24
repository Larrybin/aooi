import {
  BadRequestError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';
import {
  exactProviderNameKey,
  ProviderRegistry,
} from '@/shared/lib/providers/provider-registry';

/**
 * Storage upload options interface
 */
export interface StorageUploadOptions {
  body: Buffer | Uint8Array;
  key: string;
  contentType?: string;
  bucket?: string;
  onProgress?: (progress: number) => void;
  disposition?: 'inline' | 'attachment';
}

/**
 * Storage download and upload options interface
 */
export interface StorageDownloadUploadOptions {
  url: string;
  key: string;
  bucket?: string;
  contentType?: string;
  disposition?: 'inline' | 'attachment';
}

/**
 * Storage upload result interface
 */
export interface StorageUploadResult {
  success: boolean;
  location?: string;
  bucket?: string;
  key?: string;
  filename?: string;
  url?: string;
  error?: string;
  provider: string;
}

/**
 * Storage configs interface
 */
export interface StorageConfigs {
  [key: string]: unknown;
}

export function toUint8Array(
  body: Buffer | Uint8Array
): Uint8Array<ArrayBuffer> {
  const uint8Array = body instanceof Uint8Array ? body : new Uint8Array(body);

  if (uint8Array.buffer instanceof ArrayBuffer) {
    return uint8Array as Uint8Array<ArrayBuffer>;
  }

  const buffer = new ArrayBuffer(uint8Array.byteLength);
  new Uint8Array(buffer).set(uint8Array);
  return new Uint8Array(buffer);
}

/**
 * Storage provider interface
 */
export interface StorageProvider {
  // provider name
  readonly name: string;

  // provider configs
  configs: StorageConfigs;

  // upload file
  uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult>;

  // download and upload
  downloadAndUpload(
    options: StorageDownloadUploadOptions
  ): Promise<StorageUploadResult>;
}

/**
 * Storage manager to manage all storage providers
 */
export class StorageManager {
  private readonly registry = new ProviderRegistry<StorageProvider>({
    toNameKey: exactProviderNameKey,
    memoizeDefault: true,
  });

  // add storage provider
  addProvider(provider: StorageProvider, isDefault = false) {
    this.registry.add(provider, isDefault);
  }

  // get provider by name
  getProvider(name: string): StorageProvider | undefined {
    return this.registry.get(name);
  }

  // upload file using default provider
  async uploadFile(
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    const defaultProvider = this.registry.getDefault();
    if (!defaultProvider) {
      throw new ServiceUnavailableError('No storage provider configured');
    }

    return defaultProvider.uploadFile(options);
  }

  // upload file using specific provider
  async uploadFileWithProvider(
    options: StorageUploadOptions,
    providerName: string
  ): Promise<StorageUploadResult> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new BadRequestError(`Storage provider '${providerName}' not found`);
    }
    return provider.uploadFile(options);
  }

  // download and upload using default provider
  async downloadAndUpload(
    options: StorageDownloadUploadOptions
  ): Promise<StorageUploadResult> {
    const defaultProvider = this.registry.getDefault();
    if (!defaultProvider) {
      throw new ServiceUnavailableError('No storage provider configured');
    }

    return defaultProvider.downloadAndUpload(options);
  }

  // download and upload using specific provider
  async downloadAndUploadWithProvider(
    options: StorageDownloadUploadOptions,
    providerName: string
  ): Promise<StorageUploadResult> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new BadRequestError(`Storage provider '${providerName}' not found`);
    }
    return provider.downloadAndUpload(options);
  }

  // get all provider names
  getProviderNames(): string[] {
    return this.registry.getProviderNames();
  }
}

// Global storage manager instance
export const storageManager = new StorageManager();

// Providers are exported via `./providers` (server-only)
