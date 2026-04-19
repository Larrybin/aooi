import assert from 'node:assert/strict';
import test from 'node:test';

import {
  KNOWN_FIXED_REMOTE_IMAGE_HOSTS,
  resolveImageSourceStrategy,
} from './image-policy.mjs';

test('KNOWN_FIXED_REMOTE_IMAGE_HOSTS 包含固定 allowlist 域名', () => {
  assert.deepEqual(KNOWN_FIXED_REMOTE_IMAGE_HOSTS, ['models.dev']);
});

test('本地路径走 next/image 策略', () => {
  assert.deepEqual(resolveImageSourceStrategy('/imgs/logo.png'), {
    kind: 'next-image',
    resolvedSrc: '/imgs/logo.png',
  });
});

test('固定 allowlist 远程域名走 next/image 策略', () => {
  assert.deepEqual(
    resolveImageSourceStrategy('https://models.dev/assets/preview.png'),
    {
      kind: 'next-image',
      resolvedSrc: 'https://models.dev/assets/preview.png',
    }
  );
});

test('同源远程 URL 走 next/image 策略', () => {
  assert.deepEqual(
    resolveImageSourceStrategy('https://app.example.com/uploads/logo.png', {
      appOrigin: 'https://app.example.com',
    }),
    {
      kind: 'next-image',
      resolvedSrc: 'https://app.example.com/uploads/logo.png',
    }
  );
});

test('动态未知远程 URL 退化为原生 img 策略', () => {
  assert.deepEqual(
    resolveImageSourceStrategy('https://random.cdn.example.com/image.png'),
    {
      kind: 'img',
      resolvedSrc: 'https://random.cdn.example.com/image.png',
    }
  );
});
