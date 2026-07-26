'use server';

import {
  requireActionPermissions,
  requireActionUser,
} from '@/app/access-control/action-guard';
import { accessControlRuntimeDeps } from '@/app/access-control/runtime-deps';
import { accountRuntimeDeps } from '@/app/account/runtime-deps';
import { readAdminUserQuery } from '@/domains/account/application/admin-user.query';
import { AdminUserUpdateFormSchema } from '@/surfaces/admin/schemas/user';
import { validateAndParseForm } from '@/surfaces/admin/server/action-utils';
import { z } from 'zod';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { ActionError } from '@/shared/lib/action/errors';
import { jsonStringArraySchema } from '@/shared/lib/action/form';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';

/**
 * Update user profile (name, image)
 */
export async function updateUserAction(id: string, formData: FormData) {
  return withAction(async () => {
    const { data } = await validateAndParseForm({
      formData,
      permission: PERMISSIONS.USERS_WRITE,
      schema: AdminUserUpdateFormSchema,
      errorMessage: 'name is required',
    });

    const user = await readAdminUserQuery(id, {
      findUserById: accountRuntimeDeps.findUserById,
    });
    if (!user) {
      throw new ActionError('User not found');
    }

    const result = await accountRuntimeDeps.updateUser(user.id, {
      name: data.name,
      image: data.image ?? '',
    });
    if (!result) {
      throw new ActionError('update user failed');
    }

    return actionOk('user updated', '/admin/users');
  });
}

/**
 * Update user roles
 */
export async function updateUserRolesAction(id: string, formData: FormData) {
  return withAction(async () => {
    const admin = await requireActionUser();
    await requireActionPermissions(
      admin.id,
      PERMISSIONS.USERS_WRITE,
      PERMISSIONS.ROLES_WRITE
    );

    const user = await readAdminUserQuery(id, {
      findUserById: accountRuntimeDeps.findUserById,
    });
    if (!user) {
      throw new ActionError('User not found');
    }

    const schema = z.object({ roles: jsonStringArraySchema });
    const raw = Object.fromEntries(formData.entries());
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new ActionError('invalid roles');
    }

    await assertSuperAdminGrantAllowed(admin.id, parsed.data.roles);

    await accessControlRuntimeDeps.replaceUserRoles(
      user.id as string,
      parsed.data.roles,
      {
        actorUserId: admin.id,
        source: 'admin.users.updateUserRolesAction',
      }
    );

    return actionOk('roles updated', '/admin/users');
  });
}

/**
 * USERS_WRITE + ROLES_WRITE authorize managing role assignments, not minting new super
 * admins: any custom role holding both codes could otherwise grant itself the wildcard
 * role. The repository-side wildcard guard only covers the role-permission path.
 */
async function assertSuperAdminGrantAllowed(
  actorUserId: string,
  requestedRoleIds: string[]
) {
  const superAdminRoleName =
    accessControlRuntimeDeps.ACCESS_CONTROL_ROLES.SUPER_ADMIN;
  // includeDeleted: a soft-deleted super_admin role can be restored later, so granting it
  // is an escalation too.
  const roles = await accessControlRuntimeDeps.listRoles({
    includeDeleted: true,
  });
  const grantsSuperAdmin = roles.some(
    (role) =>
      role.name === superAdminRoleName && requestedRoleIds.includes(role.id)
  );
  if (!grantsSuperAdmin) {
    return;
  }

  const actorIsSuperAdmin = await accessControlRuntimeDeps.checkUserRole(
    actorUserId,
    superAdminRoleName
  );
  if (!actorIsSuperAdmin) {
    throw new ActionError('only super_admin can grant the super_admin role');
  }
}
