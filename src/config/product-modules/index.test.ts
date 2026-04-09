import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PUBLIC_SETTING_NAMES } from '@/shared/constants/public-setting-names';
import {
  SETTING_TAB_NAMES,
  type SettingTabName,
} from '@/shared/services/settings/tab-names';

import {
  MODULE_GUIDE_SLUGS,
  PRODUCT_MODULES,
  PRODUCT_MODULE_TIERS,
  PRODUCT_MODULE_VERIFICATIONS,
  getProductModuleByTab,
} from './index';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const settingsDefinitionsDir = path.resolve(
  currentDir,
  '../../shared/services/settings/definitions'
);

async function getSettingDefinitionNames() {
  const files = (await readdir(settingsDefinitionsDir)).filter((file) =>
    file.endsWith('.ts')
  );
  const settingNames = new Set<string>();

  for (const file of files) {
    const content = await readFile(
      path.resolve(settingsDefinitionsDir, file),
      'utf8'
    );

    for (const match of content.matchAll(/name:\s*'([^']+)'/g)) {
      settingNames.add(match[1]);
    }
  }

  return settingNames;
}

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

test('PRODUCT_MODULES: settingKeys 都能在 settings definitions 或 public settings 中找到', async () => {
  const settingDefinitionNames = await getSettingDefinitionNames();
  const validSettingKeys = new Set<string>([
    ...settingDefinitionNames,
    ...PUBLIC_SETTING_NAMES,
  ]);

  for (const productModule of PRODUCT_MODULES) {
    for (const settingKey of productModule.settingKeys) {
      assert.ok(
        validSettingKeys.has(settingKey),
        `${productModule.id} 引用了未知 setting key: ${settingKey}`
      );
    }
  }
});

test('getProductModuleByTab: owned tab 优先，supporting tab 回落到主模块', () => {
  assert.equal(getProductModuleByTab('general')?.id, 'core_shell');
  assert.equal(getProductModuleByTab('auth')?.id, 'auth');
  assert.equal(getProductModuleByTab('payment')?.id, 'billing');
  assert.equal(getProductModuleByTab('ai')?.id, 'ai');
  assert.equal(getProductModuleByTab('email')?.id, 'auth');
});
