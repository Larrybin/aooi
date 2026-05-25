import { cleanupExpiredBackgroundRemoverImages } from '@/domains/background-remover/application/cleanup';
import {
  listExpiredBackgroundRemoverImages,
  markBackgroundRemoverImagesDeletedByIds,
} from '@/domains/background-remover/infra/image';
import { getStorageService } from '@/infra/adapters/storage/service';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import { ForbiddenError, NotFoundError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';

import { requireBackgroundRemoverSite } from '../_lib/guard';

function assertCleanupSecret(req: Request) {
  const secret = getRuntimeEnvString('REMOVER_CLEANUP_SECRET')?.trim() || '';
  if (!secret) {
    throw new NotFoundError('not found');
  }

  const authorization = req.headers.get('authorization')?.trim() || '';
  if (authorization !== `Bearer ${secret}`) {
    throw new ForbiddenError('forbidden');
  }
}

export const POST = withApi(async (req: Request) => {
  requireBackgroundRemoverSite();
  assertCleanupSecret(req);
  const result = await cleanupExpiredBackgroundRemoverImages({
    deps: {
      listExpiredImages: listExpiredBackgroundRemoverImages,
      markImagesDeletedByIds: markBackgroundRemoverImagesDeletedByIds,
      storageService: await getStorageService(),
    },
  });

  return jsonOk(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
});
