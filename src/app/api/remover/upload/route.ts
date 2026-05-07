import { createApiContext } from '@/app/api/_lib/context';
import { resolveRemoverActor } from '@/domains/remover/application/actor';
import {
  createRemoverImageAsset,
} from '@/domains/remover/infra/image-asset';
import {
  commitRemoverQuotaReservation,
  createRemoverQuotaReservationWithQuotaCheck,
  refundRemoverQuotaReservation,
} from '@/domains/remover/infra/quota-reservation';
import { getStorageService } from '@/infra/adapters/storage/service';

import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { withApi } from '@/shared/lib/api/route';
import { readUploadRequestInput } from '@/shared/lib/runtime/upload';

import { detectAllowedImageMime } from '../../storage/upload-image/upload-image-files';
import { requireRemoverSite } from '../_lib/guard';
import { acquireRemoverGuestIpLimit } from '../guest-ip-limit';
import { createRemoverUploadPostAction } from './action';

const postAction = createRemoverUploadPostAction({
  createApiContext,
  resolveActor: resolveRemoverActor,
  readUploadRequestInput,
  getStorageService,
  detectImageMime: detectAllowedImageMime,
  createAsset: createRemoverImageAsset,
  reserveUploadQuota: createRemoverQuotaReservationWithQuotaCheck,
  commitReservation: commitRemoverQuotaReservation,
  refundReservation: refundRemoverQuotaReservation,
  acquireGuestIpLimit: ({ actor, req }) =>
    acquireRemoverGuestIpLimit({
      actor,
      req,
      limiter: createLimiterFactory().createRemoverGuestUploadLimiter(),
    }),
});

export const POST = withApi((req: Request) => {
  requireRemoverSite();
  return postAction(req);
});
