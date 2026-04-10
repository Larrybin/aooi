import assert from 'node:assert/strict';
import test from 'node:test';

import { splitBlogContentForInlineAd } from './blog-detail-inline-content';

test('splitBlogContentForInlineAd: 短内容不插中段广告', () => {
  const result = splitBlogContentForInlineAd(
    ['a', 'b', 'c', 'd', 'e'].join('\n\n')
  );

  assert.equal(result, null);
});

test('splitBlogContentForInlineAd: 长内容按中后段拆分', () => {
  const content = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].join('\n\n');
  const result = splitBlogContentForInlineAd(content);

  assert.notEqual(result, null);
  assert.equal(result?.before.includes('p4'), true);
  assert.equal(result?.after.startsWith('p5'), true);
});
