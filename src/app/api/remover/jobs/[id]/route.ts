import { createApiContext } from '@/app/api/_lib/context';
import {
  claimRemoverJobForActor,
  getRemoverJobForActor,
} from '@/domains/remover/application/jobs';
import { storeRemoverOutputImage } from '@/domains/remover/application/output';
import {
  refreshRemoverJobStatus,
  submitRemoverJobToProvider,
} from '@/domains/remover/application/processing';
import { getStorageService } from '@/infra/adapters/storage/service';
import {
  claimRemoverImageAssetsByKeys,
  createRemoverImageAssets,
  findActiveRemoverImageAssetById,
} from '@/domains/remover/infra/image-asset';
import {
  claimRemoverJobForProviderSubmission,
  claimRemoverJobById,
  findRemoverJobById,
  updateRemoverJobById,
} from '@/domains/remover/infra/job';
import {
  claimRemoverQuotaReservationById,
  commitRemoverQuotaReservation,
  refundRemoverQuotaReservation,
} from '@/domains/remover/infra/quota-reservation';

import { withApi } from '@/shared/lib/api/route';

import { requireRemoverSite } from '../../_lib/guard';
import { resolveRemoverActor } from '../../actor.server';
import { resolveRemoverProviderAdapter } from '../../provider-adapter.server';
import { createRemoverJobGetAction } from './action';

const getAction = createRemoverJobGetAction({
  createApiContext,
  resolveActor: resolveRemoverActor,
  getRemoverJobForActor,
  claimRemoverJobForActor,
  refreshRemoverJobStatus,
  submitRemoverJobToProvider,
  resolveProviderAdapter: resolveRemoverProviderAdapter,
  jobDeps: {
    findJobById: findRemoverJobById,
  },
  claimDeps: {
    claimJobById: claimRemoverJobById,
    claimAssetsByKeys: claimRemoverImageAssetsByKeys,
    claimReservationById: claimRemoverQuotaReservationById,
  },
  refreshDeps: {
    findJobById: findRemoverJobById,
    updateJob: updateRemoverJobById,
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
});

export const GET = withApi(
  (req: Request, context: { params: Promise<{ id: string }> }) => {
    requireRemoverSite();
    return getAction(req, context);
  }
);
