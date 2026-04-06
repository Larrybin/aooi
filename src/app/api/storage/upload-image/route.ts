import { createApiContext } from '@/shared/lib/api/context';
import { BadRequestError, TooManyRequestsError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getStorageService } from '@/shared/services/storage';

import { isFileValue, uploadImageFiles } from './upload-image-files';

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

    const uploadResults = await uploadImageFiles({
      files,
      deps: { getStorageService, log },
    });

    return jsonOk({
      urls: uploadResults.map((r) => r.url),
      results: uploadResults,
    });
  } finally {
    releaseUploadSlot(user.id);
  }
});
