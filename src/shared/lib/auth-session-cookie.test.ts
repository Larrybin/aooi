import assert from 'node:assert/strict';
import test from 'node:test';

import { readSessionTokenFromCookieHeader } from './auth-session-cookie';

test('readSessionTokenFromCookieHeader 读取 better-auth 默认 session cookie', () => {
  assert.equal(
    readSessionTokenFromCookieHeader(
      'theme=dark; better-auth.session_token=token-123; locale=zh'
    ),
    'token-123'
  );
});

test('readSessionTokenFromCookieHeader 支持 __Secure- 前缀 cookie', () => {
  assert.equal(
    readSessionTokenFromCookieHeader(
      'theme=dark; __Secure-better-auth.session_token=secure-token'
    ),
    'secure-token'
  );
});

test('readSessionTokenFromCookieHeader 对空或无效 cookie 返回 null', () => {
  assert.equal(readSessionTokenFromCookieHeader(null), null);
  assert.equal(readSessionTokenFromCookieHeader('theme=dark; locale=zh'), null);
});
