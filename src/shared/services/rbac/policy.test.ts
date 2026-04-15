import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPermissionMatchCandidates,
  matchesPermissionCode,
} from './matcher';

test('buildPermissionMatchCandidates: 生成精确 + 分层通配符候选', () => {
  assert.deepEqual(buildPermissionMatchCandidates('admin.users.read'), [
    '*',
    'admin.users.read',
    'admin.users.*',
    'admin.*',
  ]);
});

test('matchesPermissionCode: 支持通配符匹配', () => {
  const permissionSet = new Set(['admin.*']);

  assert.equal(matchesPermissionCode(permissionSet, 'admin.users.read'), true);
  assert.equal(matchesPermissionCode(permissionSet, 'billing.read'), false);
});

test('matchesPermissionCode: hasAny/hasAll 的基础语义可组合', () => {
  const permissionSet = new Set(['content.read', 'content.write']);
  const anyCodes = ['admin.read', 'content.write'];
  const allCodes = ['content.read', 'content.write'];

  const hasAny = anyCodes.some((code) =>
    matchesPermissionCode(permissionSet, code)
  );
  const hasAll = allCodes.every((code) =>
    matchesPermissionCode(permissionSet, code)
  );

  assert.equal(hasAny, true);
  assert.equal(hasAll, true);
});
