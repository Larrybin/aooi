import assert from 'node:assert/strict';
import test from 'node:test';

import { assertSuperAdminRoleChangeAllowed } from './super-admin-role-change';

const roles = [{ id: 'role_super_admin', name: 'super_admin' }];

test('非 super_admin 不能移除目标用户现有的 super_admin 角色', async () => {
  await assert.rejects(
    () =>
      assertSuperAdminRoleChangeAllowed(
        {
          actorUserId: 'admin_1',
          targetUserId: 'super_admin_1',
          requestedRoleIds: [],
          superAdminRoleName: 'super_admin',
        },
        {
          listRoles: async () => roles,
          checkUserRole: async (userId) => userId === 'super_admin_1',
        }
      ),
    /only super_admin can change the super_admin role/
  );
});

test('super_admin 可以移除目标用户的 super_admin 角色', async () => {
  await assert.doesNotReject(() =>
    assertSuperAdminRoleChangeAllowed(
      {
        actorUserId: 'super_admin_1',
        targetUserId: 'super_admin_2',
        requestedRoleIds: [],
        superAdminRoleName: 'super_admin',
      },
      {
        listRoles: async () => roles,
        checkUserRole: async () => true,
      }
    )
  );
});

test('非 super_admin 不能授予 super_admin 角色', async () => {
  await assert.rejects(
    () =>
      assertSuperAdminRoleChangeAllowed(
        {
          actorUserId: 'admin_1',
          targetUserId: 'user_1',
          requestedRoleIds: ['role_super_admin'],
          superAdminRoleName: 'super_admin',
        },
        {
          listRoles: async () => roles,
          checkUserRole: async () => false,
        }
      ),
    /only super_admin can change the super_admin role/
  );
});

test('普通角色变更不要求操作者是 super_admin', async () => {
  await assert.doesNotReject(() =>
    assertSuperAdminRoleChangeAllowed(
      {
        actorUserId: 'admin_1',
        targetUserId: 'user_1',
        requestedRoleIds: ['role_editor'],
        superAdminRoleName: 'super_admin',
      },
      {
        listRoles: async () => roles,
        checkUserRole: async () => false,
      }
    )
  );
});
