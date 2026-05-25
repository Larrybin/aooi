import type { StorageService } from '@/infra/adapters/storage/service-builder';

import type { BackgroundRemoverImage } from '../infra/image';

type CleanupDeps = {
  listExpiredImages: (input: {
    now: Date;
    limit?: number;
  }) => Promise<BackgroundRemoverImage[]>;
  markImagesDeletedByIds: (input: {
    ids: string[];
    now?: Date;
  }) => Promise<unknown>;
  storageService: Pick<StorageService, 'deleteFiles'>;
  now?: () => Date;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function cleanupExpiredBackgroundRemoverImages({
  limit = 100,
  deps,
}: {
  limit?: number;
  deps: CleanupDeps;
}) {
  const now = (deps.now ?? (() => new Date()))();
  const images = await deps.listExpiredImages({ now, limit });
  const storageKeys = unique(
    images.flatMap((image) => [
      image.originalStorageKey,
      image.resultStorageKey,
    ])
  );

  if (storageKeys.length) {
    await deps.storageService.deleteFiles(storageKeys);
  }

  if (images.length) {
    await deps.markImagesDeletedByIds({
      ids: images.map((image) => image.id),
      now,
    });
  }

  return {
    deletedImages: images.length,
    deletedObjects: storageKeys.length,
  };
}
