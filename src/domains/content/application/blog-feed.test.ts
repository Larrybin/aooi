import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDefaultBlogPageSize,
  mergeBlogPostEntries,
  paginateBlogPostEntries,
  toSortTimestamp,
  type BlogPostEntry,
} from './blog-feed';

function createEntry(
  slug: string,
  sortTimestamp: number,
  title = slug
): BlogPostEntry {
  return {
    post: {
      slug,
      title,
      created_at: 'Apr 4, 2026',
      url: `/blog/${slug}`,
    },
    sortTimestamp,
  };
}

test('getDefaultBlogPageSize: 返回公开 blog 首屏固定页长', () => {
  assert.equal(getDefaultBlogPageSize(), 30);
});

test('mergeBlogPostEntries: 远端同 slug 覆盖本地，并在统一排序后分页', () => {
  const mergedEntries = mergeBlogPostEntries({
    localEntries: [
      createEntry('local-first', 300),
      createEntry('shared-slug', 200, 'local version'),
    ],
    remoteEntries: [
      createEntry('shared-slug', 250, 'remote version'),
      createEntry('remote-last', 100),
    ],
  });

  assert.deepEqual(
    mergedEntries.map((entry) => entry.post.slug),
    ['local-first', 'shared-slug', 'remote-last']
  );
  assert.equal(mergedEntries[1]?.post.title, 'remote version');

  assert.deepEqual(paginateBlogPostEntries(mergedEntries, 1, 1), [
    mergedEntries[0]?.post,
  ]);
  assert.deepEqual(paginateBlogPostEntries(mergedEntries, 2, 1), [
    mergedEntries[1]?.post,
  ]);
});

test('toSortTimestamp: 非法时间回退为 0', () => {
  assert.equal(toSortTimestamp('2026-04-04T08:00:00.000Z') > 0, true);
  assert.equal(toSortTimestamp('not-a-date'), 0);
  assert.equal(toSortTimestamp(null), 0);
});
