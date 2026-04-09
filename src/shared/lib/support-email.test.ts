import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_SUPPORT_EMAIL,
  getDefaultSupportEmailFromDomain,
  getDefaultSupportEmailFromOrigin,
  getDomainFromOrigin,
} from './support-email';

test('getDomainFromOrigin: 返回 origin host，非法值返回空字符串', () => {
  assert.equal(getDomainFromOrigin('https://example.com'), 'example.com');
  assert.equal(
    getDomainFromOrigin('https://example.com:3000'),
    'example.com:3000'
  );
  assert.equal(getDomainFromOrigin('not-a-url'), '');
});

test('getDefaultSupportEmailFromDomain: 端口或空域名回退默认邮箱', () => {
  assert.equal(
    getDefaultSupportEmailFromDomain('example.com'),
    'support@example.com'
  );
  assert.equal(
    getDefaultSupportEmailFromDomain('localhost:3000'),
    DEFAULT_SUPPORT_EMAIL
  );
  assert.equal(getDefaultSupportEmailFromDomain(''), DEFAULT_SUPPORT_EMAIL);
});

test('getDefaultSupportEmailFromOrigin: 组合 origin 解析与回退逻辑', () => {
  assert.equal(
    getDefaultSupportEmailFromOrigin('https://docs.example.com'),
    'support@docs.example.com'
  );
  assert.equal(
    getDefaultSupportEmailFromOrigin('http://localhost:3000'),
    DEFAULT_SUPPORT_EMAIL
  );
});
