import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADMIN_SETTINGS_SMOKE_TABS,
  buildAdminSettingsPath,
  buildLocalizedAdminNoPermissionPath,
  buildLocalizedSignInPath,
  getAdminSettingsModuleContractChecks,
  validateAdminSettingsModuleContractSnapshot,
} from '../../scripts/lib/admin-settings-smoke.ts';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

test('ADMIN_SETTINGS_SMOKE_TABS: 第一阶段覆盖 6 个代表 tab，包含 storage', () => {
  assert.deepEqual(ADMIN_SETTINGS_SMOKE_TABS, [
    'general',
    'auth',
    'payment',
    'ai',
    'email',
    'storage',
  ]);
});

test('buildAdminSettingsPath/buildLocalizedSignInPath/buildLocalizedAdminNoPermissionPath: 默认 locale 无前缀，非默认 locale 带前缀', () => {
  assert.equal(buildAdminSettingsPath('general', 'en'), '/admin/settings/general');
  assert.equal(buildAdminSettingsPath('general', 'zh'), '/zh/admin/settings/general');
  assert.equal(buildLocalizedSignInPath('en'), '/sign-in');
  assert.equal(buildLocalizedSignInPath('zh'), '/zh/sign-in');
  assert.equal(buildLocalizedAdminNoPermissionPath('en'), '/admin/no-permission');
  assert.equal(
    buildLocalizedAdminNoPermissionPath('zh-TW'),
    '/zh-TW/admin/no-permission'
  );
});

test('getAdminSettingsModuleContractChecks: 覆盖 6 个代表性 settings tab', () => {
  const checks = getAdminSettingsModuleContractChecks();

  assert.deepEqual(
    checks.map((check) => check.name),
    ['general', 'auth', 'payment', 'ai', 'email', 'storage']
  );
});

test('AdminLayout: 非管理员拒绝跳转统一收敛到 /admin/no-permission', async () => {
  const layoutPath = path.resolve(rootDir, 'src/app/[locale]/(admin)/layout.tsx');
  const content = await readFile(layoutPath, 'utf8');

  assert.match(content, /redirectUrl:\s*`\/admin\/no-permission`/);
  assert.doesNotMatch(content, /redirectUrl:\s*`\/no-permission`/);
});

test('/admin/no-permission 页面必须位于 admin 受保护 layout 之外', async () => {
  const publicPagePath = path.resolve(
    rootDir,
    'src/app/[locale]/admin/no-permission/page.tsx'
  );
  const protectedPagePath = path.resolve(
    rootDir,
    'src/app/[locale]/(admin)/admin/no-permission/page.tsx'
  );

  await assert.doesNotReject(access(publicPagePath));
  await assert.rejects(access(protectedPagePath));
});

test('validateAdminSettingsModuleContractSnapshot: 校验普通 tab 快照', () => {
  const [generalCheck] = getAdminSettingsModuleContractChecks();

  assert.doesNotThrow(() =>
    validateAdminSettingsModuleContractSnapshot(generalCheck, {
      visible: true,
      rows: generalCheck.expectedRows,
    })
  );
});

test('validateAdminSettingsModuleContractSnapshot: 校验 supporting tab 快照', () => {
  const emailCheck = getAdminSettingsModuleContractChecks().find(
    (check) => check.name === 'email'
  );

  assert(emailCheck);
  assert.doesNotThrow(() =>
    validateAdminSettingsModuleContractSnapshot(emailCheck, {
      visible: true,
      rows: emailCheck.expectedRows,
    })
  );
});

test('validateAdminSettingsModuleContractSnapshot: storage tab 被纳入第一阶段并校验通过', () => {
  const storageCheck = getAdminSettingsModuleContractChecks().find(
    (check) => check.name === 'storage'
  );

  assert(storageCheck);
  assert.equal(storageCheck.expectedRows.length, 1);
  assert.equal(storageCheck.expectedRows[0]?.moduleId, 'storage');
  assert.doesNotThrow(() =>
    validateAdminSettingsModuleContractSnapshot(storageCheck, {
      visible: true,
      rows: storageCheck.expectedRows,
    })
  );
});

test('validateAdminSettingsModuleContractSnapshot: 缺行会失败', () => {
  const emailCheck = getAdminSettingsModuleContractChecks().find(
    (check) => check.name === 'email'
  );

  assert(emailCheck);
  assert.ok(emailCheck.expectedRows.length > 1);

  assert.throws(
    () =>
      validateAdminSettingsModuleContractSnapshot(emailCheck, {
        visible: true,
        rows: emailCheck.expectedRows.slice(0, -1),
      }),
    /unexpected row count/
  );
});

test('validateAdminSettingsModuleContractSnapshot: 错行会失败', () => {
  const generalCheck = getAdminSettingsModuleContractChecks().find(
    (check) => check.name === 'general'
  );

  assert(generalCheck);
  const mutatedRows = generalCheck.expectedRows.map((row) => ({
    ...row,
    relationship:
      row.moduleId === 'core_shell' ? 'provider' : row.relationship,
  }));

  assert.throws(
    () =>
      validateAdminSettingsModuleContractSnapshot(generalCheck, {
        visible: true,
        rows: mutatedRows,
      }),
    /unexpected relationship/
  );
});

test('validateAdminSettingsModuleContractSnapshot: guide href 漂移会失败', () => {
  const generalCheck = getAdminSettingsModuleContractChecks().find(
    (check) => check.name === 'general'
  );

  assert(generalCheck);
  const mutatedRows = generalCheck.expectedRows.map((row) => ({
    ...row,
    guideHref:
      row.moduleId === 'core_shell' ? `${row.guideHref}-unexpected` : row.guideHref,
  }));

  assert.throws(
    () =>
      validateAdminSettingsModuleContractSnapshot(generalCheck, {
        visible: true,
        rows: mutatedRows,
      }),
    /unexpected guide href/
  );
});
