import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizePublicAssetPath,
  readPublicAssetPath,
} from './public-asset-path';

test('normalizePublicAssetPath: 自动补全前导斜杠', () => {
  assert.equal(
    normalizePublicAssetPath('images/preview.png', 'NEXT_PUBLIC_APP_OG_IMAGE'),
    '/images/preview.png'
  );
});

test('normalizePublicAssetPath: 保留已合法的 public 路径', () => {
  assert.equal(
    normalizePublicAssetPath('/branding/logo.svg', 'NEXT_PUBLIC_APP_LOGO'),
    '/branding/logo.svg'
  );
});

test('normalizePublicAssetPath: 拒绝远程 URL', () => {
  assert.throws(
    () =>
      normalizePublicAssetPath(
        'https://cdn.example.com/logo.png',
        'NEXT_PUBLIC_APP_LOGO'
      ),
    /must be a public asset path/
  );
});

test('readPublicAssetPath: 缺省时回退到默认值', () => {
  assert.equal(
    readPublicAssetPath(undefined, '/logo.png', 'NEXT_PUBLIC_APP_LOGO'),
    '/logo.png'
  );
});
