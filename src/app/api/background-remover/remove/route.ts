import { removeImageBackground } from '@/domains/background-remover/application/remove-background';
import type { BackgroundRemoverActor } from '@/domains/background-remover/domain/types';
import {
  createBackgroundRemoverImage,
  markBackgroundRemoverImagesDeletedByIds,
} from '@/domains/background-remover/infra/image';
import {
  commitBackgroundRemoverQuotaReservation,
  refundBackgroundRemoverQuotaReservation,
  reserveBackgroundRemoverQuota,
} from '@/domains/background-remover/infra/quota';
import { getStorageService } from '@/infra/adapters/storage/service';
import { getCloudflareImagesBinding } from '@/infra/runtime/env.server';
import { z } from 'zod';

import { BadRequestError, TooManyRequestsError } from '@/shared/lib/api/errors';
import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { readUploadRequestInput } from '@/shared/lib/runtime/upload';

import { requireBackgroundRemoverSite } from '../_lib/guard';
import { detectAllowedImageMime } from '../../storage/upload-image/upload-image-files';
import { resolveBackgroundRemoverActor } from '../actor.server';

const BACKGROUND_REMOVER_UPLOAD_REQUEST_BYTES = 22 * 1024 * 1024;
const DimensionSchema = z.coerce.number().int().positive().max(100000);

// The guest quota is keyed by an anonymous cookie the caller can drop and re-mint on
// every request, so it cannot bound anything on its own. Guests are metered per client
// IP as well, before the request body (and an Images conversion) is spent. Limiter
// buckets are site scoped, so reusing the remover guest job budget here shares its
// shape (2 removals per day, matching the guest plan limit) but not its state.
const guestIpLimiter = createLimiterFactory().createRemoverGuestJobLimiter();

function parseDimension(formData: FormData, key: string): number {
  const result = DimensionSchema.safeParse(formData.get(key));
  if (!result.success) {
    throw new BadRequestError(`invalid ${key}`);
  }
  return result.data;
}

function resolveClientIp(req: Request): string {
  const cloudflareIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cloudflareIp) {
    return cloudflareIp;
  }

  const forwardedFor = req.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  return forwardedFor || 'unknown';
}

async function acquireGuestIpLimit(
  actor: BackgroundRemoverActor,
  req: Request
): Promise<(() => Promise<void>) | undefined> {
  if (actor.kind !== 'anonymous') {
    return;
  }

  const key = resolveClientIp(req);
  const result = await guestIpLimiter.acquire(key);
  if (!result.allowed) {
    throw new TooManyRequestsError('background remover guest limit exceeded', {
      reason: result.reason,
    });
  }

  return () => guestIpLimiter.release(key);
}

export const POST = withApi(async (req: Request) => {
  requireBackgroundRemoverSite();
  const actor = await resolveBackgroundRemoverActor(req);
  const releaseGuestIpLimit = await acquireGuestIpLimit(actor, req);

  try {
    const { entries, files, formData } = await readUploadRequestInput(
      req,
      'image',
      BACKGROUND_REMOVER_UPLOAD_REQUEST_BYTES
    );

    if (entries.length !== files.length || files.length !== 1) {
      throw new BadRequestError('exactly one image file is required');
    }

    const result = await removeImageBackground({
      actor,
      file: files[0]!,
      width: parseDimension(formData, 'width'),
      height: parseDimension(formData, 'height'),
      deps: {
        storageService: await getStorageService(),
        images: getCloudflareImagesBinding(),
        detectImageMime: detectAllowedImageMime,
        createImage: createBackgroundRemoverImage,
        markImagesDeletedByIds: markBackgroundRemoverImagesDeletedByIds,
        reserveQuota: reserveBackgroundRemoverQuota,
        commitReservation: commitBackgroundRemoverQuotaReservation,
        refundReservation: refundBackgroundRemoverQuotaReservation,
      },
    });

    return jsonOk(result, { headers: { 'Cache-Control': 'no-store' } });
  } finally {
    await releaseGuestIpLimit?.();
  }
});
