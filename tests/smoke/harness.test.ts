import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createReportArtifacts,
  resolveHarnessExitCode,
  writeReportArtifacts,
} from '../../scripts/lib/harness/reporter.mjs';
import {
  waitForChildExit,
  waitForManagerReady,
} from '../../scripts/lib/harness/runtime.mjs';
import { runPhaseSequence } from '../../scripts/lib/harness/scenario.mjs';

class FakeChild extends EventEmitter {
  exitCode: number | null = null;
}

test('waitForManagerReady 在子进程提前退出时附带 recent logs', async () => {
  const child = new FakeChild();

  const pendingReady = new Promise<void>(() => undefined);
  const readyPromise = waitForManagerReady({
    label: 'local-node',
    manager: {
      child,
      recentLogs: ['booting...\n', 'database failed\n'],
    },
    ready: () => pendingReady,
  });

  queueMicrotask(() => {
    child.exitCode = 1;
    child.emit('exit', 1, null);
  });

  await assert.rejects(
    readyPromise,
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes('local-node exited before readiness') &&
      error.message.includes('Recent logs:') &&
      error.message.includes('database failed')
  );
});

test('waitForChildExit 在超时前未退出时返回 false', async () => {
  const child = new FakeChild();

  const exited = await waitForChildExit(child, 20);

  assert.equal(exited, false);
});

test('writeReportArtifacts 同时写入时间戳文件和 latest 指针文件', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'harness-report-'));
  const paths = createReportArtifacts({
    rootDir,
    timestamp: '20260417T120000',
    reportPrefix: 'auth-spike-report',
    artifactSubdir: 'auth-spike',
  });
  const report = {
    harnessStatus: 'PASS',
    rawConclusion: 'PASS',
    generatedAt: '2026-04-17T12:00:00.000Z',
    preflight: [],
    failureSummary: [],
    surfaces: [],
  };

  await writeReportArtifacts({
    paths,
    report,
    renderMarkdown: (value) => `# ${value.harnessStatus}\n`,
  });

  const timestampedJson = await readFile(paths.reportJsonPath, 'utf8');
  const latestJson = await readFile(paths.latestJsonPath, 'utf8');
  const timestampedMarkdown = await readFile(paths.reportMarkdownPath, 'utf8');
  const latestMarkdown = await readFile(paths.latestMarkdownPath, 'utf8');

  assert.equal(timestampedJson, latestJson);
  assert.equal(timestampedMarkdown, latestMarkdown);
  assert.match(timestampedJson, /"harnessStatus": "PASS"/);
  assert.equal(
    paths.artifactDir.endsWith('output/playwright/auth-spike/20260417T120000'),
    true
  );
});

test('runPhaseSequence 在 phase 与 cleanup 同时失败时合并错误信息', async () => {
  await assert.rejects(
    runPhaseSequence({
      phases: [
        {
          label: 'phase-a',
          action: async () => {
            throw new Error('phase failed');
          },
        },
      ],
      cleanup: async () => {
        throw new Error('cleanup failed');
      },
    }),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes('[phase-a] phase failed') &&
      error.message.includes('[cleanup] cleanup failed')
  );
});

test('resolveHarnessExitCode 以子进程退出码优先，否则按 harnessStatus 决定', () => {
  assert.equal(resolveHarnessExitCode({ harnessStatus: 'PASS' }, 0), 0);
  assert.equal(resolveHarnessExitCode({ harnessStatus: 'FAIL' }, 0), 1);
  assert.equal(resolveHarnessExitCode({ harnessStatus: 'PASS' }, 9), 9);
});
