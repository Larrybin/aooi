import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDryRunUploadSize } from '../../scripts/run-cf-multi-build-check.mjs';

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
