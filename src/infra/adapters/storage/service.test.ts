import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStorageObjectPublicUrl,
  resolveStoredAssetUrl,
} from '@/shared/lib/storage-public-url';

import {
  buildStorageSpikeUploadMockResult,
  isStorageSpikeUploadMockEnabled,
} from './upload-mock';
import { buildStorageServiceWithConfigs } from './service-builder';

function withStoragePublicBaseUrl<T>(value: string | undefined, run: () => T): T {
  const previous = process.env.STORAGE_PUBLIC_BASE_URL;
  if (value === undefined) {
    delete process.env.STORAGE_PUBLIC_BASE_URL;
  } else {
    process.env.STORAGE_PUBLIC_BASE_URL = value;
  }

  try {
    return run();
  } finally {
    if (previous === undefined) {
      delete process.env.STORAGE_PUBLIC_BASE_URL;
    } else {
      process.env.STORAGE_PUBLIC_BASE_URL = previous;
    }
  }
}

test('isStorageSpikeUploadMockEnabled 仅在显式 true 时启用', () => {
  assert.equal(isStorageSpikeUploadMockEnabled({}), false);
  assert.equal(
    isStorageSpikeUploadMockEnabled({ STORAGE_SPIKE_UPLOAD_MOCK: 'false' }),
    false
  );
  assert.equal(
    isStorageSpikeUploadMockEnabled({ STORAGE_SPIKE_UPLOAD_MOCK: 'true' }),
    true
  );
});

test('buildStorageSpikeUploadMockResult 返回确定性公开 URL', () => {
  assert.deepEqual(
    buildStorageSpikeUploadMockResult({
      key: 'uploads/demo.png',
      publicDomain: 'https://cdn.example.com/assets/',
    }),
    {
      success: true,
      provider: 'cloudflare-r2',
      key: 'uploads/demo.png',
      url: 'https://cdn.example.com/assets/uploads/demo.png',
      location: 'https://cdn.example.com/assets/uploads/demo.png',
    }
  );
});

test('buildStorageObjectPublicUrl 规范化 base URL 并拼接 objectKey', () => {
  assert.equal(
    buildStorageObjectPublicUrl(
      'uploads/demo.png',
      'https://cdn.example.com/assets'
    ),
    'https://cdn.example.com/assets/uploads/demo.png'
  );
});

test('resolveStoredAssetUrl 对 objectKey 依赖 STORAGE_PUBLIC_BASE_URL', () => {
  assert.equal(
    resolveStoredAssetUrl({
      value: 'uploads/demo.png',
      storagePublicBaseUrl: 'https://cdn.example.com/assets/',
    }),
    'https://cdn.example.com/assets/uploads/demo.png'
  );
  assert.equal(
    resolveStoredAssetUrl({
      value: 'uploads/demo.png',
    }),
    ''
  );
  assert.equal(
    resolveStoredAssetUrl({
      value: '/logo.png',
    }),
    '/logo.png'
  );
});

test('buildStorageServiceWithConfigs 在 mock 模式下返回 objectKey 对应 URL', async () => {
  const service = withStoragePublicBaseUrl(
    'https://cdn.example.com/assets/',
    () => buildStorageServiceWithConfigs({}, { uploadMockEnabled: true })
  );

  const result = await service.uploadFile({
    body: new Uint8Array([1, 2, 3]),
    key: 'uploads/demo.png',
    contentType: 'image/png',
  });

  assert.deepEqual(result, {
    success: true,
    provider: 'cloudflare-r2',
    key: 'uploads/demo.png',
    url: 'https://cdn.example.com/assets/uploads/demo.png',
    location: 'https://cdn.example.com/assets/uploads/demo.png',
  });
});

test('buildStorageServiceWithConfigs 缺少 STORAGE_PUBLIC_BASE_URL 时返回明确错误', async () => {
  const service = withStoragePublicBaseUrl(undefined, () =>
    buildStorageServiceWithConfigs({}, { uploadMockEnabled: false })
  );

  await assert.rejects(
    service.uploadFile({
      body: new Uint8Array([1, 2, 3]),
      key: 'uploads/demo.png',
      contentType: 'image/png',
    }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === 'STORAGE_PUBLIC_BASE_URL is not configured'
  );
});

test('buildStorageServiceWithConfigs 缺少 APP_STORAGE_R2_BUCKET binding 时返回明确错误', async () => {
  const service = withStoragePublicBaseUrl(
    'https://cdn.example.com/assets/',
    () => buildStorageServiceWithConfigs({}, { uploadMockEnabled: false })
  );

  await assert.rejects(
    service.uploadFile({
      body: new Uint8Array([1, 2, 3]),
      key: 'uploads/demo.png',
      contentType: 'image/png',
    }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === 'APP_STORAGE_R2_BUCKET binding is missing'
  );
});
