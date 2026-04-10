import assert from 'node:assert/strict';
import test from 'node:test';

import type { Post } from '@/shared/types/blocks/blog';

import { resolveBlogDetailPageAds } from './blog-detail-page-state';

test('resolveBlogDetailPageAds: 数据库文章返回中段与尾部广告', () => {
  const post: Post = {
    title: 'DB post',
    slug: 'db-post',
    inlineAdContent: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].join('\n\n'),
  };

  const resolvedAds = resolveBlogDetailPageAds(post, {
    inlineAd: 'INLINE',
    footerAd: 'FOOTER',
  });

  assert.equal(resolvedAds.inlineAd, 'INLINE');
  assert.equal(resolvedAds.footerAd, 'FOOTER');
});

test('resolveBlogDetailPageAds: 本地 MDX 文章只返回尾部广告', () => {
  const post: Post = {
    title: 'Local post',
    slug: 'local-post',
    body: 'Local MDX Body',
  };

  const resolvedAds = resolveBlogDetailPageAds(post, {
    inlineAd: 'INLINE',
    footerAd: 'FOOTER',
  });

  assert.equal(resolvedAds.inlineAd, null);
  assert.equal(resolvedAds.footerAd, 'FOOTER');
});
