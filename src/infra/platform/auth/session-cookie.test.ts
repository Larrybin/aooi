import assert from 'node:assert/strict';
import test from 'node:test';

import { readSessionTokenFromCookieHeader } from './session-cookie';

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

test('readSessionTokenFromCookieHeader 会剥离 Better Auth signed cookie 的签名段', () => {
  const signature = `${'A'.repeat(43)}=`;
  const signedCookieValue = `raw-session-token.${signature}`;

  assert.equal(
    readSessionTokenFromCookieHeader(
      `theme=dark; __Secure-better-auth.session_token=${signedCookieValue}; locale=zh`
    ),
    'raw-session-token'
  );
});

test('readSessionTokenFromCookieHeader 不会误剥离普通点号 token', () => {
  assert.equal(
    readSessionTokenFromCookieHeader(
      'theme=dark; better-auth.session_token=token.with.dot; locale=zh'
    ),
    'token.with.dot'
  );
});

test('readSessionTokenFromCookieHeader 对空或无效 cookie 返回 null', () => {
  assert.equal(readSessionTokenFromCookieHeader(null), null);
  assert.equal(readSessionTokenFromCookieHeader('theme=dark; locale=zh'), null);
});
