'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/core/db';
import { role } from '@/config/db/schema';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { jsonStringArraySchema } from '@/shared/lib/action/form';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import {
  validateAndParseForm,
  validatePermission,
} from '@/shared/lib/admin/action-utils';
import { AdminRoleUpdateFormSchema } from '@/shared/schemas/actions/admin-role';
import {
  assignPermissionsToRole,
  deleteRole,
  getRoleById,
  restoreRole,
  updateRole,
  type UpdateRole,
} from '@/shared/services/rbac';

/**
 * Update role title and description
 */
export async function updateRoleAction(id: string, formData: FormData) {
  return withAction(async () => {
    const { user, data } = await validateAndParseForm({
      formData,
      permission: PERMISSIONS.ROLES_WRITE,
      schema: AdminRoleUpdateFormSchema,
      errorMessage: 'title and description are required',
    });

    const roleRow = await getRoleById(id);
    if (!roleRow) {
      throw new Error('Role not found');
    }

    const newRole: UpdateRole = {
      title: data.title,
      description: data.description,
    };

    const result = await updateRole(id, newRole, {
      actorUserId: user.id,
      source: 'admin.roles.updateRoleAction',
    });
    if (!result) {
      throw new Error('update role failed');
    }

    return actionOk('role updated', '/admin/roles');
  });
}

/**
 * Update role permissions
 */
export async function updateRolePermissionsAction(
  id: string,
  formData: FormData
) {
  return withAction(async () => {
    const user = await validatePermission(PERMISSIONS.ROLES_WRITE);

    const roleRow = await getRoleById(id);
    if (!roleRow) {
      throw new Error('Role not found');
    }

    const schema = z.object({ permissions: jsonStringArraySchema });
    const raw = Object.fromEntries(formData.entries());
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error('invalid permissions');
    }

    await assignPermissionsToRole(
      roleRow.id as string,
      parsed.data.permissions,
      {
        actorUserId: user.id,
        source: 'admin.roles.updateRolePermissionsAction',
      }
    );

    return actionOk('permissions updated', '/admin/roles');
  });
}

/**
 * Delete a role (soft delete)
 */
export async function deleteRoleAction(id: string) {
  return withAction(async () => {
    const user = await validatePermission(PERMISSIONS.ROLES_DELETE);

    const [roleRow] = await db()
      .select()
      .from(role)
      .where(and(eq(role.id, id), isNull(role.deletedAt)));

    if (!roleRow) {
      throw new Error('Role not found');
    }

    await deleteRole(id, {
      actorUserId: user.id,
      source: 'admin.roles.deleteRoleAction',
    });

    return actionOk('role deleted', '/admin/roles');
  });
}

/**
 * Restore a deleted role
 */
export async function restoreRoleAction(id: string) {
  return withAction(async () => {
    const user = await validatePermission(PERMISSIONS.ROLES_WRITE);

    const [roleRow] = await db().select().from(role).where(eq(role.id, id));
    if (!roleRow) {
      throw new Error('Role not found');
    }
    if (!roleRow.deletedAt) {
      throw new Error('Role is not deleted');
    }

    try {
      await restoreRole(id, {
        actorUserId: user.id,
        source: 'admin.roles.restoreRoleAction',
      });
    } catch {
      throw new Error(
        'restore role failed: another active role with the same name may already exist'
      );
    }

    return actionOk('role restored', '/admin/roles?includeDeleted=1');
  });
}
