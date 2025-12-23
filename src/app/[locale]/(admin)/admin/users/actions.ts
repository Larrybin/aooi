'use server';

import { z } from 'zod';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { ActionError } from '@/shared/lib/action/errors';
import { jsonStringArraySchema } from '@/shared/lib/action/form';
import {
  requireActionPermissions,
  requireActionUser,
} from '@/shared/lib/action/guard';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { validateAndParseForm } from '@/shared/lib/admin/action-utils';
import {
  findUserById,
  updateUser,
  type UpdateUser,
} from '@/shared/models/user';
import { AdminUserUpdateFormSchema } from '@/shared/schemas/actions/admin-user';
import { assignRolesToUser } from '@/shared/services/rbac';

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

    const user = await findUserById(id);
    if (!user) {
      throw new ActionError('User not found');
    }

    const newUser: UpdateUser = {
      name: data.name,
      image: data.image ?? '',
    };

    const result = await updateUser(user.id as string, newUser);
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

    const user = await findUserById(id);
    if (!user) {
      throw new ActionError('User not found');
    }

    const schema = z.object({ roles: jsonStringArraySchema });
    const raw = Object.fromEntries(formData.entries());
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new ActionError('invalid roles');
    }

    await assignRolesToUser(user.id as string, parsed.data.roles, {
      actorUserId: admin.id,
      source: 'admin.users.updateUserRolesAction',
    });

    return actionOk('roles updated', '/admin/users');
  });
}
