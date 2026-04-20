import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStateDryRunArgs,
  buildVersionUploadDryRunArgs,
  parseDryRunUploadSize,
} from '../../scripts/run-cf-multi-build-check.mjs';

test('parseDryRunUploadSize 解析 wrangler dry-run 输出中的 total/gzip 体积', () => {
  const sizes = parseDryRunUploadSize(`
Total Upload: 10867.16 KiB / gzip: 2136.66 KiB
Your Worker has access to the following bindings:
`);

  assert.deepEqual(sizes, {
    totalKiB: 10867.16,
    gzipKiB: 2136.66,
  });
});

test('parseDryRunUploadSize 在缺少体积行时失败', () => {
  assert.throws(() => parseDryRunUploadSize('no size info'), /parse dry-run upload size/i);
});

test('buildStateDryRunArgs 为 state worker 固定使用 wrangler deploy --dry-run', () => {
  assert.deepEqual(
    buildStateDryRunArgs({
      configPath: '/tmp/wrangler.state.toml',
      name: 'roller-rabbit-state',
      secretsPath: '/tmp/state.secrets.env',
    }),
    [
      'deploy',
      '--dry-run',
      '--config',
      '/tmp/wrangler.state.toml',
      '--name',
      'roller-rabbit-state',
      '--keep-vars',
      '--secrets-file',
      '/tmp/state.secrets.env',
    ]
  );
});

test('buildVersionUploadDryRunArgs 为 app worker 固定使用 wrangler versions upload --dry-run', () => {
  assert.deepEqual(
    buildVersionUploadDryRunArgs({
      configPath: '/tmp/wrangler.server-public-web.toml',
      name: 'roller-rabbit-public-web',
      secretsPath: '/tmp/public-web.secrets.env',
    }),
    [
      'versions',
      'upload',
      '--dry-run',
      '--config',
      '/tmp/wrangler.server-public-web.toml',
      '--name',
      'roller-rabbit-public-web',
      '--secrets-file',
      '/tmp/public-web.secrets.env',
    ]
  );
});
