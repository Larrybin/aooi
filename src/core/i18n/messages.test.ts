import assert from 'node:assert/strict';
import test from 'node:test';

import { getRequestMessages } from './messages';
import {
  getRequestNamespaces,
  normalizeAppPathname,
  resolveMessagePath,
} from './messages.shared';

test('normalizeAppPathname 会去掉 locale 前缀并标准化结尾斜杠', () => {
  assert.equal(normalizeAppPathname('/zh/pricing/'), '/pricing');
  assert.equal(normalizeAppPathname('/pricing?tab=monthly'), '/pricing');
  assert.equal(normalizeAppPathname('/'), '/');
});

test('resolveMessagePath 会把 namespace 映射到真实消息文件', () => {
  assert.equal(resolveMessagePath('common.locale_switcher'), 'common');
  assert.equal(resolveMessagePath('admin.sidebar.header'), 'admin/sidebar');
  assert.equal(resolveMessagePath('admin.settings.brand_preview'), 'admin/settings');
  assert.equal(resolveMessagePath('ai.chat.generator'), 'ai/chat');
});

test('getRequestNamespaces 会按路由收敛服务端消息集', () => {
  assert.deepEqual(getRequestNamespaces('/zh/pricing'), [
    'common.metadata',
    'landing',
    'pricing',
  ]);
  assert.deepEqual(getRequestNamespaces('/zh/admin/settings/general'), [
    'common.metadata',
    'admin.sidebar',
    'admin.settings',
  ]);
  assert.deepEqual(getRequestNamespaces('/api/payment/checkout'), ['pricing']);
});

test('getRequestMessages: request config 不依赖 pathname，直接加载全量消息树', async () => {
  const messages = await getRequestMessages('zh-TW');

  assert.equal(typeof messages.common, 'object');
  assert.equal(typeof messages.landing, 'object');
  assert.equal(typeof messages.admin, 'object');
  assert.equal(typeof messages.settings, 'object');
});
