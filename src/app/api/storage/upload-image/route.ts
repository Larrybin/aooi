import type { createApiContext } from '@/app/api/_lib/context';
import type { getStorageService } from '@/infra/adapters/storage/service';
import { isCloudflareWorkersRuntime } from '@/infra/runtime/env.server';

import { BadRequestError, TooManyRequestsError } from '@/shared/lib/api/errors';
import { FixedWindowQuotaLimiter } from '@/shared/lib/api/limiters';
import { LimiterBucket } from '@/shared/lib/api/limiters-config';
import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import {
  resolveConfigConsistencyMode,
  type ConfigConsistencyMode,
} from '@/shared/lib/config-consistency';
import { CloudflareQuotaLimiter } from '@/shared/platform/cloudflare/stateful-limiters';

import type { uploadImageFiles } from './upload-image-files';

// The concurrency limiter caps parallel uploads only: a lease is released the moment a
// request finishes, so nothing stops an account from writing to the public bucket
// forever. This window limiter is the volume gate. Parallelism stays the concurrency
// limiter's job, so maxConcurrent tracks maxAttempts rather than adding a second
// ceiling that would reject before the count budget is spent.
const STORAGE_UPLOAD_RATE_LIMIT_MAX_PER_WINDOW = 60;
const STORAGE_UPLOAD_RATE_LIMIT_CONFIG = {
  bucket: LimiterBucket.API_STORAGE_UPLOAD,
  windowMs: 60 * 60 * 1000,
  maxAttempts: STORAGE_UPLOAD_RATE_LIMIT_MAX_PER_WINDOW,
  maxConcurrent: STORAGE_UPLOAD_RATE_LIMIT_MAX_PER_WINDOW,
} as const;

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
  rateLimiter: {
    acquire: (
      key: string,
      now?: number
    ) => Promise<{ allowed: boolean; reason?: string }>;
    release: (key: string, now?: number) => Promise<void>;
  };
};

// Both limiters live in the API_STORAGE_UPLOAD bucket and would otherwise read and
// write the same per-user record, so the window limiter namespaces its scope key.
function buildStorageUploadRateLimitKey(userId: string): string {
  return `rate:${userId}`;
}

// createLimiterFactory owns no storage upload window limiter, so mirror the runtime
// dispatch it does for every other bucket: Durable Objects on Workers, memory on Node.
function createStorageUploadRateLimiter() {
  return isCloudflareWorkersRuntime()
    ? new CloudflareQuotaLimiter(STORAGE_UPLOAD_RATE_LIMIT_CONFIG)
    : new FixedWindowQuotaLimiter(STORAGE_UPLOAD_RATE_LIMIT_CONFIG);
}

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
    rateLimiter: createStorageUploadRateLimiter(),
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
    const rateLimitKey = buildStorageUploadRateLimitKey(user.id);
    const rateLimit = await deps.rateLimiter.acquire(rateLimitKey);
    if (!rateLimit.allowed) {
      log.warn('[API] storage upload throttled', {
        userId: user.id,
        reason: rateLimit.reason,
      });
      throw new TooManyRequestsError('rate limited');
    }

    try {
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
    } finally {
      await deps.rateLimiter.release(rateLimitKey);
    }
  };
}

export const POST = withApi(buildStorageUploadImagePostLogic());
