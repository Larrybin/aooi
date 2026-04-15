import assert from 'node:assert/strict';
import test from 'node:test';

import { cleanupExpiringMap, trimMapOverflow } from './map-cleanup';

test('trimMapOverflow: 仅删除超出上限的最早键', () => {
  const map = new Map<string, number>([
    ['a', 1],
    ['b', 2],
    ['c', 3],
  ]);

  trimMapOverflow(map, 2);

  assert.equal(map.size, 2);
  assert.deepEqual([...map.keys()], ['b', 'c']);
});

test('cleanupExpiringMap: 先清理过期项，再执行容量裁剪', () => {
  const now = 1_000;
  const map = new Map<string, { at: number }>([
    ['a', { at: 100 }],
    ['b', { at: 300 }],
    ['c', { at: 700 }],
    ['d', { at: 900 }],
  ]);

  cleanupExpiringMap({
    map,
    now,
    ttlMs: 500,
    maxEntries: 2,
    getTimestamp: (entry) => entry.at,
  });

  assert.deepEqual([...map.keys()], ['c', 'd']);
});
