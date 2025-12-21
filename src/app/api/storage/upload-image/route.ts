import { v4 as uuidv4 } from 'uuid';

import { BadRequestError, UpstreamError } from '@/shared/lib/api/errors';
import { requireUser } from '@/shared/lib/api/guard';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getRequestLogger } from '@/shared/lib/request-logger.server';
import { getStorageService } from '@/shared/services/storage';

const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per file

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

const DISALLOWED_IMAGE_MIME_TYPES = new Set(['image/svg+xml', 'image/svg']);

function isFileValue(value: FormDataEntryValue): value is File {
  return typeof value === 'object' && value !== null && 'arrayBuffer' in value;
}

function safeFileExt(filename: string) {
  const ext = filename.split('.').pop() || '';
  const normalized = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized.slice(0, 10) || 'bin';
}

export const POST = withApi(async (req: Request) => {
  const { log } = getRequestLogger(req);
  await requireUser(req);
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

  for (const file of files) {
    if (!file.type || !file.type.startsWith('image/')) {
      throw new BadRequestError(`file ${file.name} is not an image`);
    }

    if (DISALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
      throw new BadRequestError(`file ${file.name} is not a supported image`);
    }

    if (!file.size || file.size <= 0) {
      throw new BadRequestError(`file ${file.name} is empty`);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestError(
        `file ${file.name} is too large (max ${MAX_FILE_SIZE_BYTES} bytes)`
      );
    }

    const ext = IMAGE_EXT_BY_MIME[file.type] || safeFileExt(file.name);
    const key = `uploads/${Date.now()}-${uuidv4()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let result;
    try {
      result = await storageService.uploadFile({
        body: buffer,
        key: key,
        contentType: file.type,
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
});
