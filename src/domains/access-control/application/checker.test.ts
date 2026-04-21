import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkUserHasAllPermissions,
  checkUserHasAnyPermissions,
  checkUserHasAnyRoles,
  checkUserPermission,
  checkUserRole,
  createAccessControlChecker,
  getPermissionMatchCandidates,
  restoreRoleUseCase,
} from './checker';

test('getPermissionMatchCandidates 生成精确与通配符候选', () => {
  assert.deepEqual(getPermissionMatchCandidates('admin.users.read'), [
    '*',
    'admin.users.read',
    'admin.users.*',
    'admin.*',
  ]);
});

test('createAccessControlChecker 支持 has/hasAny/hasAll', async () => {
  const checker = createAccessControlChecker('user_1', {
    readUserPermissionCodes: async () => ['admin.users.*', 'content.read'],
  });

  assert.equal(await checker.has('admin.users.read'), true);
  assert.equal(await checker.hasAny(['billing.read', 'content.read']), true);
  assert.equal(await checker.hasAll(['admin.users.read', 'content.read']), true);
});

test('checkUserPermission 家族读取 repository 并返回纯授权结果', async () => {
  const permissionRepository = {
    readUserPermissionCodes: async () => ['admin.settings.read', 'admin.*'],
  };
  const roleRepository = {
    listUserRoles: async () => [{ name: 'admin' }, { name: 'editor' }],
  };

  assert.equal(
    await checkUserPermission('user_1', 'admin.users.write', permissionRepository),
    true
  );
  assert.equal(
    await checkUserHasAnyPermissions(
      'user_1',
      ['payments.read', 'admin.settings.read'],
      permissionRepository
    ),
    true
  );
  assert.equal(
    await checkUserHasAllPermissions(
      'user_1',
      ['admin.settings.read', 'admin.users.read'],
      permissionRepository
    ),
    true
  );
  assert.equal(await checkUserRole('user_1', 'admin', roleRepository), true);
  assert.equal(
    await checkUserHasAnyRoles('user_1', ['viewer', 'editor'], roleRepository),
    true
  );
});

test('restoreRoleUseCase 返回 not_found', async () => {
  const result = await restoreRoleUseCase(
    {
      roleId: 'role_1',
      actorUserId: 'user_1',
      source: 'test.restore',
    },
    {
      findRoleById: async () => undefined,
      restoreRoleRecord: async () => ({ status: 'restored' as const }),
    }
  );

  assert.deepEqual(result, { status: 'not_found' });
});

test('restoreRoleUseCase 返回 not_deleted', async () => {
  const result = await restoreRoleUseCase(
    {
      roleId: 'role_1',
      actorUserId: 'user_1',
      source: 'test.restore',
    },
    {
      findRoleById: async () =>
        ({
          id: 'role_1',
          name: 'editor',
          deletedAt: null,
        }) as never,
      restoreRoleRecord: async () => ({ status: 'restored' as const }),
    }
  );

  assert.deepEqual(result, { status: 'not_deleted' });
});

test('restoreRoleUseCase 返回 name_conflict', async () => {
  const result = await restoreRoleUseCase(
    {
      roleId: 'role_1',
      actorUserId: 'user_1',
      source: 'test.restore',
    },
    {
      findRoleById: async () =>
        ({
          id: 'role_1',
          name: 'editor',
          deletedAt: new Date('2026-04-01T00:00:00.000Z'),
        }) as never,
      restoreRoleRecord: async () => ({ status: 'name_conflict' as const }),
    }
  );

  assert.deepEqual(result, { status: 'name_conflict' });
});

test('restoreRoleUseCase 返回 restored 并透传审计上下文', async () => {
  const auditCalls: Array<{ actorUserId?: string; source?: string }> = [];
  const deletedAt = new Date('2026-04-01T00:00:00.000Z');

  const result = await restoreRoleUseCase(
    {
      roleId: 'role_1',
      actorUserId: 'user_1',
      source: 'test.restore',
    },
    {
      findRoleById: async () =>
        ({
          id: 'role_1',
          name: 'editor',
          deletedAt,
        }) as never,
      restoreRoleRecord: async (_roleId, audit) => {
        auditCalls.push(audit ?? {});
        return { status: 'restored' as const };
      },
    }
  );

  assert.equal(result.status, 'restored');
  assert.equal(result.role.id, 'role_1');
  assert.deepEqual(auditCalls, [
    {
      actorUserId: 'user_1',
      source: 'test.restore',
    },
  ]);
});
