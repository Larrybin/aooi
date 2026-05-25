import type { ProductActor } from '@/domains/product-access/domain/actor';
import type { ProductOwner } from '@/domains/product-access/domain/ownership';
import type { StorageService } from '@/infra/adapters/storage/service-builder';

import { NotFoundError } from '@/shared/lib/api/errors';

import type {
  BackgroundRemoverImage,
  findBackgroundRemoverImageByIdForOwner,
} from '../infra/image';

export type ReadBackgroundRemoverResultDeps = {
  findImageByIdForOwner: typeof findBackgroundRemoverImageByIdForOwner;
  storageService: Pick<StorageService, 'getFile'>;
  now?: () => Date;
};

export type BackgroundRemoverResultFile = {
  image: BackgroundRemoverImage;
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength: number | null;
};

function getBackgroundRemoverReadOwner(actor: ProductActor): ProductOwner {
  if (actor.kind === 'user') {
    return {
      userId: actor.userId,
      anonymousSessionId: actor.anonymousSessionId ?? null,
    };
  }

  return {
    userId: null,
    anonymousSessionId: actor.anonymousSessionId,
  };
}

export async function readBackgroundRemoverResultFile({
  actor,
  id,
  deps,
}: {
  actor: ProductActor;
  id: string;
  deps: ReadBackgroundRemoverResultDeps;
}): Promise<BackgroundRemoverResultFile> {
  const image = await deps.findImageByIdForOwner({
    id,
    owner: getBackgroundRemoverReadOwner(actor),
  });
  if (!image) {
    throw new NotFoundError('result not found');
  }

  const now = (deps.now ?? (() => new Date()))();
  if (image.expiresAt <= now) {
    throw new NotFoundError('result expired');
  }

  const file = await deps.storageService.getFile(image.resultStorageKey);
  if (!file?.body) {
    throw new NotFoundError('result not found');
  }

  return {
    image,
    body: file.body,
    contentType: file.contentType || image.resultMimeType || 'image/png',
    contentLength: file.contentLength,
  };
}
