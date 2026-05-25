import { removeImageBackground } from '@/domains/background-remover/application/remove-background';
import { createBackgroundRemoverImage } from '@/domains/background-remover/infra/image';
import {
  commitBackgroundRemoverQuotaReservation,
  refundBackgroundRemoverQuotaReservation,
  reserveBackgroundRemoverQuota,
} from '@/domains/background-remover/infra/quota';
import { getStorageService } from '@/infra/adapters/storage/service';
import { getCloudflareImagesBinding } from '@/infra/runtime/env.server';
import { z } from 'zod';

import { BadRequestError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { readUploadRequestInput } from '@/shared/lib/runtime/upload';

import { requireBackgroundRemoverSite } from '../_lib/guard';
import { detectAllowedImageMime } from '../../storage/upload-image/upload-image-files';
import { resolveBackgroundRemoverActor } from '../actor.server';

const BACKGROUND_REMOVER_UPLOAD_REQUEST_BYTES = 22 * 1024 * 1024;
const DimensionSchema = z.coerce.number().int().positive().max(100000);

function parseDimension(formData: FormData, key: string): number {
  const result = DimensionSchema.safeParse(formData.get(key));
  if (!result.success) {
    throw new BadRequestError(`invalid ${key}`);
  }
  return result.data;
}

export const POST = withApi(async (req: Request) => {
  requireBackgroundRemoverSite();
  const actor = await resolveBackgroundRemoverActor(req);
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
      reserveQuota: reserveBackgroundRemoverQuota,
      commitReservation: commitBackgroundRemoverQuotaReservation,
      refundReservation: refundBackgroundRemoverQuotaReservation,
    },
  });

  return jsonOk(result, { headers: { 'Cache-Control': 'no-store' } });
});
