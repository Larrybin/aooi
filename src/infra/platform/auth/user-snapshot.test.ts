import assert from 'node:assert/strict';
import test from 'node:test';

import { toAuthSessionUserSnapshot } from './user-snapshot';

test('toAuthSessionUserSnapshot 只保留 name/email/image 三个轻字段', () => {
  assert.deepEqual(
    toAuthSessionUserSnapshot({
      name: 'Ada',
      email: 'ada@example.com',
      image: 'https://cdn.example.com/ada.png',
      isAdmin: true,
      credits: { remainingCredits: 10, expiresAt: null },
    }),
    {
      name: 'Ada',
      email: 'ada@example.com',
      image: 'https://cdn.example.com/ada.png',
    }
  );
});

test('toAuthSessionUserSnapshot 对非字符串字段归一成 null', () => {
  assert.deepEqual(
    toAuthSessionUserSnapshot({
      name: 123,
      email: false,
      image: null,
    }),
    {
      name: null,
      email: null,
      image: null,
    }
  );
});

test('toAuthSessionUserSnapshot 对非法输入返回 null', () => {
  assert.equal(toAuthSessionUserSnapshot(null), null);
  assert.equal(toAuthSessionUserSnapshot('nope'), null);
});
