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

// Providers are exported via `./providers` (server-only)
