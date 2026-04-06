import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCloudflarePreviewSmokeChecks,
  normalizePreviewBaseUrl,
  runRepeatedRequestCheck,
  waitForPreviewReady,
  validateSmokeResponse,
} from '../../scripts/run-cf-preview-smoke.mjs';

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

test('validateSmokeResponse 校验 JSON 接口响应', () => {
  const [configApiCheck] = getCloudflarePreviewSmokeChecks();
  const response = new Response(
    JSON.stringify({
      code: 0,
      message: 'ok',
      data: { app_name: 'Roller Rabbit' },
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }
  );

  validateSmokeResponse(
    configApiCheck,
    response,
    '{"code":0,"message":"ok","data":{"app_name":"Roller Rabbit"}}'
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
    logger: { log: () => undefined },
  });

  assert.deepEqual(calls, [
    'http://127.0.0.1:8787/sign-up',
    'http://127.0.0.1:8787/sign-up',
  ]);
});

test('waitForPreviewReady 需要有效 config-api 响应连续成功后才通过', async () => {
  let attempt = 0;
  const fakeFetch: typeof fetch = (async () => {
    attempt += 1;

    if (attempt === 1) {
      return new Response('warming', {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    return new Response(
      '{"code":0,"message":"ok","data":{"app_name":"Roller Rabbit"}}',
      {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }
    );
  }) as typeof fetch;

  await waitForPreviewReady({
    baseUrl: 'http://127.0.0.1:8787',
    fetchImpl: fakeFetch,
    timeoutMs: 5000,
    logger: { log: () => undefined },
  });

  assert.equal(attempt >= 3, true);
});
