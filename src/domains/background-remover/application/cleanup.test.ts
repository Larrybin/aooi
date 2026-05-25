import assert from 'node:assert/strict';
import test from 'node:test';

import { cleanupExpiredBackgroundRemoverImages } from './cleanup';

test('cleanupExpiredBackgroundRemoverImages deletes original and result keys', async () => {
  const deletedKeys: string[][] = [];
  const markedIds: string[][] = [];

  const result = await cleanupExpiredBackgroundRemoverImages({
    deps: {
      listExpiredImages: async () => [
        {
          id: 'result_1',
          userId: null,
          anonymousSessionId: 'anon_1',
          originalStorageKey: 'original.png',
          resultStorageKey: 'result.png',
          originalMimeType: 'image/png',
          resultMimeType: 'image/png',
          originalByteSize: 11,
          resultByteSize: 3,
          width: 100,
          height: 100,
          status: 'active',
          quotaReservationId: 'reservation_1',
          createdAt: new Date('2026-05-25T00:00:00Z'),
          updatedAt: new Date('2026-05-25T00:00:00Z'),
          deletedAt: null,
          expiresAt: new Date('2026-05-25T00:00:00Z'),
        },
      ],
      markImagesDeletedByIds: async ({ ids }) => {
        markedIds.push(ids);
      },
      storageService: {
        async deleteFiles(keys) {
          deletedKeys.push(keys);
        },
      },
      now: () => new Date('2026-05-26T00:00:00Z'),
    },
  });

  assert.deepEqual(deletedKeys, [['original.png', 'result.png']]);
  assert.deepEqual(markedIds, [['result_1']]);
  assert.deepEqual(result, { deletedImages: 1, deletedObjects: 2 });
});
