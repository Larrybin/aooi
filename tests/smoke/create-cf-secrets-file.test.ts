import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCloudflareSecretsEnv,
  resolveCloudflareAuthSecretValue,
} from '../../scripts/create-cf-secrets-file.mjs';

test('resolveCloudflareAuthSecretValue 优先 BETTER_AUTH_SECRET，其次 AUTH_SECRET', () => {
  assert.equal(
    resolveCloudflareAuthSecretValue({
      BETTER_AUTH_SECRET: 'better-secret',
      AUTH_SECRET: 'auth-secret',
    }),
    'better-secret'
  );
  assert.equal(
    resolveCloudflareAuthSecretValue({
      AUTH_SECRET: 'auth-secret',
    }),
    'auth-secret'
  );
});

test('buildCloudflareSecretsEnv 只输出白名单 secret，并为缺失项补同一 auth secret', () => {
  const content = buildCloudflareSecretsEnv({
    BETTER_AUTH_SECRET: 'better-secret',
    OTHER_SECRET: 'ignored',
  });

  assert.equal(
    content,
    'BETTER_AUTH_SECRET=better-secret\nAUTH_SECRET=better-secret\n'
  );
});

test('buildCloudflareSecretsEnv 在缺少 auth secret 时失败', () => {
  assert.throws(() => buildCloudflareSecretsEnv({}), /AUTH_SECRET/i);
});
