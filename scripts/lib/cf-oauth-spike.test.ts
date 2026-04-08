import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { acquireCfOAuthSpikeLock } from './cf-oauth-spike';

test('acquireCfOAuthSpikeLock 在重复获取时失败，并在释放后允许再次获取', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cf-oauth-spike-lock-'));
  const lockFilePath = path.join(tempDir, 'cf-oauth-spike.lock');

  const firstLock = await acquireCfOAuthSpikeLock({ lockFilePath });
  const lockContent = await readFile(lockFilePath, 'utf8');

  assert.equal(lockContent.trim(), String(process.pid));
  await assert.rejects(
    () => acquireCfOAuthSpikeLock({ lockFilePath }),
    /已在运行/
  );

  await firstLock.release();
  await assert.rejects(() => stat(lockFilePath), /ENOENT/);

  const secondLock = await acquireCfOAuthSpikeLock({ lockFilePath });
  await secondLock.release();
});

test('acquireCfOAuthSpikeLock 会自动回收 stale lock', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cf-oauth-spike-stale-'));
  const lockFilePath = path.join(tempDir, 'cf-oauth-spike.lock');

  await writeFile(lockFilePath, '999999\n', 'utf8');
  const lock = await acquireCfOAuthSpikeLock({ lockFilePath });
  const lockContent = await readFile(lockFilePath, 'utf8');

  assert.equal(lockContent.trim(), String(process.pid));
  await lock.release();
});
