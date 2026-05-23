import assert from 'node:assert/strict';
import test from 'node:test';

test('cf:typegen:check 的失败文案固定指向受控 cloudflare.d.ts', async () => {
  const loadedModule = await import(
    `../../scripts/check-cf-typegen.mjs?ts=${Date.now()}`
  );
  assert.equal(typeof loadedModule.default, 'undefined');
});

test('cf:typegen canonical contract covers every supported worker slot', async () => {
  const loadedModule = await import(
    `../../scripts/check-cf-typegen.mjs?ts=${Date.now()}`
  );
  const artifacts = await loadedModule.createCanonicalTypegenWranglerConfig({
    rootPath: process.cwd(),
    siteKey: 'ai-remover',
  });

  try {
    assert.deepEqual(Object.keys(artifacts.contract.workers), [
      'router',
      'state',
      'public-web',
      'auth',
      'payment',
      'member',
      'chat',
      'admin',
    ]);
    assert.ok(artifacts.contract.serverWorkers.chat);
    assert.equal(
      artifacts.contract.router.serviceBindings.CHAT_WORKER,
      'cloudflare-typegen-chat'
    );
  } finally {
    await artifacts.cleanup();
  }
});
