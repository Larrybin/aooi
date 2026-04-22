import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ensureCiDevVars,
  getCloudflarePreviewSmokeChecks,
  normalizePreviewBaseUrl,
  parsePreviewReadyUrlFromLogs,
  resolveAuthSecret,
  resolveConfiguredPreviewBaseUrl,
  resolvePreviewBaseUrl,
  runRepeatedRequestCheck,
  validateSmokeResponse,
  waitForPreviewReady,
} from '../../scripts/lib/cloudflare-preview-smoke.mjs';

function createSilentConsole(
  overrides: Partial<Pick<Console, 'log' | 'warn'>> = {}
): Console {
  return Object.assign(Object.create(console), console, overrides);
}

test('normalizePreviewBaseUrl 清理路径和尾随斜杠', () => {
  assert.equal(
    normalizePreviewBaseUrl('http://127.0.0.1:8787/sign-up?x=1'),
    'http://127.0.0.1:8787'
  );
  assert.equal(
    normalizePreviewBaseUrl('http://localhost:8787/'),
    'http://localhost:8787'
  );
});

test('parsePreviewReadyUrlFromLogs 解析 Wrangler ready url', () => {
  assert.equal(
    parsePreviewReadyUrlFromLogs('▲ [wrangler] Ready on http://127.0.0.1:8788'),
    'http://127.0.0.1:8788'
  );
  assert.equal(parsePreviewReadyUrlFromLogs('warming up'), null);
});

test('resolveAuthSecret 优先使用 BETTER_AUTH_SECRET，其次 AUTH_SECRET', () => {
  const originalBetterAuthSecret = process.env.BETTER_AUTH_SECRET;
  const originalAuthSecret = process.env.AUTH_SECRET;

  process.env.BETTER_AUTH_SECRET = 'better-auth-secret';
  process.env.AUTH_SECRET = 'auth-secret';
  assert.equal(resolveAuthSecret(), 'better-auth-secret');

  delete process.env.BETTER_AUTH_SECRET;
  assert.equal(resolveAuthSecret(), 'auth-secret');

  if (originalBetterAuthSecret === undefined) {
    delete process.env.BETTER_AUTH_SECRET;
  } else {
    process.env.BETTER_AUTH_SECRET = originalBetterAuthSecret;
  }

  if (originalAuthSecret === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = originalAuthSecret;
  }
});

test('ensureCiDevVars 在缺失时生成 .dev.vars，并在已存在时复用', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'cf-preview-smoke-'));
  const devVarsPath = path.join(tmpDir, '.dev.vars');

  const created = await ensureCiDevVars({
    authSecret: 'preview-secret',
    devVarsPath,
  });
  assert.equal(created.created, true);
  assert.equal(created.devVarsPath, devVarsPath);

  const content = await readFile(devVarsPath, 'utf8');
  assert.equal(
    content,
    'AUTH_SECRET=preview-secret\nBETTER_AUTH_SECRET=preview-secret\n'
  );

  const reused = await ensureCiDevVars({
    authSecret: 'another-secret',
    devVarsPath,
  });
  assert.equal(reused.created, false);
  assert.equal(reused.updated, false);

  const reusedContent = await readFile(devVarsPath, 'utf8');
  assert.equal(reusedContent, content);

  await created.cleanup();
});

test('ensureCiDevVars 会补齐已存在但缺失的 auth secret，并在 cleanup 后恢复原文件', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'cf-preview-smoke-'));
  const devVarsPath = path.join(tmpDir, '.dev.vars');
  const originalContent = 'AUTH_SECRET=\n';

  await writeFile(devVarsPath, originalContent, 'utf8');

  const prepared = await ensureCiDevVars({
    authSecret: 'preview-secret',
    devVarsPath,
  });
  assert.equal(prepared.created, false);
  assert.equal(prepared.updated, true);

  const nextContent = await readFile(devVarsPath, 'utf8');
  assert.equal(
    nextContent,
    'AUTH_SECRET=preview-secret\nBETTER_AUTH_SECRET=preview-secret\n'
  );

  await prepared.cleanup();
  const restoredContent = await readFile(devVarsPath, 'utf8');
  assert.equal(restoredContent, originalContent);
});

test('ensureCiDevVars 能临时写入额外 Worker 变量并在 cleanup 后恢复', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'cf-preview-smoke-'));
  const devVarsPath = path.join(tmpDir, '.dev.vars');
  const originalContent = 'AUTH_SECRET=existing-secret\n';

  await writeFile(devVarsPath, originalContent, 'utf8');

  const prepared = await ensureCiDevVars({
    authSecret: 'preview-secret',
    devVarsPath,
    extraVars: {
      AUTH_SPIKE_OAUTH_UPSTREAM_MOCK: 'true',
    },
  });
  assert.equal(prepared.created, false);
  assert.equal(prepared.updated, true);

  const nextContent = await readFile(devVarsPath, 'utf8');
  assert.equal(
    nextContent,
    'AUTH_SECRET=existing-secret\nBETTER_AUTH_SECRET=existing-secret\nAUTH_SPIKE_OAUTH_UPSTREAM_MOCK=true\n'
  );

  await prepared.cleanup();
  const restoredContent = await readFile(devVarsPath, 'utf8');
  assert.equal(restoredContent, originalContent);
});

test('ensureCiDevVars 在现有 .dev.vars 包含未知键时直接失败且不改写文件', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'cf-preview-smoke-'));
  const devVarsPath = path.join(tmpDir, '.dev.vars');
  const originalContent = 'FOO=bar\nAUTH_SECRET=\n';

  await writeFile(devVarsPath, originalContent, 'utf8');

  await assert.rejects(
    () =>
      ensureCiDevVars({
        authSecret: 'preview-secret',
        devVarsPath,
      }),
    /unsupported keys: FOO/i
  );

  const nextContent = await readFile(devVarsPath, 'utf8');
  assert.equal(nextContent, originalContent);
});

test('ensureCiDevVars 拒绝写入 allowlist 外的 .dev.vars 键', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'cf-preview-smoke-'));
  const devVarsPath = path.join(tmpDir, '.dev.vars');

  await assert.rejects(
    () =>
      ensureCiDevVars({
        authSecret: 'preview-secret',
        devVarsPath,
        extraVars: {
          FOO: 'bar',
        },
      }),
    /unsupported keys: FOO/i
  );
});

test('validateSmokeResponse 校验 JSON 接口响应', () => {
  const [configApiCheck] = getCloudflarePreviewSmokeChecks();
  const response = new Response(
    JSON.stringify({
      code: 0,
      message: 'ok',
      data: { general_ai_enabled: 'true' },
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }
  );

  validateSmokeResponse(
    configApiCheck,
    response,
    '{"code":0,"message":"ok","data":{"general_ai_enabled":"true"}}'
  );
});

test('validateSmokeResponse 缺少关键标记时抛错', () => {
  const [, signUpCheck] = getCloudflarePreviewSmokeChecks();
  const response = new Response('<html><title>Sign Up - Demo</title></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

  assert.throws(
    () => validateSmokeResponse(signUpCheck, response, '<html></html>'),
    /missing expected text/i
  );
});

test('runRepeatedRequestCheck 连续验证两次请求', async () => {
  const [, signUpCheck] = getCloudflarePreviewSmokeChecks();
  const calls: string[] = [];
  const fakeFetch: typeof fetch = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response(
      '<html><title>Sign Up - Roller Rabbit</title><form data-testid="auth-sign-up-form"></form></html>',
      {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }
    );
  }) as typeof fetch;

  await runRepeatedRequestCheck({
    baseUrl: 'http://127.0.0.1:8787',
    check: signUpCheck,
    fetchImpl: fakeFetch,
    logger: createSilentConsole({ log: () => undefined }),
  });

  assert.deepEqual(calls, [
    'http://127.0.0.1:8787/sign-up',
    'http://127.0.0.1:8787/sign-up',
  ]);
});

test('resolvePreviewBaseUrl 优先使用 Wrangler ready url，端口不固定为 8787', async () => {
  const baseUrl = await resolvePreviewBaseUrl({
    preview: {
      readyUrlPromise: Promise.resolve('http://127.0.0.1:8788'),
    },
    fallbackBaseUrl: 'http://127.0.0.1:8787',
    logger: createSilentConsole({ warn: () => undefined }),
  });

  assert.equal(baseUrl, 'http://127.0.0.1:8788');
});

test('resolveConfiguredPreviewBaseUrl 在日志解析失败时回退到 CF_LOCAL_SMOKE_URL', () => {
  assert.equal(
    resolveConfiguredPreviewBaseUrl('', 'http://127.0.0.1:9797'),
    'http://127.0.0.1:9797'
  );
});

test('waitForPreviewReady 需要有效 config-api 响应连续成功后才通过', async () => {
  let attempt = 0;
  const calls: string[] = [];
  const fakeFetch: typeof fetch = (async (input: string | URL | Request) => {
    attempt += 1;
    calls.push(String(input));

    if (attempt === 1) {
      return new Response('warming', {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    return new Response(
      '{"code":0,"message":"ok","data":{"general_ai_enabled":"true"}}',
      {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }
    );
  }) as typeof fetch;

  await waitForPreviewReady({
    baseUrl: 'http://127.0.0.1:8788',
    fetchImpl: fakeFetch,
    timeoutMs: 5000,
    logger: createSilentConsole({ log: () => undefined }),
  });

  assert.equal(attempt >= 3, true);
  assert.equal(
    calls.every((url) => url.startsWith('http://127.0.0.1:8788/')),
    true
  );
});
