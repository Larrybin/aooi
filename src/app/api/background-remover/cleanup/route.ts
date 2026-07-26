import { cleanupExpiredBackgroundRemoverImages } from '@/domains/background-remover/application/cleanup';
import {
  listExpiredBackgroundRemoverImages,
  markBackgroundRemoverImagesDeletedByIds,
} from '@/domains/background-remover/infra/image';
import { getStorageService } from '@/infra/adapters/storage/service';

import { assertBearerSecret } from '@/shared/lib/api/bearer-secret';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';

import { requireBackgroundRemoverSite } from '../_lib/guard';

export const POST = withApi(async (req: Request) => {
  requireBackgroundRemoverSite();
  assertBearerSecret(req, 'REMOVER_CLEANUP_SECRET');
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
