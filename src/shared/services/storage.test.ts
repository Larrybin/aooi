import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canBuildR2StorageProvider,
  canBuildS3StorageProvider,
  getConfiguredStorageProviderContracts,
} from './storage-provider-contract';
import {
  buildStorageSpikeUploadMockResult,
  isStorageSpikeUploadMockEnabled,
  wrapStorageProviderWithUploadMock,
} from './storage-upload-mock';

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

test('buildStorageSpikeUploadMockResult 返回确定性 provider URL', () => {
  assert.deepEqual(
    buildStorageSpikeUploadMockResult({
      key: 'uploads/demo.png',
      providerName: 'r2',
      publicDomain: 'https://cdn.example.com/',
    }),
    {
      success: true,
      provider: 'r2',
      key: 'uploads/demo.png',
      url: 'https://cdn.example.com/r2/uploads/demo.png',
      location: 'https://cdn.example.com/r2/uploads/demo.png',
    }
  );
});

test('canBuildR2StorageProvider 只有在关键 R2 配置完整时才返回 true', () => {
  assert.equal(
    canBuildR2StorageProvider({
      r2_access_key: 'ak',
      r2_secret_key: 'sk',
      r2_domain: 'https://cdn.example.com',
    }),
    false
  );
  assert.equal(
    canBuildR2StorageProvider({
      r2_access_key: 'ak',
      r2_secret_key: 'sk',
      r2_bucket_name: 'bucket',
    }),
    false
  );
  assert.equal(
    canBuildR2StorageProvider({
      r2_access_key: 'ak',
      r2_secret_key: 'sk',
      r2_bucket_name: 'bucket',
      r2_endpoint: 'https://account-id.r2.cloudflarestorage.com',
    }),
    true
  );
  assert.equal(
    canBuildR2StorageProvider({
      r2_access_key: 'ak',
      r2_secret_key: 'sk',
      r2_bucket_name: 'bucket',
      r2_account_id: 'account-id',
    }),
    true
  );
});

test('canBuildS3StorageProvider 只有在关键 S3 配置完整时才返回 true', () => {
  assert.equal(
    canBuildS3StorageProvider({
      s3_access_key: 'ak',
      s3_secret_key: 'sk',
      s3_bucket: 'bucket',
      s3_endpoint: 'https://s3.us-east-1.amazonaws.com',
    }),
    false
  );
  assert.equal(
    canBuildS3StorageProvider({
      s3_access_key: 'ak',
      s3_secret_key: 'sk',
      s3_bucket: 'bucket',
      s3_region: 'us-east-1',
    }),
    false
  );
  assert.equal(
    canBuildS3StorageProvider({
      s3_access_key: 'ak',
      s3_secret_key: 'sk',
      s3_bucket: 'bucket',
      s3_endpoint: 'https://s3.us-east-1.amazonaws.com',
      s3_region: 'us-east-1',
    }),
    true
  );
});

test('getConfiguredStorageProviderContracts 在 R2 配置不完整时不返回 provider', () => {
  assert.deepEqual(
    getConfiguredStorageProviderContracts({
      r2_access_key: 'ak',
      r2_secret_key: 'sk',
      r2_bucket_name: 'bucket',
    }),
    []
  );
});

test('getConfiguredStorageProviderContracts 在 S3 配置不完整时不返回 provider', () => {
  assert.deepEqual(
    getConfiguredStorageProviderContracts({
      s3_access_key: 'ak',
      s3_secret_key: 'sk',
      s3_bucket: 'bucket',
      s3_endpoint: 'https://s3.us-east-1.amazonaws.com',
    }),
    []
  );
});

test('getConfiguredStorageProviderContracts 在 R2 配置完整时返回默认 provider 契约', () => {
  assert.deepEqual(
    getConfiguredStorageProviderContracts({
      r2_access_key: 'ak',
      r2_secret_key: 'sk',
      r2_bucket_name: 'bucket',
      r2_endpoint: 'https://account-id.r2.cloudflarestorage.com',
      r2_domain: 'https://cdn.example.com',
    }),
    [
      {
        name: 'r2',
        isDefault: true,
        configs: {
          endpoint: 'https://account-id.r2.cloudflarestorage.com',
          region: 'auto',
          accessKeyId: 'ak',
          secretAccessKey: 'sk',
          bucket: 'bucket',
          publicDomain: 'https://cdn.example.com',
        },
      },
    ]
  );
});

test('getConfiguredStorageProviderContracts 在仅提供 R2 account id 时派生默认 endpoint', () => {
  assert.deepEqual(
    getConfiguredStorageProviderContracts({
      r2_access_key: 'ak',
      r2_secret_key: 'sk',
      r2_bucket_name: 'bucket',
      r2_account_id: 'account-id',
    }),
    [
      {
        name: 'r2',
        isDefault: true,
        configs: {
          endpoint: 'https://account-id.r2.cloudflarestorage.com',
          region: 'auto',
          accessKeyId: 'ak',
          secretAccessKey: 'sk',
          bucket: 'bucket',
          publicDomain: undefined,
        },
      },
    ]
  );
});

test('getConfiguredStorageProviderContracts 在 S3 配置完整时返回 S3 provider 契约', () => {
  assert.deepEqual(
    getConfiguredStorageProviderContracts({
      s3_access_key: 'ak',
      s3_secret_key: 'sk',
      s3_bucket: 'bucket',
      s3_endpoint: 'https://s3.us-east-1.amazonaws.com',
      s3_region: 'us-east-1',
      s3_domain: 'https://cdn.example.com',
    }),
    [
      {
        name: 's3',
        isDefault: false,
        configs: {
          endpoint: 'https://s3.us-east-1.amazonaws.com',
          region: 'us-east-1',
          accessKeyId: 'ak',
          secretAccessKey: 'sk',
          bucket: 'bucket',
          publicDomain: 'https://cdn.example.com',
        },
      },
    ]
  );
});

test('wrapStorageProviderWithUploadMock 对 provider upload 返回确定性结果', async () => {
  const provider = wrapStorageProviderWithUploadMock({
    name: 'r2',
    configs: {
      publicDomain: 'https://cdn.example.com',
    },
    async uploadFile() {
      throw new Error('should not call original uploadFile');
    },
    async downloadAndUpload() {
      throw new Error('should not call original downloadAndUpload');
    },
  });

  const result = await provider.uploadFile({
    body: new Uint8Array([1, 2, 3]),
    key: 'uploads/demo.png',
    contentType: 'image/png',
  });

  assert.deepEqual(result, {
    success: true,
    provider: 'r2',
    key: 'uploads/demo.png',
    url: 'https://cdn.example.com/r2/uploads/demo.png',
    location: 'https://cdn.example.com/r2/uploads/demo.png',
  });
});
