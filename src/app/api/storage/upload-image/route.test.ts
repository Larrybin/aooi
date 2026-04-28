import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestError, UpstreamError } from '@/shared/lib/api/errors';

import { createStorageUploadImagePostHandler } from './route';
import { detectAllowedImageMime, uploadImageFiles } from './upload-image-files';

function createLog() {
  return {
    debug: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    info: () => undefined,
  };
}

function createPngFile(name = 'image.png') {
  const bytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
  ]);
  return new File([bytes], name, { type: 'image/png' });
}

test('detectAllowedImageMime 识别 png 文件头', () => {
  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  assert.equal(detectAllowedImageMime(pngBuffer), 'image/png');
});

test('uploadImageFiles 上传合法图片并返回结果', async () => {
  const result = await uploadImageFiles({
    files: [createPngFile()],
    deps: {
      getStorageService: async () => ({
        uploadFile: async ({ key }: { key: string }) => ({
          success: true,
          key,
          url: `https://cdn.example.com/${key}`,
          provider: 'r2',
        }),
      }),
      log: createLog() as never,
      now: () => 123,
      createId: () => 'fixed-id',
    },
  });

  assert.deepEqual(result, [
    {
      url: 'https://cdn.example.com/uploads/123-fixed-id.png',
      key: 'uploads/123-fixed-id.png',
      filename: 'image.png',
    },
  ]);
});

test('uploadImageFiles 在 provider 初始化失败时返回 503 语义', async () => {
  await assert.rejects(
    uploadImageFiles({
      files: [createPngFile()],
      deps: {
        getStorageService: async () => {
          throw new Error('missing storage config');
        },
        log: createLog() as never,
      },
    }),
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.status === 503 &&
      error.message === 'storage service unavailable'
  );
});

test('uploadImageFiles 拒绝非法 MIME 文件', async () => {
  const invalidFile = new File(
    [new Uint8Array([0x01, 0x02, 0x03])],
    'bad.bin',
    {
      type: 'application/octet-stream',
    }
  );

  await assert.rejects(
    uploadImageFiles({
      files: [invalidFile],
      deps: {
        getStorageService: async () => ({
          uploadFile: async () => ({
            success: true,
            key: 'ignored',
            url: 'https://cdn.example.com/ignored',
            provider: 'r2',
          }),
        }),
        log: createLog() as never,
      },
    }),
    (error: unknown) =>
      error instanceof BadRequestError &&
      error.message === 'file bad.bin is not a supported image'
  );
});

test('uploadImageFiles 在 provider 返回失败时抛出 502 语义', async () => {
  await assert.rejects(
    uploadImageFiles({
      files: [createPngFile()],
      deps: {
        getStorageService: async () => ({
          uploadFile: async () => ({
            success: false,
            error: 'bucket unavailable',
            provider: 'r2',
          }),
        }),
        log: createLog() as never,
      },
    }),
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.status === 502 &&
      error.message === 'bucket unavailable'
  );
});

test('storage/upload-image 路由会把 fresh 模式闭包传给 getStorageService', async () => {
  const receivedModes: Array<string | undefined> = [];
  const handler = createStorageUploadImagePostHandler({
    resolveConfigConsistencyMode: () => 'fresh',
    getApiContext: async () => ({
      log: createLog(),
      requireUser: async () => ({
        id: 'u1',
        name: null,
        email: 'u1@example.com',
        image: null,
      }),
    }),
    readUploadRequestInput: async () => ({
      entries: [createPngFile()],
      files: [createPngFile()],
      runtimePlatform: 'node',
    }),
    getStorageService: async (options) => {
      receivedModes.push(options?.mode);
      return {
        uploadFile: async ({ key }: { key: string }) => ({
          success: true,
          key,
          url: `https://cdn.example.com/${key}`,
          provider: 'r2',
        }),
      } as never;
    },
    concurrencyLimiter: {
      acquire: async () => true,
      release: async () => undefined,
    },
  });

  const response = await handler(
    new Request('http://localhost/api/storage/upload-image', {
      method: 'POST',
      headers: {
        'x-aooi-config-consistency': 'fresh',
      },
    })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(receivedModes, ['fresh']);
});
