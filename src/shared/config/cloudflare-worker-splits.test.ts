import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildVersionOverridesHeader,
  CLOUDFLARE_SPLIT_WORKER_TARGETS,
  getSplitWorker,
  resolveWorkerTarget,
  stripLocalePrefix,
} from './cloudflare-worker-splits';

test('stripLocalePrefix 去掉 locale 前缀并保留根路径', () => {
  assert.equal(stripLocalePrefix('/zh/docs/foo'), '/docs/foo');
  assert.equal(
    stripLocalePrefix('/zh-TW/settings/profile'),
    '/settings/profile'
  );
  assert.equal(stripLocalePrefix('/zh'), '/');
  assert.equal(stripLocalePrefix('/pricing'), '/pricing');
});

test('resolveWorkerTarget 命中 canonical public-web/auth/payment/member/chat/admin', () => {
  assert.equal(resolveWorkerTarget('/zh/docs/foo'), 'public-web');
  assert.equal(resolveWorkerTarget('/api/docs/search'), 'public-web');
  assert.equal(resolveWorkerTarget('/api/auth/sign-in/social'), 'auth');
  assert.equal(resolveWorkerTarget('/api/payment/checkout'), 'payment');
  assert.equal(resolveWorkerTarget('/zh/settings/billing/retrieve'), 'payment');
  assert.equal(resolveWorkerTarget('/zh/chat'), 'chat');
  assert.equal(resolveWorkerTarget('/zh/chat/history'), 'chat');
  assert.equal(resolveWorkerTarget('/zh/chat/123'), 'chat');
  assert.equal(resolveWorkerTarget('/api/chat'), 'chat');
  assert.equal(resolveWorkerTarget('/api/chat/messages'), 'chat');
  assert.equal(resolveWorkerTarget('/zh/admin/settings/auth'), 'admin');
  assert.equal(resolveWorkerTarget('/zh/settings/profile'), 'member');
  assert.equal(resolveWorkerTarget('/zh/activity/chats'), 'member');
  assert.equal(resolveWorkerTarget('/api/user/self-details'), 'member');
  assert.equal(resolveWorkerTarget('/sign-in'), 'public-web');
  assert.equal(resolveWorkerTarget('/zh/blog/foo'), 'public-web');
  assert.equal(resolveWorkerTarget('/api/ai/query'), 'public-web');
  assert.equal(resolveWorkerTarget('/api/config/get-configs'), 'public-web');
});

test('buildVersionOverridesHeader 只为已配置版本生成 header', () => {
  const header = buildVersionOverridesHeader({
    PUBLIC_WEB_WORKER_VERSION_ID: 'public-web-version',
    AUTH_WORKER_VERSION_ID: 'auth-version',
    PAYMENT_WORKER_VERSION_ID: 'payment-version',
    ADMIN_WORKER_VERSION_ID: 'admin-version',
    MEMBER_WORKER_VERSION_ID: 'member-version',
    CHAT_WORKER_VERSION_ID: 'chat-version',
  });

  assert.equal(
    header,
    'roller-rabbit-public-web="public-web-version", roller-rabbit-auth="auth-version", roller-rabbit-payment="payment-version", roller-rabbit-member="member-version", roller-rabbit-chat="chat-version", roller-rabbit-admin="admin-version"'
  );

  assert.equal(buildVersionOverridesHeader({}), null);
});

test('split worker 定义都有 routes 与 patterns', () => {
  for (const target of CLOUDFLARE_SPLIT_WORKER_TARGETS) {
    const split = getSplitWorker(target);
    assert.ok(split.routeTemplates.length > 0, `${target} missing routes`);
    assert.ok(split.patterns.length > 0, `${target} missing patterns`);
  }
});
