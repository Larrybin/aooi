import { BadRequestError, TooManyRequestsError } from '@/shared/lib/api/errors';
import type { createApiContext } from '@/app/api/_lib/context';
import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import {
  resolveConfigConsistencyMode,
  type ConfigConsistencyMode,
} from '@/shared/lib/config-consistency';
import type { getStorageService } from '@/infra/adapters/storage/service';
import type { uploadImageFiles } from './upload-image-files';

type MaybePromise<T> = T | Promise<T>;
type ApiContextLike = Pick<
  Awaited<ReturnType<typeof createApiContext>>,
  'log' | 'requireUser'
>;

type StorageUploadRouteDeps = {
  resolveConfigConsistencyMode: typeof resolveConfigConsistencyMode;
  getApiContext: (req: Request) => MaybePromise<ApiContextLike>;
  readUploadRequestInput: (req: Request) => Promise<{
    entries: unknown[];
    files: File[];
    runtimePlatform: string;
  }>;
  uploadImageFiles: typeof uploadImageFiles;
  getStorageService: typeof getStorageService;
  concurrencyLimiter: {
    acquire: (key: string, now?: number) => Promise<boolean>;
    release: (key: string, now?: number) => Promise<void>;
  };
};

function getDefaultStorageUploadRouteDeps(): StorageUploadRouteDeps {
  return {
    resolveConfigConsistencyMode,
    getApiContext: async (req) => {
      const mod = await import('@/app/api/_lib/context');
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
    getStorageService: async (options) => {
      const mod = await import('@/infra/adapters/storage/service');
      return await mod.getStorageService(options);
    },
    concurrencyLimiter:
      createLimiterFactory().createStorageUploadConcurrencyLimiter(),
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
    const mode: ConfigConsistencyMode = deps.resolveConfigConsistencyMode(req);
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
        deps: {
          getStorageService: () => deps.getStorageService({ mode }),
          log,
        },
      });

      return jsonOk({
        results: uploadResults,
      });
    } finally {
      await deps.concurrencyLimiter.release(user.id);
    }
  };
}

export const POST = withApi(buildStorageUploadImagePostLogic());
