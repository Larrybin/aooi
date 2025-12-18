import { v4 as uuidv4 } from 'uuid';

import { BadRequestError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getRequestLogger } from '@/shared/lib/request-logger.server';
import { getStorageService } from '@/shared/services/storage';

const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per file

function safeFileExt(filename: string) {
  const ext = filename.split('.').pop() || '';
  const normalized = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized.slice(0, 10) || 'bin';
}

export const POST = withApi(async (req: Request) => {
  const { log } = getRequestLogger(req);
  const formData = await req.formData();
  const files = formData.getAll('files') as File[];

  if (!files || files.length === 0) {
    throw new BadRequestError('no files provided');
  }

  if (files.length > MAX_FILES) {
    throw new BadRequestError(`too many files (max ${MAX_FILES})`);
  }

  const uploadResults: Array<{ url: string; key: string; filename: string }> =
    [];

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      throw new BadRequestError(`file ${file.name} is not an image`);
    }

    if (!file.size || file.size <= 0) {
      throw new BadRequestError(`file ${file.name} is empty`);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestError(
        `file ${file.name} is too large (max ${MAX_FILE_SIZE_BYTES} bytes)`
      );
    }

    const ext = safeFileExt(file.name);
    const key = `uploads/${Date.now()}-${uuidv4()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const storageService = await getStorageService();

    const result = await storageService.uploadFile({
      body: buffer,
      key: key,
      contentType: file.type,
      disposition: 'inline',
    });

    if (!result.success) {
      log.error('[API] Upload failed', { error: result.error });
      throw new Error(result.error || 'upload failed');
    }
    if (!result.url || !result.key) {
      log.error('[API] Upload response missing url/key', { result });
      throw new Error('upload succeeded but returned no url/key');
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
