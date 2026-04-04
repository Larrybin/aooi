import assert from 'node:assert/strict';
import test from 'node:test';

import { getBrandPreviewHost } from './brand-url';

test('getBrandPreviewHost: 解析完整 URL', () => {
  assert.equal(
    getBrandPreviewHost('https://sub.example.com/path?q=1'),
    'sub.example.com'
  );
});

test('getBrandPreviewHost: 解析无协议域名', () => {
  assert.equal(getBrandPreviewHost('example.com'), 'example.com');
});

test('getBrandPreviewHost: 半成品 URL 不抛错，返回原始值', () => {
  assert.equal(getBrandPreviewHost('https://'), 'https://');
});

test('getBrandPreviewHost: 空值回退默认域名', () => {
  assert.equal(getBrandPreviewHost('   '), 'your-domain.com');
});
