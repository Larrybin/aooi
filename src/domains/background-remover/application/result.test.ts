import assert from 'node:assert/strict';
import test from 'node:test';

import { readBackgroundRemoverResultFile } from './result';

test('readBackgroundRemoverResultFile returns owned active PNG stream', async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });

  const result = await readBackgroundRemoverResultFile({
    actor: { kind: 'anonymous', anonymousSessionId: 'anon_1' },
    id: 'result_1',
    deps: {
      findImageByIdForOwner: async ({ owner }) => ({
        id: 'result_1',
        userId: owner.userId,
        anonymousSessionId: owner.anonymousSessionId,
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
        expiresAt: new Date('2026-05-26T00:00:00Z'),
      }),
      storageService: {
        async getFile(key) {
          assert.equal(key, 'result.png');
          return {
            body,
            contentType: 'image/png',
            contentLength: 3,
          };
        },
      },
      now: () => new Date('2026-05-25T12:00:00Z'),
    },
  });

  assert.equal(result.image.id, 'result_1');
  assert.equal(result.contentType, 'image/png');
  assert.equal(result.contentLength, 3);
});

test('readBackgroundRemoverResultFile keeps same-session guest fallback for signed-in users', async () => {
  let seenOwner: { userId: string | null; anonymousSessionId: string | null } =
    {
      userId: null,
      anonymousSessionId: null,
    };
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });

  await readBackgroundRemoverResultFile({
    actor: {
      kind: 'user',
      userId: 'user_1',
      anonymousSessionId: 'anon_1',
    },
    id: 'result_1',
    deps: {
      findImageByIdForOwner: async ({ owner }) => {
        seenOwner = owner;
        return {
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
          expiresAt: new Date('2026-05-26T00:00:00Z'),
        };
      },
      storageService: {
        async getFile() {
          return {
            body,
            contentType: 'image/png',
            contentLength: 3,
          };
        },
      },
      now: () => new Date('2026-05-25T12:00:00Z'),
    },
  });

  assert.deepEqual(seenOwner, {
    userId: 'user_1',
    anonymousSessionId: 'anon_1',
  });
});

test('readBackgroundRemoverResultFile rejects expired results', async () => {
  await assert.rejects(
    readBackgroundRemoverResultFile({
      actor: { kind: 'anonymous', anonymousSessionId: 'anon_1' },
      id: 'result_1',
      deps: {
        findImageByIdForOwner: async () => ({
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
        }),
        storageService: {
          async getFile() {
            throw new Error('should not read expired storage');
          },
        },
        now: () => new Date('2026-05-25T00:00:01Z'),
      },
    }),
    /result expired/
  );
});
