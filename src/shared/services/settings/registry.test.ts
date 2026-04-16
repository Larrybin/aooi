import assert from 'node:assert/strict';
import test from 'node:test';

import { PRODUCT_MODULE_IDS } from '@/config/product-modules/types';

import {
  ALL_SETTINGS,
  KNOWN_SETTING_KEYS,
  PUBLIC_SETTING_NAMES,
  SETTING_GROUP_REGISTRY,
  getSettingGroupsFromRegistry,
} from './registry';
import { SETTING_TAB_NAMES } from './tab-names';

test('settings registry: name 唯一且 known keys 完整', () => {
  const names = ALL_SETTINGS.map((setting) => setting.name);

  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(KNOWN_SETTING_KEYS, names);
});

test('settings registry: 所有 moduleId 和 tab 都引用合法契约', () => {
  const validModuleIds = new Set<string>(PRODUCT_MODULE_IDS);
  const validTabs = new Set<string>(SETTING_TAB_NAMES);

  for (const setting of ALL_SETTINGS) {
    assert.equal(
      validModuleIds.has(setting.moduleId),
      true,
      `未知 moduleId: ${setting.moduleId}`
    );
    assert.equal(validTabs.has(setting.tab), true, `未知 tab: ${setting.tab}`);
  }
});

test('settings registry: public settings 精确来自 visibility=public', () => {
  const derived = ALL_SETTINGS.filter(
    (setting) => setting.visibility === 'public'
  ).map((setting) => setting.name);

  assert.deepEqual(PUBLIC_SETTING_NAMES, derived);
});

test('settings registry: public settings 契约不应误公开敏感或仅服务端消费的 key', () => {
  assert.equal(PUBLIC_SETTING_NAMES.includes('google_client_id'), true);
  assert.equal(PUBLIC_SETTING_NAMES.includes('github_client_id'), false);
  assert.equal(PUBLIC_SETTING_NAMES.includes('google_client_secret'), false);
  assert.equal(PUBLIC_SETTING_NAMES.includes('github_client_secret'), false);
  assert.equal(PUBLIC_SETTING_NAMES.includes('stripe_secret_key'), false);
});

test('settings registry: group 顺序与首次出现顺序一致', () => {
  const firstSeenGroupIds = [
    ...new Set(ALL_SETTINGS.map((setting) => setting.group.id)),
  ];

  assert.deepEqual(
    SETTING_GROUP_REGISTRY.map((group) => group.id),
    firstSeenGroupIds
  );
});

test('getSettingGroupsFromRegistry: 输出唯一 group 并保留顺序', () => {
  const groups = getSettingGroupsFromRegistry((key) => key);

  assert.deepEqual(
    groups.map((group) => group.name),
    SETTING_GROUP_REGISTRY.map((group) => group.id)
  );
  assert.deepEqual(
    groups.map((group) => group.title),
    SETTING_GROUP_REGISTRY.map((group) => group.titleKey)
  );
});
