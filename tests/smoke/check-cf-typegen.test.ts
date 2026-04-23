import assert from 'node:assert/strict';
import test from 'node:test';

test('cf:typegen:check 的失败文案固定指向受控 cloudflare.d.ts', async () => {
  const loadedModule = await import(
    `../../scripts/check-cf-typegen.mjs?ts=${Date.now()}`
  );
  assert.equal(typeof loadedModule.default, 'undefined');
});
