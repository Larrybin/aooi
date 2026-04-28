import assert from 'node:assert/strict';
import test from 'node:test';

import { formatYmd } from './format-ymd';

test('formatYmd returns dash for missing or invalid dates', () => {
  assert.equal(formatYmd(null), '-');
  assert.equal(formatYmd(undefined), '-');
  assert.equal(formatYmd(''), '-');
  assert.equal(formatYmd('invalid-date'), '-');
});

test('formatYmd formats a valid date as yyyy-mm-dd', () => {
  assert.equal(formatYmd(new Date('2026-04-01T00:00:00.000Z')), '2026-04-01');
});
