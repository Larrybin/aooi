import { v4 as uuidv4 } from 'uuid';

import { createApiContext } from '@/shared/lib/api/context';
import {
  BadRequestError,
  TooManyRequestsError,
  UpstreamError,
} from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getStorageService } from '@/shared/services/storage';

const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_FILES_SIZE_BYTES = 20 * 1024 * 1024; // 20MB per request

const MAX_CONCURRENT_UPLOADS_GLOBAL = 4;
const MAX_CONCURRENT_UPLOADS_PER_USER = 2;

let activeUploadsGlobal = 0;
const activeUploadsByUserId = new Map<string, number>();

function tryAcquireUploadSlot(userId: string): boolean {
  if (activeUploadsGlobal >= MAX_CONCURRENT_UPLOADS_GLOBAL) return false;

  const current = activeUploadsByUserId.get(userId) || 0;
  if (current >= MAX_CONCURRENT_UPLOADS_PER_USER) return false;

  activeUploadsGlobal += 1;
  activeUploadsByUserId.set(userId, current + 1);
  return true;
}

function releaseUploadSlot(userId: string): void {
  activeUploadsGlobal = Math.max(0, activeUploadsGlobal - 1);
  const current = activeUploadsByUserId.get(userId) || 0;
  if (current <= 1) {
    activeUploadsByUserId.delete(userId);
    return;
  }
  activeUploadsByUserId.set(userId, current - 1);
}

const IMAGE_EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
} as const;

type AllowedImageMimeType = keyof typeof IMAGE_EXT_BY_MIME;

function hasBytesPrefix(buffer: Buffer, prefix: readonly number[]): boolean {
  if (buffer.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i += 1) {
    if (buffer[i] !== prefix[i]) return false;
  }
  return true;
}

function hasAsciiAt(buffer: Buffer, value: string, offset: number): boolean {
  if (offset < 0) return false;
  if (buffer.length < offset + value.length) return false;
  return buffer.toString('ascii', offset, offset + value.length) === value;
}

function isJpeg(buffer: Buffer): boolean {
  return hasBytesPrefix(buffer, [0xff, 0xd8, 0xff]);
}

function isPng(buffer: Buffer): boolean {
  return hasBytesPrefix(
    buffer,
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  );
}

function isGif(buffer: Buffer): boolean {
  return hasAsciiAt(buffer, 'GIF87a', 0) || hasAsciiAt(buffer, 'GIF89a', 0);
}

function isWebp(buffer: Buffer): boolean {
  return hasAsciiAt(buffer, 'RIFF', 0) && hasAsciiAt(buffer, 'WEBP', 8);
}

const AVIF_BRANDS = new Set(['avif', 'avis']);

function isAvif(buffer: Buffer): boolean {
  if (buffer.length < 16) return false;
  if (!hasAsciiAt(buffer, 'ftyp', 4)) return false;

  const boxSize = buffer.readUInt32BE(0);
  let limit = Math.min(buffer.length, 64);
  if (boxSize === 0) {
    // box extends to EOF; keep a small scan window
  } else if (boxSize >= 16 && boxSize <= buffer.length) {
    limit = boxSize;
  } else {
    return false;
  }

  const majorBrand = buffer.toString('ascii', 8, 12);
  if (AVIF_BRANDS.has(majorBrand)) return true;

  for (let offset = 16; offset + 4 <= limit; offset += 4) {
    const brand = buffer.toString('ascii', offset, offset + 4);
    if (AVIF_BRANDS.has(brand)) return true;
  }
  return false;
}

function detectAllowedImageMime(buffer: Buffer): AllowedImageMimeType | null {
  if (isJpeg(buffer)) return 'image/jpeg';
  if (isPng(buffer)) return 'image/png';
  if (isWebp(buffer)) return 'image/webp';
  if (isGif(buffer)) return 'image/gif';
  if (isAvif(buffer)) return 'image/avif';
  return null;
}

function isFileValue(value: FormDataEntryValue): value is File {
  return typeof value === 'object' && value !== null && 'arrayBuffer' in value;
}

export const POST = withApi(async (req: Request) => {
  const api = createApiContext(req);
  const { log } = api;
  const user = await api.requireUser();
  if (!tryAcquireUploadSlot(user.id)) {
    throw new TooManyRequestsError('too many concurrent uploads');
  }

  try {
    const formData = await req.formData();
    const entries = formData.getAll('files');
    const files = entries.filter(isFileValue);

    if (files.length !== entries.length) {
      throw new BadRequestError('invalid files');
    }

    if (!files || files.length === 0) {
      throw new BadRequestError('no files provided');
    }

    if (files.length > MAX_FILES) {
      throw new BadRequestError(`too many files (max ${MAX_FILES})`);
    }

    const uploadResults: Array<{ url: string; key: string; filename: string }> =
      [];

    let storageService;
    try {
      storageService = await getStorageService();
    } catch (error: unknown) {
      log.error('[API] Storage service init failed', { error });
      throw new UpstreamError(503, 'storage service unavailable');
    }

    let totalBytes = 0;
    for (const file of files) {
      if (!file.size || file.size <= 0) {
        throw new BadRequestError(`file ${file.name} is empty`);
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new BadRequestError(
          `file ${file.name} is too large (max ${MAX_FILE_SIZE_BYTES} bytes)`
        );
      }

      totalBytes += file.size;
      if (totalBytes > MAX_TOTAL_FILES_SIZE_BYTES) {
        throw new BadRequestError(
          `total upload size is too large (max ${MAX_TOTAL_FILES_SIZE_BYTES} bytes)`
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const detectedMime = detectAllowedImageMime(buffer);
      if (!detectedMime) {
        throw new BadRequestError(`file ${file.name} is not a supported image`);
      }

      const ext = IMAGE_EXT_BY_MIME[detectedMime];
      const key = `uploads/${Date.now()}-${uuidv4()}.${ext}`;

      let result;
      try {
        result = await storageService.uploadFile({
          body: buffer,
          key: key,
          contentType: detectedMime,
          disposition: 'inline',
        });
      } catch (error: unknown) {
        log.error('[API] Upload threw', { error });
        throw new UpstreamError(503, 'upload service unavailable');
      }

      if (!result.success) {
        log.error('[API] Upload failed', { error: result.error });
        throw new UpstreamError(502, 'upload failed');
      }
      if (!result.url || !result.key) {
        log.error('[API] Upload response missing url/key', { result });
        throw new UpstreamError(502, 'upload failed');
      }

      uploadResults.push({
        url: result.url,
        key: result.key,
        filename: file.name,
      });
    }

    return jsonOk({
      urls: uploadResults.map((r) => r.url),
      results: uploadResults,
    });
  } finally {
    releaseUploadSlot(user.id);
  }
});
