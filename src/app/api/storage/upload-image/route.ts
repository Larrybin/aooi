import { BadRequestError, TooManyRequestsError } from '@/shared/lib/api/errors';
import type { createApiContext } from '@/shared/lib/api/context';
import { DualConcurrencyLimiter } from '@/shared/lib/api/limiters';
import { STORAGE_UPLOAD_CONCURRENCY_LIMIT_CONFIG } from '@/shared/lib/api/limiters-config';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import type { getStorageService } from '@/shared/services/storage';
import type { uploadImageFiles } from './upload-image-files';

type MaybePromise<T> = T | Promise<T>;
type ApiContextLike = Pick<
  Awaited<ReturnType<typeof createApiContext>>,
  'log' | 'requireUser'
>;

type StorageUploadRouteDeps = {
  getApiContext: (req: Request) => MaybePromise<ApiContextLike>;
  readUploadRequestInput: (req: Request) => Promise<{
    entries: unknown[];
    files: File[];
    runtimePlatform: string;
  }>;
  uploadImageFiles: typeof uploadImageFiles;
  getStorageService: typeof getStorageService;
  concurrencyLimiter: Pick<DualConcurrencyLimiter, 'acquire' | 'release'>;
};

function getDefaultStorageUploadRouteDeps(): StorageUploadRouteDeps {
  return {
    getApiContext: async (req) => {
      const mod = await import('@/shared/lib/api/context');
      return mod.createApiContext(req) as ApiContextLike;
    },
    readUploadRequestInput: async (req) => {
      const mod = await import('@/shared/lib/runtime/upload');
      return await mod.readUploadRequestInput(req);
    },
    uploadImageFiles: async (input) => {
      const mod = await import('./upload-image-files');
      return await mod.uploadImageFiles(input);
    },
    getStorageService: async () => {
      const mod = await import('@/shared/services/storage');
      return await mod.getStorageService();
    },
    concurrencyLimiter: new DualConcurrencyLimiter(
      STORAGE_UPLOAD_CONCURRENCY_LIMIT_CONFIG
    ),
  };
}

export function createStorageUploadImagePostHandler(
  overrides: Partial<StorageUploadRouteDeps> = {}
) {
  return withApi(buildStorageUploadImagePostLogic(overrides));
}

function buildStorageUploadImagePostLogic(
  overrides: Partial<StorageUploadRouteDeps> = {}
) {
  const deps = { ...getDefaultStorageUploadRouteDeps(), ...overrides };

  return async (req: Request) => {
    const api = await deps.getApiContext(req);
    const { log } = api;
    const user = await api.requireUser();
    if (!(await deps.concurrencyLimiter.acquire(user.id))) {
      throw new TooManyRequestsError('too many concurrent uploads');
    }

    try {
      const { entries, files, runtimePlatform } =
        await deps.readUploadRequestInput(req);

      if (files.length !== entries.length) {
        throw new BadRequestError('invalid files');
      }

      log.debug('storage: upload request accepted', {
        runtimePlatform,
        fileCount: files.length,
      });

      const uploadResults = await deps.uploadImageFiles({
        files,
        deps: { getStorageService: deps.getStorageService, log },
      });

      return jsonOk({
        urls: uploadResults.map((r) => r.url),
        results: uploadResults,
      });
    } finally {
      await deps.concurrencyLimiter.release(user.id);
    }
  };
}

export const POST = withApi(buildStorageUploadImagePostLogic());
