import { cleanupExpiredRemoverImages } from '@/domains/remover/application/cleanup';
import {
  listExpiredRemoverImageAssets,
  markRemoverImageAssetsDeletedByKeysAnyOwner,
} from '@/domains/remover/infra/image-asset';
import {
  listExpiredRemoverJobs,
  markRemoverJobsDeletedByIds,
} from '@/domains/remover/infra/job';
import { getStorageService } from '@/infra/adapters/storage/service';

import { assertBearerSecret } from '@/shared/lib/api/bearer-secret';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';

import { requireRemoverSite } from '../_lib/guard';

export const POST = withApi(async (req: Request) => {
  requireRemoverSite();
  assertBearerSecret(req, 'REMOVER_CLEANUP_SECRET');
  const result = await cleanupExpiredRemoverImages({
    deps: {
      listExpiredJobs: listExpiredRemoverJobs,
      listExpiredAssets: listExpiredRemoverImageAssets,
      markJobsDeletedByIds: markRemoverJobsDeletedByIds,
      markAssetsDeletedByKeys: markRemoverImageAssetsDeletedByKeysAnyOwner,
      storageService: await getStorageService(),
    },
  });

  return jsonOk(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
});
