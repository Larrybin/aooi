import { createApiContext } from '@/app/api/_lib/context';
import { createQueuedRemoverJob } from '@/domains/remover/application/jobs';
import { resolveRemoverActor } from '@/domains/remover/application/actor';
import { storeRemoverOutputImage } from '@/domains/remover/application/output';
import { submitRemoverJobToProvider } from '@/domains/remover/application/processing';
import { resolveRemoverProviderAdapter } from '@/domains/remover/application/provider';
import { getStorageService } from '@/infra/adapters/storage/service';
import {
  createRemoverImageAssets,
  findActiveRemoverImageAssetById,
} from '@/domains/remover/infra/image-asset';
import {
  createRemoverJobWithQuotaReservation,
  claimRemoverJobForProviderSubmission,
  findRemoverJobById,
  findRemoverJobByQuotaReservationId,
  updateRemoverJobById,
} from '@/domains/remover/infra/job';
import {
  findRemoverQuotaReservationByIdempotencyKey,
  commitRemoverQuotaReservation,
  refundRemoverQuotaReservation,
} from '@/domains/remover/infra/quota-reservation';

import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { withApi } from '@/shared/lib/api/route';

import { requireRemoverSite } from '../_lib/guard';
import { acquireRemoverGuestIpLimit } from '../guest-ip-limit';
import { createRemoverJobsPostAction } from './action';

const postAction = createRemoverJobsPostAction({
  createApiContext,
  resolveActor: resolveRemoverActor,
  createQueuedRemoverJob,
  resolveProviderAdapter: resolveRemoverProviderAdapter,
  submitRemoverJobToProvider,
  jobDeps: {
    findAsset: findActiveRemoverImageAssetById,
    findReservationByIdempotencyKey: findRemoverQuotaReservationByIdempotencyKey,
    createJobWithReservation: createRemoverJobWithQuotaReservation,
    findJobByQuotaReservationId: findRemoverJobByQuotaReservationId,
    findJobById: async () => undefined,
  },
  submitDeps: {
    findJobById: findRemoverJobById,
    findAsset: findActiveRemoverImageAssetById,
    updateJob: updateRemoverJobById,
    claimJobForProviderSubmission: claimRemoverJobForProviderSubmission,
    commitReservation: commitRemoverQuotaReservation,
    refundReservation: refundRemoverQuotaReservation,
    storeOutputImage: async ({ job, outputImageUrl }) => {
      const result = await storeRemoverOutputImage({
        job,
        outputImageUrl,
        deps: {
          storageService: await getStorageService(),
          createAssets: createRemoverImageAssets,
        },
      });
      return {
        outputStorageKey: result.outputAsset.storageKey,
        thumbnailStorageKey: result.thumbnailAsset.storageKey,
      };
    },
  },
  acquireGuestIpLimit: ({ actor, req }) =>
    acquireRemoverGuestIpLimit({
      actor,
      req,
      limiter: createLimiterFactory().createRemoverGuestJobLimiter(),
    }),
});

export const POST = withApi((req: Request) => {
  requireRemoverSite();
  return postAction(req);
});
