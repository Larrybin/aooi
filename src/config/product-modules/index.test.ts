import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_SETTINGS,
  type KnownSettingKey,
} from '@/domains/settings/registry';
import {
  SETTING_TAB_NAMES,
  type SettingTabName,
} from '@/domains/settings/tab-names';

import {
  getProductModuleItemsByTab,
  MODULE_GUIDE_SLUGS,
  PRODUCT_MODULE_TIERS,
  PRODUCT_MODULE_VERIFICATIONS,
  PRODUCT_MODULES,
} from './index';

test('PRODUCT_MODULES: module id 唯一', () => {
  const ids = PRODUCT_MODULES.map((module) => module.id);

  assert.equal(new Set(ids).size, ids.length);
});

test('PRODUCT_MODULES: tier、verification、doc slug 合法', () => {
  for (const productModule of PRODUCT_MODULES) {
    assert.ok(PRODUCT_MODULE_TIERS.includes(productModule.tier));
    assert.ok(
      PRODUCT_MODULE_VERIFICATIONS.includes(productModule.verification)
    );
    assert.ok(MODULE_GUIDE_SLUGS.includes(productModule.docSlug));
  }
});

test('PRODUCT_MODULES: ownedTabs / supportingTabs 只引用有效 tab 且不交叉', () => {
  const validTabs = new Set<string>(SETTING_TAB_NAMES);

  for (const productModule of PRODUCT_MODULES) {
    for (const tab of [
      ...productModule.ownedTabs,
      ...productModule.supportingTabs,
    ]) {
      assert.ok(
        validTabs.has(tab),
        `${productModule.id} 引用了未知 tab: ${tab as SettingTabName}`
      );
    }

    const overlap = productModule.ownedTabs.filter((tab) =>
      productModule.supportingTabs.includes(tab)
    );
    assert.deepEqual(overlap, []);
  }
});

test('PRODUCT_MODULES: settingKeys 精确等于 registry 按 moduleId 分组后的结果', () => {
  const grouped = new Map<string, KnownSettingKey[]>();

  for (const setting of ALL_SETTINGS) {
    const existing = grouped.get(setting.moduleId);
    if (existing) {
      existing.push(setting.name);
      continue;
    }

    grouped.set(setting.moduleId, [setting.name]);
  }

  for (const productModule of PRODUCT_MODULES) {
    assert.deepEqual(
      productModule.settingKeys,
      grouped.get(productModule.id) ?? [],
      `${productModule.id} 的 settingKeys 未与 settings registry 对齐`
    );
  }
});

test('getProductModuleItemsByTab: 按 relationship/tier/注册表顺序返回模块行', () => {
  assert.deepEqual(
    getProductModuleItemsByTab('general').map((item) => item.moduleId),
    ['core_shell']
  );
  assert.deepEqual(
    getProductModuleItemsByTab('email').map((item) => item.moduleId),
    ['auth', 'customer_service']
  );
  assert.deepEqual(
    getProductModuleItemsByTab('email').map((item) => item.relationship),
    ['supporting', 'supporting']
  );
});
